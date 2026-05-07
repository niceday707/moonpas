"use client";

// "새 글 N개" 알림 바 — 클릭하면 최신글로 스크롤
import { ArrowUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  count: number;
  onClick: () => void;
};

export function NewPostsBanner({ count, onClick }: Props) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          key="banner"
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="sticky top-20 z-10 mx-auto flex justify-center md:top-24"
        >
          <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(124,58,237,0.5)] transition-transform hover:scale-105"
          >
            <ArrowUp className="h-4 w-4" />
            <span>새 글 {count}개</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
