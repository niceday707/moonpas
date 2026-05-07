"use client";

// 인기글 정렬 탭 — 좋아요순 / 최신순 / 댓글순
import { motion } from "framer-motion";
import type { Sort } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const TABS: { value: Sort; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "likes", label: "좋아요순" },
  { value: "comments", label: "댓글순" },
];

type Props = {
  value: Sort;
  onChange: (next: Sort) => void;
  className?: string;
};

export function SortTabs({ value, onChange, className }: Props) {
  return (
    <div
      role="tablist"
      aria-label="정렬"
      className={cn(
        "glass inline-flex items-center gap-1 rounded-full p-1",
        className,
      )}
    >
      {TABS.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              active ? "text-white" : "text-foreground/60 hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="sort-pill"
                className="absolute inset-0 -z-10 rounded-full bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] shadow-[0_4px_18px_rgba(124,58,237,0.45)]"
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
              />
            )}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
