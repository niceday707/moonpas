"use client";

// 글래스모피즘 카드 — hover 시 살짝 떠오르는 효과
import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type GlassCardProps = HTMLMotionProps<"div"> & {
  /** hover 시 떠오르는 인터랙션 활성화 여부 */
  interactive?: boolean;
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  function GlassCard(
    { className, interactive = true, children, ...props },
    ref,
  ) {
    return (
      <motion.div
        ref={ref}
        whileHover={
          interactive
            ? {
                y: -4,
                boxShadow: "0 12px 40px rgba(124, 58, 237, 0.35)",
                transition: { type: "spring", stiffness: 300, damping: 22 },
              }
            : undefined
        }
        className={cn(
          "glass rounded-2xl p-6",
          interactive && "cursor-pointer transition-colors",
          className,
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);
