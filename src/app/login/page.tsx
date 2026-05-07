"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Loader2, Ticket, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

const ALLOWED_DOMAIN = "moontae.hs.jne.kr";

// 초대 코드 실패 시도 제한
const MAX_ATTEMPTS = 10;
const LOCKOUT_MS = 10 * 60 * 1000; // 10분
const ATTEMPT_KEY = "invite_attempts";
const LOCKOUT_KEY = "invite_lockout_until";

// sessionStorage 키 — OAuth 리다이렉트 사이에도 유지
const SS_INVITE_CODE = "inviteCode";
const SS_INVITE_ROLE = "inviteRole";

type InviteRole = "parent" | "alumni" | "student" | "teacher";

function readLockoutMs(): number {
  if (typeof window === "undefined") return 0;
  const until = Number(localStorage.getItem(LOCKOUT_KEY) ?? "0");
  if (!until) return 0;
  const remain = until - Date.now();
  return remain > 0 ? remain : 0;
}

function bumpAttempts(): number {
  if (typeof window === "undefined") return 0;
  const current = Number(localStorage.getItem(ATTEMPT_KEY) ?? "0") + 1;
  localStorage.setItem(ATTEMPT_KEY, String(current));
  if (current >= MAX_ATTEMPTS) {
    localStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
    localStorage.setItem(ATTEMPT_KEY, "0");
  }
  return current;
}

function clearAttempts() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ATTEMPT_KEY);
  localStorage.removeItem(LOCKOUT_KEY);
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  // 로그인 완료 후 콜백 처리 (URL에 code 파라미터가 있는 경우)
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event !== "SIGNED_IN" || !session?.user) return;

        const email = session.user.email ?? "";
        const inviteCode =
          typeof window !== "undefined"
            ? sessionStorage.getItem(SS_INVITE_CODE)?.toLowerCase() ?? null
            : null;

        // 초대 코드 사용자: 도메인 체크 건너뜀 + used_count 증가
        if (inviteCode) {
          try {
            const { data: code } = await supabase
              .from("invite_codes")
              .select("id, used_count")
              .eq("code", inviteCode)
              .maybeSingle();
            if (code) {
              await supabase
                .from("invite_codes")
                .update({ used_count: (code.used_count ?? 0) + 1 })
                .eq("id", code.id);
            }
          } catch (err) {
            console.error("[invite] used_count 증가 실패", err);
          }
          // 사용 후 정리 (role 은 닉네임 모달에서 읽고 삭제)
          sessionStorage.removeItem(SS_INVITE_CODE);
          router.push("/dashboard");
          return;
        }

        // 일반 사용자: 학교 도메인만 허용
        if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
          await supabase.auth.signOut();
          setError(
            `@${ALLOWED_DOMAIN} 학교 이메일만 로그인할 수 있습니다.\n(입력된 이메일: ${email})`
          );
          setLoading(false);
        } else {
          router.push("/dashboard");
        }
      }
    );
    return () => authListener.subscription.unsubscribe();
  }, [router]);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    // 일반 구글 로그인 — 초대 코드 흐름이 아니므로 sessionStorage 클리어
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SS_INVITE_CODE);
      sessionStorage.removeItem(SS_INVITE_ROLE);
    }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (oauthError) {
      setError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f0f1a]">
      {/* 배경 글로우 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.18) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm px-6"
      >
        {/* 카드 */}
        <div
          className="rounded-2xl border border-white/10 p-8 shadow-[0_0_40px_rgba(124,58,237,0.15)]"
          style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(24px)" }}
        >
          {/* 로고 */}
          <div className="mb-8 text-center">
            <p className="text-xs tracking-[0.35em] text-white/40 uppercase mb-1">
              문태고등학교
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white">문파스</h1>
            <p className="mt-2 text-xs text-white/50">
              학교 Google 계정으로 로그인하세요
            </p>
          </div>

          {/* 구글 로그인 버튼 */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/8 px-4 py-3.5 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.2 7.2-10.5 7.2-17.2z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.1 1.4-4.8 2.2-8 2.2-6.1 0-11.3-4.1-13.2-9.7H2.6v6.2C6.5 42.8 14.7 48 24 48z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.8 28.7c-.5-1.4-.7-2.9-.7-4.7s.3-3.3.7-4.7v-6.2H2.6C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.9l8.2-6.2z"
                />
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.6-6.6C35.9 2.5 30.4 0 24 0 14.7 0 6.5 5.2 2.6 13.1l8.2 6.2C12.7 13.6 17.9 9.5 24 9.5z"
                />
              </svg>
            )}
            {loading ? "로그인 중..." : "Google 계정으로 로그인"}
          </button>

          {/* 구분선 */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] uppercase tracking-widest text-white/30">또는</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* 초대 코드 버튼 */}
          <button
            onClick={() => {
              setError(null);
              setInviteOpen(true);
            }}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Ticket className="h-4 w-4" />
            초대 코드로 가입
          </button>

          {/* 에러 메시지 */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-pre-line">{error}</span>
            </motion.div>
          )}

          {/* 안내 문구 */}
          <p className="mt-6 text-center text-[11px] text-white/30">
            학생/교사: @{ALLOWED_DOMAIN} · 학부모/졸업생: 초대 코드
          </p>
        </div>

        {/* 뒤로 가기 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-white/40 transition hover:text-white/70"
          >
            ← 메인으로 돌아가기
          </button>
        </div>
      </motion.div>

      <InviteCodeModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onError={(msg) => setError(msg)}
      />
    </div>
  );
}

// 초대 코드: 소문자 1개 + 숫자 4개 (총 5자, 예: a2957)
const CODE_LEN = 5;
const LETTER_RE = /[a-zA-Z]/;
const DIGIT_RE = /[0-9]/;

function isValidPos(idx: number, ch: string): boolean {
  return idx === 0 ? LETTER_RE.test(ch) : DIGIT_RE.test(ch);
}

function InviteCodeModal({
  open,
  onClose,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [chars, setChars] = useState<string[]>(["", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [lockoutRemain, setLockoutRemain] = useState(0);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // 모달 열릴 때마다 상태 초기화 + 잠금 시간 갱신
  useEffect(() => {
    if (!open) return;
    setChars(["", "", "", "", ""]);
    setLocalError(null);
    setLockoutRemain(readLockoutMs());
    setTimeout(() => inputsRef.current[0]?.focus(), 60);
  }, [open]);

  // 잠금 카운트다운
  useEffect(() => {
    if (!open || lockoutRemain <= 0) return;
    const t = setInterval(() => {
      const r = readLockoutMs();
      setLockoutRemain(r);
      if (r <= 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [open, lockoutRemain]);

  function handleChange(idx: number, raw: string) {
    // 0번 칸은 소문자 1개, 그 외는 숫자 1개. 입력은 항상 소문자로 정규화.
    const cleaned = raw.toLowerCase();
    const ch = cleaned.split("").find((c) => isValidPos(idx, c)) ?? "";
    setChars((prev) => {
      const next = [...prev];
      next[idx] = ch;
      return next;
    });
    if (ch && idx < CODE_LEN - 1) inputsRef.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !chars[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
    if (e.key === "Enter") {
      void handleSubmit();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const raw = e.clipboardData
      .getData("text")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, CODE_LEN);
    if (!raw) return;
    e.preventDefault();
    const next = ["", "", "", "", ""];
    for (let i = 0; i < raw.length; i++) {
      if (isValidPos(i, raw[i])) next[i] = raw[i];
    }
    setChars(next);
    const filled = next.filter(Boolean).length;
    const focusIdx = Math.min(filled, CODE_LEN - 1);
    inputsRef.current[focusIdx]?.focus();
  }

  async function handleSubmit() {
    // 대소문자 구분 없이 매칭하기 위해 소문자로 정규화
    const code = chars.join("").trim().toLowerCase();
    if (code.length !== CODE_LEN || !/^[a-z][0-9]{4}$/.test(code)) {
      setLocalError("형식이 올바르지 않습니다. (영문 1자 + 숫자 4자)");
      return;
    }

    const remain = readLockoutMs();
    if (remain > 0) {
      setLockoutRemain(remain);
      setLocalError("너무 많이 시도했습니다. 10분 후 다시 시도해주세요.");
      return;
    }

    setSubmitting(true);
    setLocalError(null);

    try {
      // invite_codes 테이블 조회
      const { data, error: dbError } = await supabase
        .from("invite_codes")
        .select("id, code, role, max_uses, used_count, expires_at")
        .eq("code", code)
        .maybeSingle();

      if (dbError) {
        console.error("[invite] 조회 실패", dbError);
        setLocalError("코드 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        setSubmitting(false);
        return;
      }

      const valid =
        !!data &&
        (data.max_uses == null || (data.used_count ?? 0) < data.max_uses) &&
        (!data.expires_at || new Date(data.expires_at).getTime() > Date.now());

      if (!valid) {
        bumpAttempts();
        const r = readLockoutMs();
        if (r > 0) {
          setLockoutRemain(r);
          setLocalError("너무 많이 시도했습니다. 10분 후 다시 시도해주세요.");
        } else {
          setLocalError("잘못된 초대 코드입니다.");
        }
        setSubmitting(false);
        return;
      }

      // 검증 통과 — 실패 카운터 초기화 + sessionStorage 저장
      clearAttempts();
      const role: InviteRole = (data!.role as InviteRole) ?? "parent";
      sessionStorage.setItem(SS_INVITE_CODE, code);
      sessionStorage.setItem(SS_INVITE_ROLE, role);

      // Google OAuth 진입
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/login`,
          queryParams: { prompt: "select_account" },
        },
      });

      if (oauthError) {
        sessionStorage.removeItem(SS_INVITE_CODE);
        sessionStorage.removeItem(SS_INVITE_ROLE);
        onError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
        setSubmitting(false);
        onClose();
      }
      // 성공 시 페이지가 OAuth 로 이동하므로 추가 처리 불필요
    } catch (err) {
      console.error("[invite] 예외", err);
      setLocalError("문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  }

  const locked = lockoutRemain > 0;
  const lockMin = Math.ceil(lockoutRemain / 60000);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#16162a] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-full p-1.5 text-white/50 transition hover:bg-white/5 hover:text-white"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-1 flex items-center gap-2 text-violet-400">
              <Ticket className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-widest">
                초대 코드
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">초대 코드를 입력하세요</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/60">
              학부모/졸업생용 5자리 코드를 입력하세요. (영문 1자 + 숫자 4자, 예: a2957)
            </p>

            {/* 5자리 입력: 영문 1 + 숫자 4 */}
            <div className="mt-5 flex items-center justify-center gap-2">
              {chars.map((c, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputsRef.current[i] = el;
                  }}
                  type="text"
                  inputMode={i === 0 ? "text" : "numeric"}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={1}
                  value={c}
                  disabled={submitting || locked}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  className="h-12 w-11 rounded-xl border border-white/10 bg-white/5 text-center text-lg font-bold lowercase text-white focus:border-violet-500 focus:outline-none disabled:opacity-40"
                />
              ))}
            </div>

            {locked && (
              <p className="mt-3 text-xs text-amber-400">
                너무 많이 시도했습니다. {lockMin}분 후 다시 시도해주세요.
              </p>
            )}
            {!locked && localError && (
              <p className="mt-3 text-xs text-red-400">{localError}</p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || locked}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "확인 중..." : "Google 계정으로 가입 진행"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
