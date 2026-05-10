-- 026_profiles_role_admin_only.sql
--
-- profiles.role 컬럼을 일반 사용자가 변경하지 못하도록 강제하는 트리거.
-- 배경: 007_profiles_self_update 의 "profiles update self" 정책은 본인 row 의
--      모든 컬럼을 UPDATE 가능하게 허용하고 있어, 클라이언트가
--      `update profiles set role='admin' where id = auth.uid()` 같은 호출을
--      직접 보낼 수 있는 위험이 있다. RLS WITH CHECK 만으로는 OLD/NEW 비교가
--      불가능하므로 BEFORE UPDATE 트리거로 차단한다.
--
-- 정책:
--   - role 컬럼이 변경되지 않으면(이전 값 == 새 값) 그대로 통과 — 닉네임/아바타/
--     bio 등 일반 프로필 수정에는 영향 없음.
--   - role 이 변경되는 경우, 호출자가 admin (profiles.role='admin') 일 때만 허용.
--   - service_role 등 auth.uid() IS NULL 인 컨텍스트(관리용 서버 작업)는 통과시켜
--     서버측 백오피스 작업이 차단되지 않도록 한다. (PostgREST 일반 호출은
--     반드시 auth.uid() 가 세팅됨.)

CREATE OR REPLACE FUNCTION public.enforce_profile_role_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- 서버측 service_role 호출(auth.uid() = NULL)은 통과
    IF v_uid IS NULL THEN
      RETURN NEW;
    END IF;
    -- 인증된 호출이면 admin 여부 확인
    IF NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = v_uid AND role = 'admin'
    ) THEN
      RAISE EXCEPTION '권한이 없습니다: role 변경은 관리자만 가능합니다'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_admin_only ON public.profiles;
CREATE TRIGGER profiles_role_admin_only
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_role_admin_only();

-- 보너스: INSERT 시점에도 자기 자신을 admin 으로 만들지 못하도록 가드.
--   (createInitialProfile 은 student/teacher/parent/alumni 만 INSERT 하지만,
--    클라이언트가 직접 .insert({role:'admin'}) 을 호출하는 경우를 차단)
CREATE OR REPLACE FUNCTION public.enforce_profile_role_insert_no_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NEW.role = 'admin' THEN
    -- service_role 은 통과 (수동 운영자 승격 가능)
    IF v_uid IS NULL THEN
      RETURN NEW;
    END IF;
    -- 인증된 호출이라면 자기 자신을 admin 으로 INSERT 하는 것을 차단
    -- (이미 admin 인 사람이 다른 사람의 row 를 insert 할 일은 없다고 가정)
    RAISE EXCEPTION '권한이 없습니다: admin 역할로 가입할 수 없습니다'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_insert_no_admin ON public.profiles;
CREATE TRIGGER profiles_role_insert_no_admin
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_role_insert_no_admin();
