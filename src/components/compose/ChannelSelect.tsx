"use client";

// 채널 선택 드롭다운 — 자유게시판 / 교육과정 / 2028 대입 / 졸업생 방명록 / 공지
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Hash } from "lucide-react";
import { CHANNEL_LABEL, type Channel } from "@/lib/mock-data";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const ORDER: Channel[] = ["free", "curriculum", "admissions", "alumni", "notice"];

type Props = {
  value: Channel;
  onChange: (next: Channel) => void;
};

export function ChannelSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫힘
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-semibold text-foreground/80 ring-1 ring-inset ring-white/10 transition-colors hover:bg-foreground/10"
      >
        <Hash className="h-3.5 w-3.5" />
        {CHANNEL_LABEL[value]}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="glass absolute left-0 top-[calc(100%+6px)] z-30 w-56 overflow-hidden rounded-2xl py-1 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
          >
            {ORDER.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-foreground/5",
                    c === value && "text-accent",
                  )}
                >
                  <span>{CHANNEL_LABEL[c]}</span>
                  {c === value && <Check className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
