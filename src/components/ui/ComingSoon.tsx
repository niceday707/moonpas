"use client";

// "준비 중입니다" 플레이스홀더. 디자인 시스템(글래스모피즘 + 보라 액센트)에 맞춰 통일.
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

type Props = {
  /** 페이지 제목 (예: "이슈토론") */
  title: string;
  /** 부가 설명 (한 줄) */
  subtitle?: string;
  /** 좌상단 일러스트 아이콘 */
  icon?: LucideIcon;
  /** 돌아갈 경로 (기본: /dashboard) */
  backHref?: string;
};

export function ComingSoon({
  title,
  subtitle,
  icon: Icon = Sparkles,
  backHref = "/dashboard",
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
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] shadow-[0_10px_30px_rgba(124,58,237,0.4)]">
            <Icon className="h-7 w-7 text-white" strokeWidth={2.2} />
          </div>

          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-violet-500 dark:text-violet-400">
            Coming Soon
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-3xl">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {subtitle ?? "준비 중입니다. 더 좋은 모습으로 곧 찾아올게요."}
          </p>

          <Link
            href={backHref}
            className="mx-auto mt-7 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(124,58,237,0.35)] transition-all hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(124,58,237,0.55)]"
          >
            <ArrowLeft className="h-4 w-4" />
            돌아가기
          </Link>
        </GlassCard>
      </motion.div>
    </div>
  );
}
