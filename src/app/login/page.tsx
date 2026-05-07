"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const ALLOWED_DOMAIN = "moontae.hs.jne.kr";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 로그인 완료 후 콜백 처리 (URL에 code 파라미터가 있는 경우)
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          const email = session.user.email ?? "";
          if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
            // 허용되지 않은 도메인 → 즉시 로그아웃
            await supabase.auth.signOut();
            setError(
              `@${ALLOWED_DOMAIN} 학교 이메일만 로그인할 수 있습니다.\n(입력된 이메일: ${email})`
            );
            setLoading(false);
          } else {
            router.push("/dashboard");
          }
        }
      }
    );
    return () => authListener.subscription.unsubscribe();
  }, [router]);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
        // 항상 계정 선택 창 표시
        queryParams: { prompt: "select_account" },
      },
    });
    if (oauthError) {
      setError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f0f1a]">
      {/* 배경 글로우 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.18) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm px-6"
      >
        {/* 카드 */}
        <div
          className="rounded-2xl border border-white/10 p-8 shadow-[0_0_40px_rgba(124,58,237,0.15)]"
          style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(24px)" }}
        >
          {/* 로고 */}
          <div className="mb-8 text-center">
            <p className="text-xs tracking-[0.35em] text-white/40 uppercase mb-1">
              문태고등학교
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white">문파스</h1>
            <p className="mt-2 text-xs text-white/50">
              학교 Google 계정으로 로그인하세요
            </p>
          </div>

          {/* 구글 로그인 버튼 */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/8 px-4 py-3.5 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              // Google 로고 SVG
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.2 7.2-10.5 7.2-17.2z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.1 1.4-4.8 2.2-8 2.2-6.1 0-11.3-4.1-13.2-9.7H2.6v6.2C6.5 42.8 14.7 48 24 48z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.8 28.7c-.5-1.4-.7-2.9-.7-4.7s.3-3.3.7-4.7v-6.2H2.6C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.9l8.2-6.2z"
                />
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.6-6.6C35.9 2.5 30.4 0 24 0 14.7 0 6.5 5.2 2.6 13.1l8.2 6.2C12.7 13.6 17.9 9.5 24 9.5z"
                />
              </svg>
            )}
            {loading ? "로그인 중..." : "Google 계정으로 로그인"}
          </button>

          {/* 에러 메시지 */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-pre-line">{error}</span>
            </motion.div>
          )}

          {/* 안내 문구 */}
          <p className="mt-6 text-center text-[11px] text-white/30">
            @{ALLOWED_DOMAIN} 계정만 로그인 가능합니다
          </p>
        </div>

        {/* 뒤로 가기 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-white/40 transition hover:text-white/70"
          >
            ← 메인으로 돌아가기
          </button>
        </div>
      </motion.div>
    </div>
  );
}
