"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";

// 한글 완성형 + 영문 + 숫자, 2~10자
const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]{2,10}$/;

export type NicknameSubmitResult =
  | { ok: true }
  | { ok: false; message: string };

export function NicknameSetupModal({
  open,
  defaultNickname,
  onSubmit,
}: {
  open: boolean;
  defaultNickname: string;
  onSubmit: (nickname: string) => Promise<NicknameSubmitResult>;
}) {
  const [value, setValue] = useState(defaultNickname);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 모달이 열릴 때마다 기본 닉네임으로 다시 채워준다
  useEffect(() => {
    if (open) {
      setValue(defaultNickname);
      setError(null);
    }
  }, [open, defaultNickname]);

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("닉네임을 입력해주세요.");
      return;
    }
    if (!NICKNAME_REGEX.test(trimmed)) {
      setError("한글·영문·숫자 2~10자만 사용할 수 있어요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await onSubmit(trimmed);
    setSubmitting(false);
    if (!res.ok) setError(res.message);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#16162a] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2 text-violet-400">
              <Sparkles className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-widest">
                환영합니다
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">닉네임을 설정해주세요</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/60">
              커뮤니티에서 사용할 닉네임이에요. 나중에 프로필에서 변경할 수 있어요.
            </p>

            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) handleSubmit();
              }}
              placeholder="닉네임 (2~10자)"
              maxLength={10}
              autoFocus
              disabled={submitting}
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-violet-500 focus:outline-none disabled:opacity-50"
            />

            {error && (
              <p className="mt-2 text-xs text-red-400">{error}</p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "저장 중..." : "확인"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
