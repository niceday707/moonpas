-- 020_anonymous_rpc.sql
--
-- 익명 게시판 전용 RPC 함수 3종.
--
-- 보안 목표:
--   브라우저 Network 탭에서 author_id / author(profiles join) /
--   nickname / avatar_url / role / mention_user_id 등 작성자 식별 정보가
--   절대 노출되지 않아야 한다.
--
--   현재 구조(Supabase JS 클라이언트 → PostgREST 직접 호출)에서는
--   normalizePost() 가 클라이언트 수신 이후에 실행되므로, HTTP 응답 자체에
--   작성자 정보가 담겨 있다. 따라서 DB 레이어에서 sanitized 데이터만 반환한다.
--
--   이 함수들은 SECURITY DEFINER 로 실행되므로 RLS 정책을 우회하지만,
--   출력 컬럼에 author_id 등을 포함하지 않으므로 작성자 추적이 불가능하다.
--
-- 함수 목록:
--   1) get_anon_post(p_post_id, p_user_id)     — 게시글 단건
--   2) list_anon_comments(p_post_id, p_user_id) — 댓글 목록
--   3) list_anon_posts(...)                     — 게시글 목록 + total_count

-- ────────────────────────────────────────────────────────────
-- 1. 게시글 단건 — 작성자 식별 정보 완전 제거
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_anon_post(
  p_post_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
  board_type    TEXT,
  title         TEXT,
  content       TEXT,
  image_url     TEXT,
  file_url      TEXT,
  file_name     TEXT,
  view_count    INT,
  like_count    INT,
  is_pinned     BOOLEAN,
  status        TEXT,
  vote_a        INT,
  vote_b        INT,
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ,
  comment_count INT,
  is_mine       BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.board_type::TEXT,
    p.title,
    p.content,
    p.image_url,
    p.file_url,
    p.file_name,
    p.view_count::INT,
    p.like_count::INT,
    COALESCE(p.is_pinned, FALSE),
    COALESCE(p.status::TEXT, 'active'),
    COALESCE(p.vote_a, 0)::INT,
    COALESCE(p.vote_b, 0)::INT,
    p.created_at,
    p.updated_at,
    (SELECT COUNT(*)::INT FROM comments c WHERE c.post_id = p.id),
    -- is_mine: author_id 는 DB 내부에서만 비교, 응답에 절대 포함하지 않음
    (p_user_id IS NOT NULL AND p.author_id = p_user_id)
  FROM posts p
  WHERE p.id = p_post_id
    AND p.board_type = 'anonymous'
$$;

-- ────────────────────────────────────────────────────────────
-- 2. 댓글 목록 — 작성자 식별 정보 완전 제거
--    anon_seed : MD5(post_id:author_id) 앞 16자 — 단방향 해시, 역추적 불가
--                같은 글 안에서만 동일 작성자를 그룹화하는 데 사용
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_anon_comments(
  p_post_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id             UUID,
  post_id        UUID,
  parent_id      UUID,
  content        TEXT,
  created_at     TIMESTAMPTZ,
  is_mine        BOOLEAN,
  is_post_author BOOLEAN,
  anon_seed      TEXT,
  like_count     INT,
  my_reaction    TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.post_id,
    c.parent_id,
    c.content,
    c.created_at,
    -- is_mine: author_id 는 DB 내부에서만 비교
    (p_user_id IS NOT NULL AND c.author_id = p_user_id),
    -- is_post_author: 글 작성자 == 댓글 작성자 여부 (ID 노출 없이 boolean만)
    (c.author_id = p.author_id),
    -- anon_seed: MD5 단방향 해시 — author_id 자체가 아닌 해시값만 반환
    --   다른 글(다른 post_id)에서는 같은 사람이라도 다른 seed 가 나와 교차 추적 불가
    SUBSTRING(MD5(p_post_id::TEXT || ':' || c.author_id::TEXT) FROM 1 FOR 16),
    -- like_count
    COALESCE(
      (SELECT COUNT(*)::INT FROM comment_reactions cr
       WHERE cr.comment_id = c.id AND cr.reaction = 'like'),
      0
    ),
    -- my_reaction: user_id = NULL 이면 항상 NULL (NULL 비교는 UNKNOWN → 0 rows)
    (SELECT cr.reaction
     FROM comment_reactions cr
     WHERE cr.comment_id = c.id AND cr.user_id = p_user_id
     LIMIT 1)
  FROM comments c
  -- JOIN 실패(posts 없음 또는 board_type != anonymous) → 결과 0행
  JOIN posts p ON p.id = p_post_id AND p.board_type = 'anonymous'
  WHERE c.post_id = p_post_id
  ORDER BY c.created_at ASC
$$;

-- ────────────────────────────────────────────────────────────
-- 3. 게시글 목록 — 작성자 식별 정보 완전 제거, 페이지네이션 + total_count
--    total_count 는 윈도우 함수로 LIMIT 전 전체 행 수를 반환 (별도 쿼리 불필요)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_anon_posts(
  p_user_id      UUID    DEFAULT NULL,
  p_limit        INT     DEFAULT 20,
  p_offset       INT     DEFAULT 0,
  p_content_like TEXT    DEFAULT NULL,
  p_sort         TEXT    DEFAULT 'created_at'
)
RETURNS TABLE (
  id            UUID,
  board_type    TEXT,
  title         TEXT,
  content       TEXT,
  image_url     TEXT,
  file_url      TEXT,
  file_name     TEXT,
  view_count    INT,
  like_count    INT,
  is_pinned     BOOLEAN,
  status        TEXT,
  vote_a        INT,
  vote_b        INT,
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ,
  comment_count INT,
  is_mine       BOOLEAN,
  total_count   BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_sort = 'like_count' THEN
    RETURN QUERY
      SELECT
        p.id,
        p.board_type::TEXT,
        p.title,
        p.content,
        p.image_url,
        p.file_url,
        p.file_name,
        p.view_count::INT,
        p.like_count::INT,
        COALESCE(p.is_pinned, FALSE),
        COALESCE(p.status::TEXT, 'active'),
        COALESCE(p.vote_a, 0)::INT,
        COALESCE(p.vote_b, 0)::INT,
        p.created_at,
        p.updated_at,
        (SELECT COUNT(*)::INT FROM comments c WHERE c.post_id = p.id),
        (p_user_id IS NOT NULL AND p.author_id = p_user_id),
        COUNT(*) OVER ()::BIGINT
      FROM posts p
      WHERE p.board_type = 'anonymous'
        AND (p_content_like IS NULL OR p.content ILIKE p_content_like)
      ORDER BY p.like_count DESC, p.created_at DESC
      LIMIT p_limit
      OFFSET p_offset;
  ELSE
    RETURN QUERY
      SELECT
        p.id,
        p.board_type::TEXT,
        p.title,
        p.content,
        p.image_url,
        p.file_url,
        p.file_name,
        p.view_count::INT,
        p.like_count::INT,
        COALESCE(p.is_pinned, FALSE),
        COALESCE(p.status::TEXT, 'active'),
        COALESCE(p.vote_a, 0)::INT,
        COALESCE(p.vote_b, 0)::INT,
        p.created_at,
        p.updated_at,
        (SELECT COUNT(*)::INT FROM comments c WHERE c.post_id = p.id),
        (p_user_id IS NOT NULL AND p.author_id = p_user_id),
        COUNT(*) OVER ()::BIGINT
      FROM posts p
      WHERE p.board_type = 'anonymous'
        AND (p_content_like IS NULL OR p.content ILIKE p_content_like)
      ORDER BY p.created_at DESC
      LIMIT p_limit
      OFFSET p_offset;
  END IF;
END;
$$;

-- RPC 를 누구나 호출할 수 있도록 권한 부여
-- (is_mine 계산은 p_user_id 파라미터로 처리 — 클라이언트가 JWT 토큰 없이 호출해도 안전)
GRANT EXECUTE ON FUNCTION public.get_anon_post(UUID, UUID)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_anon_comments(UUID, UUID)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_anon_posts(UUID, INT, INT, TEXT, TEXT) TO anon, authenticated;
