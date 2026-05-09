// 검색 로그 송신 헬퍼 — /api/search-log 로 위임.
//
//   - 빈 문자열 / 1글자 검색은 보내지 않음 (의미 없는 키워드 노이즈 방지)
//   - 동일 유저(미로그인 시 anon)+키워드 1분 이내 중복 호출 안 함
//   - 키워드는 trim + lowercase 로 정규화
//   - 미로그인이어도 호출은 시도 — 서버에 SUPABASE_SERVICE_ROLE_KEY 가 있으면 user_id=null 로 기록됨
//   - 실패해도 검색 흐름을 막지 않도록 throw 하지 않음
import { supabase } from "@/lib/supabase";

const MIN_KEYWORD_LENGTH = 2;
const DEDUPE_WINDOW_MS = 60 * 1000;

// (유저|anon)::키워드 → 마지막 호출 시각. 페이지 새로고침 시 초기화되는 메모리 캐시.
const lastLogged = new Map<string, number>();

export function normalizeKeyword(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * 검색 실행 시 한 줄 호출.
 * - fire-and-forget: throw 하지 않음
 * - 미로그인 시는 user_id 없이 보냄 (서버가 service role key 로 RLS 우회)
 */
export async function logSearch(rawKeyword: string): Promise<void> {
  const keyword = normalizeKeyword(rawKeyword);
  if (keyword.length < MIN_KEYWORD_LENGTH) return;

  // 현재 세션에서 user_id + access_token 회수 (없어도 OK)
  let userId: string | null = null;
  let token: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user.id ?? null;
    token = data.session?.access_token ?? null;
  } catch {
    /* 세션 회수 실패 — 익명으로 진행 */
  }

  const cacheKey = `${userId ?? "anon"}::${keyword}`;
  const now = Date.now();
  const last = lastLogged.get(cacheKey);
  if (last && now - last < DEDUPE_WINDOW_MS) return;
  lastLogged.set(cacheKey, now);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch("/api/search-log", {
      method: "POST",
      headers,
      body: JSON.stringify({ keyword, userId }),
      cache: "no-store",
      // 라우팅에 영향 주지 않도록 keepalive — 페이지 이동 중에도 전송 보장
      keepalive: true,
    });

    if (!res.ok) {
      // 다음 시도 가능하도록 dedupe 캐시 롤백
      lastLogged.delete(cacheKey);
    }
  } catch {
    lastLogged.delete(cacheKey);
  }
}
