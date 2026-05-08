-- ============================================================
-- 문파스(MoonPas) — D-Day 이벤트 관리 시스템
--   · dday_events 테이블 + RLS
--   · 활성 이벤트는 누구나 읽기, 쓰기는 admin 만
-- ============================================================

-- ── 1. dday_events 테이블 ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dday_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  target_date  DATE NOT NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS dday_events_active_order_idx
  ON public.dday_events(is_active, order_index, target_date);

-- ── 2. RLS 정책 ────────────────────────────────────────────
ALTER TABLE public.dday_events ENABLE ROW LEVEL SECURITY;

-- SELECT: 활성 이벤트는 누구나, 비활성도 admin 은 조회 가능
DROP POLICY IF EXISTS "dday_events read active" ON public.dday_events;
CREATE POLICY "dday_events read active"
  ON public.dday_events FOR SELECT
  USING (
    is_active = TRUE
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- INSERT: admin 만
DROP POLICY IF EXISTS "dday_events insert admin" ON public.dday_events;
CREATE POLICY "dday_events insert admin"
  ON public.dday_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- UPDATE: admin 만
DROP POLICY IF EXISTS "dday_events update admin" ON public.dday_events;
CREATE POLICY "dday_events update admin"
  ON public.dday_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- DELETE: admin 만
DROP POLICY IF EXISTS "dday_events delete admin" ON public.dday_events;
CREATE POLICY "dday_events delete admin"
  ON public.dday_events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ── 3. 초기 데이터(선택) — 2026학년도 수능 ─────────────────
-- 이미 등록된 이벤트가 있으면 건너뜀
INSERT INTO public.dday_events (title, target_date, description, is_active, order_index)
SELECT '2026학년도 대학수학능력시험', DATE '2026-11-19', '대학수학능력시험 시행일', TRUE, 0
WHERE NOT EXISTS (SELECT 1 FROM public.dday_events);
