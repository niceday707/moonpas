import { createBrowserClient } from "@supabase/auth-helpers-nextjs";

// 환경변수 미설정 시 빌드 에러 방지 — 실제 사용 전 .env.local에 값 입력 필요
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder";

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON);
