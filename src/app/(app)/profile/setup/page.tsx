"use client";

// 닉네임 설정/변경 화면. 쿨다운 정책은 폐지 — 언제든 자유롭게 변경 가능.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Sparkles, X as XIcon } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { Avatar } from "@/components/feed/Avatar";
import { Badge } from "@/components/ui/Badge";
import {
  ERROR_MESSAGES,
  attemptUpdateNickname,
  isInitialNicknameSetup,
  useProfile,
  validateNicknameFormat,
  type ValidationError,
} from "@/lib/profile";
import { ME } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function ProfileSetupPage() {
  return (
    <AuthGate
      title="닉네임 설정에 로그인이 필요합니다"
      description="문파스에서 사용할 닉네임을 정해주세요."
    >
      <ProfileSetupForm />
    </AuthGate>
  );
}

function ProfileSetupForm() {
  const profile = useProfile();
  const router = useRouter();

  const initialSetup = isInitialNicknameSetup(profile);

  const [name, setName] = useState(profile.nickname);
  const [serverError, setServerError] = useState<ValidationError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 입력값 실시간 형식 검사 (서버 통신 없이 즉시 표시)
  const liveValidation = useMemo<ValidationError | null>(() => {
    if (!name) return null; // 비어있을 땐 안내 문구만 표시
    return validateNicknameFormat(name);
  }, [name]);

  const isValid = !!name.trim() && !liveValidation;
  const showError = serverError ?? liveValidation;
  const errorMessage = showError ? ERROR_MESSAGES[showError] : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !isValid) return;
    setServerError(null);
    setSubmitting(true);
    const result = await attemptUpdateNickname(name);
    setSubmitting(false);
    if (result.ok) {
      router.push("/profile");
    } else {
      setServerError(result.error);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 md:py-10">
      <Link
        href="/profile"
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-foreground/55 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        프로필로 돌아가기
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass rounded-3xl p-6 md:p-8"
      >
        {/* 헤더 */}
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-violet-500">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight md:text-xl">
              {initialSetup ? "닉네임을 설정해주세요" : "닉네임 변경"}
            </h1>
            <p className="mt-0.5 text-xs text-foreground/55">
              {initialSetup
                ? "문파스에서 사용할 닉네임이에요. 언제든 변경할 수 있어요."
                : "언제든 자유롭게 변경할 수 있어요."}
            </p>
          </div>
        </div>

        {/* 미리보기 */}
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
          <Avatar
            author={{ ...ME, name: name.trim() || profile.nickname }}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-bold">
                {name.trim() || profile.nickname}
              </span>
              <Badge role={profile.role} />
            </div>
            <p className="text-[11px] text-foreground/45">
              게시판에는 이렇게 표시돼요
            </p>
          </div>
        </div>

        {/* 폼 */}
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label
            htmlFor="nickname"
            className="text-xs font-semibold text-foreground/70"
          >
            닉네임
          </label>
          <div
            className={cn(
              "flex items-center gap-2 rounded-2xl bg-foreground/5 px-4 py-2.5 ring-1 ring-inset transition-colors",
              showError
                ? "ring-rose-500/40 focus-within:ring-rose-500/60"
                : isValid
                  ? "ring-emerald-500/30 focus-within:ring-emerald-500/50"
                  : "ring-transparent focus-within:ring-violet-500/40",
            )}
          >
            <input
              id="nickname"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setServerError(null);
              }}
              placeholder="2~10자, 한글·영문·숫자"
              maxLength={20}
              disabled={submitting}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/35 disabled:opacity-60"
            />
            {name && !showError && isValid && (
              <Check className="h-4 w-4 text-emerald-500" />
            )}
            {showError && <XIcon className="h-4 w-4 text-rose-500" />}
          </div>

          {/* 안내/에러 메시지 */}
          <p
            className={cn(
              "min-h-[18px] text-[11px]",
              errorMessage
                ? "text-rose-500"
                : isValid
                  ? "text-emerald-500"
                  : "text-foreground/45",
            )}
          >
            {errorMessage
              ? errorMessage
              : isValid
                ? "사용할 수 있는 닉네임이에요"
                : "2~10자, 한글·영문·숫자 조합으로 입력해주세요"}
          </p>

          {/* 제출 */}
          <button
            type="submit"
            disabled={!isValid || submitting}
            className={cn(
              "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white transition-opacity",
              "bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] shadow-[0_6px_20px_rgba(124,58,237,0.4)]",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {submitting
              ? "확인 중…"
              : initialSetup
                ? "닉네임 사용하기"
                : "닉네임 변경하기"}
          </button>
        </form>
      </motion.div>
    </main>
  );
}
