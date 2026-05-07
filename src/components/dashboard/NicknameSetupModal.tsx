"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import type { Role } from "@/components/ui/Badge";

// 한글 완성형 + 영문 + 숫자, 2~10자
const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]{2,10}$/;

export type NicknameSubmitResult =
  | { ok: true }
  | { ok: false; message: string };

const ROLE_OPTIONS: { value: Role; label: string; desc: string }[] = [
  { value: "student", label: "재학생", desc: "문태고 학생" },
  { value: "teacher", label: "교사", desc: "문태고 선생님" },
  { value: "parent", label: "학부모", desc: "재학생 보호자" },
  { value: "alumni", label: "졸업생", desc: "문태고 졸업생" },
];

export function NicknameSetupModal({
  open,
  defaultNickname,
  defaultRole = "student",
  onSubmit,
}: {
  open: boolean;
  defaultNickname: string;
  defaultRole?: Role;
  onSubmit: (nickname: string, role: Role) => Promise<NicknameSubmitResult>;
}) {
  const [value, setValue] = useState(defaultNickname);
  const [role, setRole] = useState<Role>(defaultRole);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(defaultNickname);
      setRole(defaultRole);
      setError(null);
    }
  }, [open, defaultNickname, defaultRole]);

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
    const res = await onSubmit(trimmed, role);
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
            <h2 className="text-lg font-bold text-white">프로필을 설정해주세요</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/60">
              커뮤니티에서 사용할 닉네임과 역할을 골라주세요. 나중에 프로필에서 변경할 수 있어요.
            </p>

            <label className="mt-5 block text-[11px] font-semibold uppercase tracking-widest text-white/50">
              닉네임
            </label>
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
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-violet-500 focus:outline-none disabled:opacity-50"
            />

            <label className="mt-4 block text-[11px] font-semibold uppercase tracking-widest text-white/50">
              역할
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((opt) => {
                const active = role === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    disabled={submitting}
                    className={
                      "rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-50 " +
                      (active
                        ? "border-violet-500 bg-violet-500/15"
                        : "border-white/10 bg-white/5 hover:bg-white/10")
                    }
                  >
                    <div className="text-sm font-bold text-white">{opt.label}</div>
                    <div className="text-[10px] text-white/50">{opt.desc}</div>
                  </button>
                );
              })}
            </div>

            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

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
