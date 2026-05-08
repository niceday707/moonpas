"use client";

// 게시글 공유 버튼 — 목록 행/카드 안의 <Link> 내부에 들어가도 안전하게 동작.
// 클릭 시 부모 Link 의 페이지 전환을 막고, Web Share API 또는 클립보드 복사로 공유한다.
// 토스트 메시지는 컴포넌트 내부에서 자체 노출 (전역 토스트 시스템 의존 X).

import { useState } from "react";
import { Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { buildPostShareUrl, sharePost } from "@/lib/share";
import { cn } from "@/lib/utils";

type Props = {
  boardType: string;
  postId: string;
  /** 공유 시 표시할 글 제목 (Web Share 의 title 필드) */
  title: string;
  /** 시각 스타일 — `compact`(목록 행), `pill`(카드), `dark`(다크 배경 카드) */
  variant?: "compact" | "pill" | "dark";
  className?: string;
};

export function ShareButton({
  boardType,
  postId,
  title,
  variant = "compact",
  className,
}: Props) {
  const [toast, setToast] = useState<string | null>(null);

  async function handle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = buildPostShareUrl(boardType, postId);
    const result = await sharePost({ title, url });
    if (result.kind === "copied") setToast("링크가 복사되었습니다");
    else if (result.kind === "error") setToast(result.message);
    if (result.kind === "copied" || result.kind === "error") {
      window.setTimeout(() => setToast(null), 2200);
    }
  }

  const styleMap: Record<NonNullable<Props["variant"]>, string> = {
    compact:
      "p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200",
    pill:
      "rounded-full px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200",
    dark:
      "rounded-full p-1 text-white/45 hover:bg-white/[0.08] hover:text-white/85",
  };

  return (
    <>
      <button
        type="button"
        onClick={handle}
        aria-label="공유"
        className={cn(
          "inline-flex items-center gap-1 rounded transition-colors",
          styleMap[variant],
          className,
        )}
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
          >
            <div className="rounded-full border border-white/15 bg-black/85 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md">
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
