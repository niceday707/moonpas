import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// 빌드/프리렌더 시점에 환경변수가 없어도 모듈 로드가 실패하지 않도록
// 실제 사용 시점(런타임)에 클라이언트를 생성한다.
let _client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error(
      "Supabase 환경변수가 설정되지 않았습니다. " +
        "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 확인하세요."
    );
  }
  _client = createClient(SUPABASE_URL, SUPABASE_ANON);
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[
      prop as string | symbol
    ];
    return typeof value === "function" ? (value as Function).bind(client) : value;
  },
});
