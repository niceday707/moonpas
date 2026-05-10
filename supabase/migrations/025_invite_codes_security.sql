-- 025_invite_codes_security.sql
--
-- 초대 코드 보안 강화 — 1코드 = 1명 (1회용) + 서버 측 원자적 검증/소비.
--
-- 변경 사항
--   1) 1회용 모델로 전환: used / used_by / used_at 컬럼 추가, 멀티유즈(max_uses/used_count) 제거
--   2) RLS: admin 만 SELECT/INSERT/DELETE 가능. 일반 클라이언트의 직접 UPDATE 는 차단
--      (코드 소비는 SECURITY DEFINER RPC 로만 수행)
--   3) DELETE 는 미사용 코드(used = false)에 한해서만 허용 — 사용 이력 보존
--   4) 사전 검증 RPC: validate_invite_code(text)  — anon 호출 가능, 읽기만
--   5) 원자적 소비 + 프로필 생성 RPC: consume_invite_code(text, text)
--      — 인증된 사용자, 코드 마킹과 profiles INSERT 가 한 트랜잭션 안에서 동시 성공/실패

-- 0) 테이블이 없는 환경(첫 셋업)을 위한 안전망
CREATE TABLE IF NOT EXISTS invite_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  role        text NOT NULL,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 1) 1회용 모델 컬럼 추가 (idempotent)
ALTER TABLE invite_codes
  ADD COLUMN IF NOT EXISTS used    boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS used_by uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS used_at timestamptz;

-- 2) 기존 데이터 마이그레이션 — used_count > 0 이면 used = true 로 표시
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'invite_codes' AND column_name = 'used_count'
  ) THEN
    EXECUTE 'UPDATE invite_codes SET used = true WHERE used_count > 0 AND used = false';
  END IF;
END $$;

-- 3) 멀티유즈 컬럼 제거 (1회용으로 일원화)
ALTER TABLE invite_codes DROP COLUMN IF EXISTS max_uses;
ALTER TABLE invite_codes DROP COLUMN IF EXISTS used_count;

-- 4) role 값을 parent/alumni 로 제한
ALTER TABLE invite_codes DROP CONSTRAINT IF EXISTS invite_codes_role_check;
ALTER TABLE invite_codes
  ADD CONSTRAINT invite_codes_role_check CHECK (role IN ('parent','alumni'));

-- 5) 코드 형식(소문자 1 + 숫자 4) 보장
ALTER TABLE invite_codes DROP CONSTRAINT IF EXISTS invite_codes_code_format_check;
ALTER TABLE invite_codes
  ADD CONSTRAINT invite_codes_code_format_check CHECK (code ~ '^[a-z][0-9]{4}$');

-- 6) 조회 인덱스 (사용 여부별 정렬용)
CREATE INDEX IF NOT EXISTS invite_codes_used_idx ON invite_codes (used, created_at DESC);

-- 7) RLS — admin 만 직접 접근, UPDATE 는 누구도 직접 못 함
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin can select invite_codes"  ON invite_codes;
DROP POLICY IF EXISTS "admin can insert invite_codes"  ON invite_codes;
DROP POLICY IF EXISTS "admin can delete invite_codes"  ON invite_codes;
DROP POLICY IF EXISTS "admin can update invite_codes"  ON invite_codes;
DROP POLICY IF EXISTS "anyone can select invite_codes" ON invite_codes;

CREATE POLICY "admin can select invite_codes" ON invite_codes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin can insert invite_codes" ON invite_codes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 미사용 코드만 admin 이 삭제 가능 — 사용 이력은 보존
CREATE POLICY "admin can delete unused invite_codes" ON invite_codes
  FOR DELETE USING (
    used = false
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- (UPDATE 정책 없음 — RPC(SECURITY DEFINER)로만 변경 가능)

-- 8) 사전 검증 RPC — OAuth 진입 전 클라이언트가 호출. 인증 불필요.
CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role       text;
  v_used       boolean;
  v_expires_at timestamptz;
BEGIN
  SELECT role, used, expires_at
    INTO v_role, v_used, v_expires_at
    FROM invite_codes
   WHERE code = lower(btrim(p_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_used THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'used');
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at <= now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'role',  v_role,
    'expires_at', v_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(text) TO anon, authenticated;

-- 9) 원자적 소비 + 프로필 생성 RPC.
--    인증된 사용자가 닉네임을 들고 호출.
--    UPDATE 가 0행이면(이미 사용/만료/존재X) 곧바로 실패 반환.
--    이후 profiles INSERT 가 실패하면 함수 트랜잭션이 통째로 롤백되어
--    코드의 사용 마킹도 되돌아간다 — race / 닉네임 중복으로 인한 "코드만 소진" 방지.
CREATE OR REPLACE FUNCTION public.consume_invite_code(
  p_code     text,
  p_nickname text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_nick     text := btrim(coalesce(p_nickname, ''));
  v_code_id  uuid;
  v_role     text;
BEGIN
  -- 인증 필수
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  IF v_nick = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_nickname');
  END IF;

  -- 이미 프로필이 있으면 코드 소비 자체를 거부 (덮어쓰기 방지)
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_exists');
  END IF;

  -- 닉네임 사전 중복 검사 (대소문자 무시)
  IF EXISTS (SELECT 1 FROM profiles WHERE nickname ILIKE v_nick) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nickname_taken');
  END IF;

  -- 원자적 마킹: 미사용 + 미만료인 경우에만 used=true 로 전환
  UPDATE invite_codes
     SET used    = true,
         used_by = v_uid,
         used_at = now()
   WHERE code   = lower(btrim(p_code))
     AND used   = false
     AND (expires_at IS NULL OR expires_at > now())
   RETURNING id, role INTO v_code_id, v_role;

  IF v_code_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_used');
  END IF;

  -- 프로필 생성 — role 은 코드의 값을 강제 (클라이언트 변조 무력화)
  BEGIN
    INSERT INTO profiles (id, nickname, role)
    VALUES (v_uid, v_nick, v_role);
  EXCEPTION
    WHEN unique_violation THEN
      -- 닉네임 또는 id 동시 충돌 — 함수 종료 시 트랜잭션이 롤백되어
      -- invite_codes 의 used 플래그도 원상복구됨.
      RAISE EXCEPTION 'profile_conflict' USING ERRCODE = 'P0001';
  END;

  RETURN jsonb_build_object('ok', true, 'role', v_role);
EXCEPTION
  WHEN sqlstate 'P0001' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'conflict');
END;
$$;

REVOKE ALL ON FUNCTION public.consume_invite_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_invite_code(text, text) TO authenticated;
