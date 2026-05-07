"use client";

// 그라데이션 + 글로우 효과 버튼
import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: Variant;
  size?: Size;
};

const VARIANT: Record<Variant, string> = {
  primary:
    "text-white bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] shadow-[0_8px_24px_rgba(124,58,237,0.35)] hover:shadow-[0_12px_40px_rgba(124,58,237,0.55)]",
  secondary:
    "text-foreground glass hover:bg-white/10 dark:hover:bg-white/10",
  ghost:
    "text-foreground hover:bg-black/5 dark:hover:bg-white/10",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", children, disabled, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      disabled={disabled}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
});
