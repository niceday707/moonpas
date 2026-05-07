"use client";

// 로그인이 필요한 페이지 또는 액션에서 보여주는 안내 화면.
// 구글 로그인 버튼은 Supabase 연동 전이므로 alert 안내만 띄운다.
import { motion } from "framer-motion";
import { Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { attemptGoogleLogin } from "@/lib/auth";

type Props = {
  /** 안내 메시지 상단 제목 */
  title?: string;
  /** 부가 설명 */
  description?: string;
};

export function LoginRequired({
  title = "로그인이 필요한 서비스입니다",
  description = "문파스의 모든 기능을 이용하시려면 학교 계정으로 로그인해 주세요.",
}: Props) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-screen-md items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full"
      >
        <GlassCard interactive={false} className="p-8 text-center md:p-12">
          {/* 아이콘 */}
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] shadow-[0_10px_30px_rgba(124,58,237,0.4)]">
            <Lock className="h-7 w-7 text-white" strokeWidth={2.4} />
          </div>

          {/* 타이틀 */}
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-2xl">
            {title}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {description}
          </p>

          {/* 구글 로그인 버튼 */}
          <button
            type="button"
            onClick={attemptGoogleLogin}
            className="mx-auto mt-7 flex h-12 w-full max-w-xs items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-[0_6px_24px_rgba(124,58,237,0.18)] transition-all hover:scale-[1.02] hover:shadow-[0_10px_32px_rgba(124,58,237,0.32)] dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
          >
            <GoogleMark />
            Google 계정으로 로그인
          </button>

          {/* 돌아가기 */}
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-violet-600 dark:text-gray-400 dark:hover:text-violet-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            대시보드로 돌아가기
          </Link>
        </GlassCard>
      </motion.div>
    </div>
  );
}

// 구글 로고 SVG
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.51h3.232c1.891-1.741 2.982-4.305 2.982-7.351z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.232-2.51c-.895.6-2.041.955-3.386.955-2.605 0-4.81-1.759-5.595-4.123H3.064v2.59A9.996 9.996 0 0 0 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.405 13.9A6.005 6.005 0 0 1 6.09 12c0-.659.114-1.3.314-1.9V7.51H3.064A9.996 9.996 0 0 0 2 12c0 1.614.386 3.14 1.064 4.49L6.405 13.9z"
      />
      <path
        fill="#EA4335"
        d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.96 2.99 14.696 2 12 2A9.996 9.996 0 0 0 3.064 7.51L6.405 10.1C7.19 7.736 9.395 5.977 12 5.977z"
      />
    </svg>
  );
}
