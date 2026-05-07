"use client";

// 화면 우하단 글쓰기 버튼 (모바일에서는 BottomNav 위쪽으로 떠 있음)
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onClick?: () => void;
  className?: string;
  label?: string;
};

export function FloatingActionButton({
  onClick,
  className,
  label = "글쓰기",
}: Props) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.3 }}
      whileHover={{
        scale: 1.08,
        boxShadow: "0 12px 50px rgba(124, 58, 237, 0.7)",
      }}
      whileTap={{ scale: 0.94 }}
      className={cn(
        // 모바일은 BottomNav 글쓰기 버튼이 있으므로 FAB 숨김
        "fixed bottom-8 right-5 z-40 hidden h-14 w-14 place-items-center rounded-full",
        "bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] text-white",
        "shadow-[0_8px_30px_rgba(124,58,237,0.5)]",
        "md:grid md:right-8 md:h-16 md:w-16",
        className,
      )}
    >
      <Plus className="h-6 w-6 md:h-7 md:w-7" strokeWidth={2.4} />
    </motion.button>
  );
}
