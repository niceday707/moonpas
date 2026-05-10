"use client";

// 닉네임 설정/변경 화면.
// - Supabase profiles.nickname 을 직접 UPDATE 한다 (이전엔 localStorage 목업만 호출하던 버그 수정).
// - 쿨다운 정책 폐지 — 언제든 자유롭게 변경 가능.
// - 중복 검사는 supabase-profile.ts 의 updateNicknameInDb 가 자기 자신을 .neq 로 제외해 처리.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  X as XIcon,
} from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { Badge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  normalizeNickname,
  updateMyProfile,
  updateNicknameInDb,
  useSupabaseProfile,
} from "@/lib/supabase-profile";
import { cn } from "@/lib/utils";

// ── 닉네임 형식 검사 (NicknameSetupModal 과 동일 규칙) ──────
// 한글 완성형 + 영문 + 숫자 + 공백, 2~10자.
// 입력 자체는 자유롭게 받지만 검증/저장 직전에 normalizeNickname 으로 정리.
const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9 ]{2,10}$/;
const PROFANITY_LIST = [
  "씨발",
  "시발",
  "병신",
  "개새",
  "fuck",
  "shit",
  "asshole",
];
const RESERVED_NICKNAMES = [
  "관리자",
  "운영자",
  "매니저",
  "admin",
  "moderator",
  "moonpas",
  "문파스",
];

type FormatError = "empty" | "length" | "charset" | "profanity" | "reserved" | "same";

const FORMAT_ERROR_MESSAGES: Record<FormatError, string> = {
  empty: "닉네임을 입력해주세요.",
  length: "닉네임은 2~10자여야 해요.",
  charset: "한글, 영문, 숫자, 공백만 사용할 수 있어요.",
  profanity: "사용할 수 없는 단어가 포함되어 있어요.",
  reserved: "사용할 수 없는 닉네임이에요.",
  same: "지금 쓰고 있는 닉네임과 같아요.",
};

function validateFormat(name: string): FormatError | null {
  // 항상 정규화한 값 기준으로 검증 (앞뒤·연속 공백 차이 무시).
  const trimmed = normalizeNickname(name);
  if (!trimmed) return "empty";
  if (trimmed.length < 2 || trimmed.length > 10) return "length";
  if (!NICKNAME_REGEX.test(trimmed)) return "charset";
  const lower = trimmed.toLowerCase();
  if (PROFANITY_LIST.some((w) => lower.includes(w.toLowerCase()))) {
    return "profanity";
  }
  if (RESERVED_NICKNAMES.some((w) => lower === w.toLowerCase())) {
    return "reserved";
  }
  return null;
}

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
  const router = useRouter();
  const { user, profile, loading, refetch } = useSupabaseProfile();

  // 최초 설정인지 — profiles row 자체가 없으면 true (이 페이지에 들어올 일은 거의 없지만 안전 처리)
  const initialSetup = !profile?.nickname;

  const [name, setName] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // profile 이 처음 도착했을 때 한 번만 기존 닉네임으로 hydrate.
  // 사용자가 입력을 모두 지워서 빈 문자열이 되어도 다시 채워 넣지 않는다.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    if (profile?.nickname) {
      setName(profile.nickname);
      hydrated.current = true;
    }
  }, [profile]);

  // 실시간 형식 검사
  const liveValidation = useMemo<FormatError | null>(() => {
    if (!name) return null;
    const err = validateFormat(name);
    if (err) return err;
    // 변경 모드에서 현재 닉네임과 동일하면 same
    if (
      !initialSetup &&
      profile?.nickname &&
      name.trim() === profile.nickname.trim()
    ) {
      return "same";
    }
    return null;
  }, [name, initialSetup, profile?.nickname]);

  const isValid = !!name.trim() && !liveValidation;
  const errorMessage = serverError ?? (liveValidation ? FORMAT_ERROR_MESSAGES[liveValidation] : null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!user) {
      setServerError("로그인이 필요해요.");
      return;
    }

    // 빈 상태에서 클릭한 경우 — 명시적인 안내 메시지
    const trimmed = normalizeNickname(name);
    if (!trimmed) {
      setServerError("닉네임을 입력해주세요.");
      return;
    }

    // 형식 검사 (라이브 검증과 동일한 규칙)
    const formatErr = validateFormat(trimmed);
    if (formatErr) {
      setServerError(FORMAT_ERROR_MESSAGES[formatErr]);
      return;
    }
    if (
      !initialSetup &&
      profile?.nickname &&
      trimmed === normalizeNickname(profile.nickname)
    ) {
      setServerError(FORMAT_ERROR_MESSAGES.same);
      return;
    }

    setServerError(null);
    setSubmitting(true);
    try {
      const result = await updateNicknameInDb(user.id, trimmed);
      if (result.ok) {
        showToast("닉네임이 변경되었습니다!");
        await refetch();
        // 토스트가 잠깐 보인 뒤 프로필 페이지로 이동
        window.setTimeout(() => router.push("/profile"), 700);
      } else {
        setServerError(result.message);
        console.error("[profile/setup] 닉네임 변경 실패", result);
      }
    } catch (err) {
      console.error("[profile/setup] 예외", err);
      setServerError(
        "닉네임 변경 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // 미리보기에 사용할 표시 닉네임
  const previewNickname = name.trim() || profile?.nickname || "닉네임";

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
          <UserAvatar
            nickname={previewNickname}
            role={profile?.role ?? null}
            avatarUrl={profile?.avatar_url ?? null}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-bold">
                {previewNickname}
              </span>
              {/* "게시판에는 이렇게 표시돼요" 미리보기 — 실제 게시판과 맞춰 public 맥락으로 표시 (admin → 교사) */}
              {profile?.role && <Badge role={profile.role} />}
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
              errorMessage
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
              placeholder={
                initialSetup
                  ? "2~10자, 한글·영문·숫자·공백"
                  : "새 닉네임을 입력하세요"
              }
              maxLength={20}
              disabled={submitting || loading}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/35 disabled:opacity-60"
            />
            {name && !errorMessage && isValid && (
              <Check className="h-4 w-4 text-emerald-500" />
            )}
            {errorMessage && <XIcon className="h-4 w-4 text-rose-500" />}
          </div>

          {/* 안내/에러 메시지 */}
          <p
            className={cn(
              "min-h-[18px] whitespace-pre-line text-[11px]",
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
                : "2~10자, 한글·영문·숫자·공백 조합으로 입력해주세요"}
          </p>

          {/* 제출 — 빈 상태에서도 클릭 허용 (submit 핸들러가 안내 메시지 표시) */}
          <button
            type="submit"
            disabled={submitting || loading}
            className={cn(
              "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white transition-opacity",
              "bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] shadow-[0_6px_20px_rgba(124,58,237,0.4)]",
              isValid ? "" : "opacity-80",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting
              ? "저장 중…"
              : initialSetup
                ? "닉네임 사용하기"
                : "닉네임 변경하기"}
          </button>
        </form>
      </motion.div>

      {/* 추가 프로필 정보 (한줄소개 / 학년 / 생일 / 공개 토글) */}
      <ProfileExtraSection user={user} profile={profile} onSaved={refetch} onToast={showToast} />

      {/* 토스트 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none fixed inset-x-0 bottom-10 z-50 flex justify-center px-4"
          >
            <div className="rounded-full border border-white/15 bg-black/85 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md">
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ─────────────────────────────────────────────
// 추가 프로필 정보 — 한줄소개 / 학년 / 생일 / 공개 토글
// ─────────────────────────────────────────────

const BIO_MAX = 30;

type ProfileForExtras = {
  bio: string | null;
  grade: number | null;
  birth_month: number | null;
  birth_day: number | null;
  show_grade: boolean;
  show_stats: boolean;
} | null;

function ProfileExtraSection({
  user,
  profile,
  onSaved,
  onToast,
}: {
  user: { id: string } | null;
  profile: ProfileForExtras;
  onSaved: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [bio, setBio] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [birthMonth, setBirthMonth] = useState<number | null>(null);
  const [birthDay, setBirthDay] = useState<number | null>(null);
  const [showGrade, setShowGrade] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current || !profile) return;
    setBio(profile.bio ?? "");
    setGrade(profile.grade ?? null);
    setBirthMonth(profile.birth_month ?? null);
    setBirthDay(profile.birth_day ?? null);
    setShowGrade(!!profile.show_grade);
    setShowStats(!!profile.show_stats);
    hydrated.current = true;
  }, [profile]);

  // bio 길이 라이브 체크
  const bioOver = bio.length > BIO_MAX;

  // 생일 월/일 짝 검사 — DB CHECK 와 동일 규칙: 둘 다 있거나 둘 다 없어야 함.
  const birthPairBroken =
    (birthMonth !== null && birthDay === null) ||
    (birthMonth === null && birthDay !== null);

  // 월별 마지막 날짜 — 윤년 무시 (학생 입력용 단순 가드).
  const maxDay =
    birthMonth === null
      ? 31
      : [1, 3, 5, 7, 8, 10, 12].includes(birthMonth)
        ? 31
        : birthMonth === 2
          ? 29
          : 30;
  const dayOutOfRange = birthDay !== null && birthDay > maxDay;

  const canSave = !saving && !bioOver && !birthPairBroken && !dayOutOfRange;

  async function handleSave() {
    if (!user) {
      setServerError("로그인이 필요해요.");
      return;
    }
    if (!canSave) return;

    setServerError(null);
    setSaving(true);
    const trimmedBio = bio.trim();
    const { error } = await updateMyProfile(user.id, {
      bio: trimmedBio.length === 0 ? null : trimmedBio,
      grade,
      birth_month: birthMonth,
      birth_day: birthDay,
      show_grade: showGrade,
      show_stats: showStats,
    });
    setSaving(false);
    if (error) {
      setServerError(`저장에 실패했어요. ${error}`);
      return;
    }
    await onSaved();
    onToast("프로필이 저장되었습니다!");
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="glass mt-4 rounded-3xl p-6 md:p-8"
    >
      <h2 className="text-base font-extrabold tracking-tight md:text-lg">
        프로필 상세
      </h2>
      <p className="mt-0.5 text-xs text-foreground/55">
        한줄 소개·학년·생일을 추가하면 더 풍부한 프로필 카드가 표시돼요.
      </p>

      {/* 한줄 소개 */}
      <div className="mt-5">
        <label htmlFor="bio" className="text-xs font-semibold text-foreground/70">
          한줄 소개 <span className="text-foreground/40">(선택, 최대 {BIO_MAX}자)</span>
        </label>
        <input
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={BIO_MAX + 5} /* 살짝 여유 두고 마지막 차단은 length 검사로 */
          placeholder="예: 수학 좋아하는 2학년"
          className={cn(
            "mt-1.5 block w-full rounded-2xl bg-foreground/5 px-4 py-2.5 text-sm outline-none ring-1 ring-inset transition-colors",
            bioOver
              ? "ring-rose-500/50 focus:ring-rose-500/60"
              : "ring-transparent focus:ring-violet-500/40",
          )}
        />
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className={bioOver ? "text-rose-500" : "text-foreground/45"}>
            {bioOver
              ? `${BIO_MAX}자 이하로 줄여주세요`
              : '비워두면 카드에 "소개가 없습니다"로 표시돼요'}
          </span>
          <span className={cn("tabular-nums", bioOver ? "text-rose-500" : "text-foreground/45")}>
            {bio.length}/{BIO_MAX}
          </span>
        </div>
      </div>

      {/* 학년 */}
      <div className="mt-5">
        <label className="text-xs font-semibold text-foreground/70">학년 (선택)</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {[null, 1, 2, 3].map((g) => {
            const active = grade === g;
            const label = g === null ? "선택 안 함" : `${g}학년`;
            return (
              <button
                key={String(g)}
                type="button"
                onClick={() => setGrade(g)}
                className={cn(
                  "rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors",
                  active
                    ? "bg-violet-600 text-white shadow-[0_4px_14px_rgba(124,58,237,0.4)]"
                    : "bg-foreground/5 text-foreground/70 hover:bg-foreground/10",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 생일 (월 / 일) */}
      <div className="mt-5">
        <label className="text-xs font-semibold text-foreground/70">
          생일 <span className="text-foreground/40">(선택 · 항상 비공개, 오늘의 생일 이벤트에만 사용)</span>
        </label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <select
            value={birthMonth ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setBirthMonth(v === "" ? null : Number(v));
            }}
            className="rounded-2xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-inset ring-transparent focus:ring-violet-500/40"
          >
            <option value="">월 선택</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
          <select
            value={birthDay ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setBirthDay(v === "" ? null : Number(v));
            }}
            className="rounded-2xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-inset ring-transparent focus:ring-violet-500/40"
          >
            <option value="">일 선택</option>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}일
              </option>
            ))}
          </select>
        </div>
        {birthPairBroken && (
          <p className="mt-1 text-[11px] text-rose-500">
            월과 일을 모두 선택하거나 둘 다 비워주세요.
          </p>
        )}
        {dayOutOfRange && (
          <p className="mt-1 text-[11px] text-rose-500">
            {birthMonth}월에는 {maxDay}일까지만 있어요.
          </p>
        )}
      </div>

      {/* 공개 토글 */}
      <div className="mt-6 space-y-3">
        <ToggleRow
          label="학년 공개"
          desc={'끄면 다른 사용자에게 학년이 "비공개"로 표시돼요.'}
          checked={showGrade}
          onChange={setShowGrade}
        />
        <ToggleRow
          label="활동통계 공개"
          desc="쓴 글·쓴 댓글·받은 좋아요 수치 공개 여부."
          checked={showStats}
          onChange={setShowStats}
        />
      </div>

      {serverError && (
        <p className="mt-4 text-[12px] text-rose-500">{serverError}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className={cn(
          "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white transition-opacity",
          "bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] shadow-[0_6px_20px_rgba(124,58,237,0.4)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? "저장 중…" : "프로필 저장"}
      </button>
    </motion.section>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl bg-foreground/[0.03] px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/55">
          {desc}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-violet-600" : "bg-foreground/20",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
