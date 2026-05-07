"use client";

// 하트(좋아요) 버튼 — 누르면 톡 튀어오르며 빨갛게 채워지는 바운스 애니메이션
import { Heart } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { toggleLike } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Props = {
  postId: string;
  liked: boolean;
  count: number;
  className?: string;
};

export function LikeButton({ postId, liked, count, className }: Props) {
  // 낙관적 업데이트로 즉각적인 피드백 제공
  const [optimistic, setOptimistic] = useState({ liked, count });
  const [burstKey, setBurstKey] = useState(0);

  // 부모로부터 새로운 prop이 들어오면 동기화
  if (optimistic.liked !== liked && burstKey === 0) {
    setOptimistic({ liked, count });
  }

  const handle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const next = !optimistic.liked;
    setOptimistic({
      liked: next,
      count: optimistic.count + (next ? 1 : -1),
    });
    if (next) setBurstKey((k) => k + 1);

    try {
      await toggleLike(postId);
    } catch {
      // 실패 시 롤백
      setOptimistic((s) => ({
        liked: !s.liked,
        count: s.count + (s.liked ? -1 : 1),
      }));
    }
  };

  return (
    <button
      type="button"
      aria-pressed={optimistic.liked}
      aria-label={optimistic.liked ? "좋아요 취소" : "좋아요"}
      onClick={handle}
      className={cn(
        "group relative inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors",
        "hover:bg-rose-500/10",
        optimistic.liked ? "text-rose-500" : "text-foreground/55",
        className,
      )}
    >
      <span className="relative grid place-items-center">
        <motion.span
          key={`heart-${optimistic.liked}`}
          initial={
            optimistic.liked
              ? { scale: 0.6 }
              : { scale: 1 }
          }
          animate={
            optimistic.liked
              ? { scale: [0.6, 1.4, 0.9, 1.1, 1] }
              : { scale: 1 }
          }
          transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
          className="inline-flex"
        >
          <Heart
            className="h-5 w-5"
            strokeWidth={2}
            fill={optimistic.liked ? "currentColor" : "none"}
          />
        </motion.span>

        {/* 좋아요 누른 순간 터지는 입자 효과 */}
        <AnimatePresence>
          {burstKey > 0 && optimistic.liked && (
            <motion.span
              key={burstKey}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 2.4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55 }}
              className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-rose-400"
            />
          )}
        </AnimatePresence>
      </span>

      <motion.span
        key={`count-${optimistic.count}`}
        initial={{ y: -4, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="text-xs font-semibold tabular-nums"
      >
        {optimistic.count}
      </motion.span>
    </button>
  );
}
