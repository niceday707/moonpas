"use client";

// 해/달 아이콘으로 전환되는 다크모드 토글
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function ThemeToggle({ className }: Props) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // 하이드레이션 미스매치 방지: 클라이언트 마운트 후에만 실제 아이콘 표시
  useEffect(() => setMounted(true), []);

  const isDark = theme === "dark";
  const next = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      onClick={() => setTheme(next)}
      className={cn(
        "glass relative grid h-10 w-10 place-items-center rounded-full transition-colors",
        "hover:shadow-[0_0_20px_rgba(124,58,237,0.45)]",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {mounted && (
          <motion.span
            key={isDark ? "moon" : "sun"}
            initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.25 }}
            className="grid place-items-center"
          >
            {isDark ? (
              <Moon className="h-5 w-5 text-cyan-accent" />
            ) : (
              <Sun className="h-5 w-5 text-warning" />
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
