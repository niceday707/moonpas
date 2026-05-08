// 검색 로그 INSERT 헬퍼.
//   - 빈 문자열 / 1글자 검색은 저장하지 않음 (의미 없는 키워드 노이즈 방지)
//   - 동일 유저가 같은 키워드를 1분 이내에 다시 검색하면 중복 INSERT 안 함
//     (서버 unique 제약 대신 클라이언트에서 마지막 검색 시각만 기억)
//   - 키워드는 trim + lowercase 로 정규화 후 저장
//   - 익명(미로그인) 유저도 user_id=null 로 기록 가능 — RLS 가 authenticated 만 INSERT 허용하므로
//     실제 호출은 로그인 상태에서만 의미 있음. 미로그인 시는 silently skip.
import { supabase } from "@/lib/supabase";

const MIN_KEYWORD_LENGTH = 2;
const DEDUPE_WINDOW_MS = 60 * 1000;

// (유저, 키워드) → 마지막 INSERT 시각. 페이지 새로고침 시 초기화되는 메모리 캐시.
const lastLogged = new Map<string, number>();

export function normalizeKeyword(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * 검색 실행 시 한 줄 호출. 실패해도 검색 흐름을 막지 않도록 throw 하지 않음.
 */
export async function logSearch(rawKeyword: string): Promise<void> {
  const keyword = normalizeKeyword(rawKeyword);
  if (keyword.length < MIN_KEYWORD_LENGTH) return;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  if (!userId) return; // 미로그인 — RLS 가 거부하므로 호출 자체 생략

  const cacheKey = `${userId}::${keyword}`;
  const now = Date.now();
  const last = lastLogged.get(cacheKey);
  if (last && now - last < DEDUPE_WINDOW_MS) return;
  lastLogged.set(cacheKey, now);

  const { error } = await supabase
    .from("search_logs")
    .insert({ keyword, user_id: userId });

  if (error) {
    console.warn("[search-log] insert 실패", error.message);
    // 캐시도 롤백 — 다음 검색이 다시 시도될 수 있도록
    lastLogged.delete(cacheKey);
  }
}
