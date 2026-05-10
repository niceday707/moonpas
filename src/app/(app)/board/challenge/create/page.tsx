"use client";

// 챌린지 개설 페이지 — /board/challenge/create
// 제목, 설명, 이모지, 태그, 기간, 공개 설정, 친구 초대까지 한 화면에서 처리.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useSupabaseProfile } from "@/lib/supabase-profile";
import { cn } from "@/lib/utils";
import {
  CHALLENGE_TAGS,
  createChallenge,
  inviteToChallenge,
  type ChallengeTagKey,
} from "@/lib/challenge";
import {
  searchMentionableUsers,
  type MentionUser,
} from "@/lib/mentions";

const EMOJI_OPTIONS = [
  "🔥", "📚", "💪", "🏃‍♂️", "📖", "✏️", "🎯",
  "⏰", "🧘‍♂️", "🏋️", "🎨", "🧪", "🗣️", "🔢",
];

const DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 7, label: "7일" },
  { value: 14, label: "14일" },
  { value: 30, label: "30일" },
  { value: 9999, label: "무제한" },
];

interface InvitedFriend {
  id: string;
  nickname: string;
}

export default function ChallengeCreatePage() {
  return (
    <AuthGate
      title="챌린지 개설은 로그인이 필요합니다"
      description="로그인 후 새 챌린지를 만들 수 있어요."
    >
      <ChallengeCreateInner />
    </AuthGate>
  );
}

function ChallengeCreateInner() {
  const router = useRouter();
  const { user, profile } = useSupabaseProfile();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🔥");
  const [tags, setTags] = useState<ChallengeTagKey[]>([]);
  const [duration, setDuration] = useState<number>(14);
  const [isPublic, setIsPublic] = useState(true);

  const [invited, setInvited] = useState<InvitedFriend[]>([]);
  const [mentionInput, setMentionInput] = useState("");
  const [mentionResults, setMentionResults] = useState<MentionUser[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const mentionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // @멘션 검색 — 입력값이 바뀔 때 디바운스 후 RPC 호출
  useEffect(() => {
    if (mentionDebounce.current) clearTimeout(mentionDebounce.current);
    if (!mentionInput.trim() || !user) {
      setMentionResults([]);
      setShowMentionDropdown(false);
      return;
    }
    mentionDebounce.current = setTimeout(() => {
      searchMentionableUsers({
        query: mentionInput.trim(),
        // 챌린지 검색에서는 postId 가 의미 없으므로 빈 UUID 형태로 패스. RPC 가 없으면 0 매칭.
        postId: "00000000-0000-0000-0000-000000000000",
        currentUserId: user.id,
      }).then((users) => {
        // 이미 초대 목록에 있는 사람 / 본인 제외
        const filtered = users.filter(
          (u) => u.id !== user.id && !invited.some((i) => i.id === u.id),
        );
        setMentionResults(filtered);
        setShowMentionDropdown(filtered.length > 0);
      });
    }, 200);
    return () => {
      if (mentionDebounce.current) clearTimeout(mentionDebounce.current);
    };
  }, [mentionInput, user, invited]);

  function toggleTag(key: ChallengeTagKey) {
    setTags((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function addInvitedFriend(u: MentionUser) {
    setInvited((prev) =>
      prev.some((p) => p.id === u.id) ? prev : [...prev, { id: u.id, nickname: u.nickname }],
    );
    setMentionInput("");
    setMentionResults([]);
    setShowMentionDropdown(false);
  }

  function removeInvitedFriend(id: string) {
    setInvited((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleSubmit() {
    setError(null);
    if (!title.trim()) {
      setError("챌린지 이름을 입력해주세요.");
      return;
    }
    if (!user || !profile) {
      setError("로그인이 필요합니다.");
      return;
    }
    setSubmitting(true);
    const { id, error: e } = await createChallenge({
      title: title.trim(),
      description: description.trim() || undefined,
      emoji,
      duration_days: duration,
      is_public: isPublic,
      tags,
    });
    if (e || !id) {
      setSubmitting(false);
      setError(e ?? "챌린지 개설에 실패했어요.");
      return;
    }

    if (invited.length > 0) {
      await inviteToChallenge(
        id,
        title.trim(),
        profile.nickname ?? "친구",
        invited.map((f) => f.id),
      );
    }
    router.push(`/board/challenge/${id}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-screen-md px-4 py-6"
    >
      <Link
        href="/board/challenge"
        className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-800 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        챌린지로 돌아가기
      </Link>
      <h1 className="mt-2 text-xl font-extrabold text-gray-900 dark:text-white">
        새 챌린지 만들기 🎯
      </h1>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        나만의 챌린지를 만들고 친구들을 초대해보세요.
      </p>

      <div className="mt-5 space-y-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.07] dark:bg-[#16162a]">
        {/* 1. 이름 */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            챌린지 이름 (필수)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="영단어 매일 30개 외우기"
            maxLength={30}
            disabled={submitting}
            className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          />
          <p className="mt-1 text-[10px] text-gray-400">{title.length}/30</p>
        </div>

        {/* 2. 설명 */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            설명 (선택)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="챌린지 규칙이나 목표를 적어주세요"
            maxLength={200}
            rows={4}
            disabled={submitting}
            className="mt-1.5 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          />
          <p className="mt-1 text-[10px] text-gray-400">{description.length}/200</p>
        </div>

        {/* 3. 이모지 */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            대표 이모지
          </label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {EMOJI_OPTIONS.map((e) => {
              const active = emoji === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  disabled={submitting}
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-xl text-xl transition disabled:opacity-50",
                    active
                      ? "bg-violet-500/15 ring-2 ring-violet-500"
                      : "bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1]",
                  )}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. 태그 */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            태그 (복수 가능)
          </label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CHALLENGE_TAGS.map((t) => {
              const active = tags.includes(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggleTag(t.key)}
                  disabled={submitting}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                    active
                      ? "bg-violet-100 text-violet-700 ring-1 ring-violet-400 dark:bg-violet-900/30 dark:text-violet-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/[0.05] dark:text-gray-300 dark:hover:bg-white/[0.1]",
                  )}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
          {tags.length > 0 && (
            <p className="mt-2 text-[10px] text-gray-400">
              선택된 태그: {tags.length}개 — 챌린지 설명 앞에 자동으로 표시됩니다.
            </p>
          )}
        </div>

        {/* 5. 기간 */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            기간
          </label>
          <div className="mt-1.5 grid grid-cols-4 gap-2">
            {DURATION_OPTIONS.map((opt) => {
              const active = duration === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  disabled={submitting}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50",
                    active
                      ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. 공개 설정 */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            공개 설정
          </label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              disabled={submitting}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50",
                isPublic
                  ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
              )}
            >
              🌐 전체 공개
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              disabled={submitting}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50",
                !isPublic
                  ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
              )}
            >
              🔒 초대만
            </button>
          </div>
        </div>

        {/* 7. 친구 초대 */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            친구 초대 (선택)
          </label>
          <div className="relative mt-1.5">
            <input
              type="text"
              value={mentionInput}
              onChange={(e) => {
                const v = e.target.value;
                // @ 로 시작하면 @ 제거, 그렇지 않으면 그대로 — 사용자가 @ 없이 입력해도 검색
                setMentionInput(v.startsWith("@") ? v.slice(1) : v);
              }}
              placeholder="@닉네임 으로 친구를 검색해보세요"
              disabled={submitting}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            />
            {showMentionDropdown && mentionResults.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#1a1a2e]">
                {mentionResults.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => addInvitedFriend(u)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20"
                    >
                      <span className="font-semibold text-gray-800 dark:text-gray-100">
                        @{u.nickname}
                      </span>
                      <span className="text-[10px] text-gray-400">{u.role}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {invited.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {invited.map((f) => (
                <span
                  key={f.id}
                  className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-200"
                >
                  @{f.nickname}
                  <button
                    type="button"
                    onClick={() => removeInvitedFriend(f.id)}
                    aria-label="초대 취소"
                    className="grid h-4 w-4 place-items-center rounded-full hover:bg-violet-200 dark:hover:bg-violet-800/40"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href="/board/challenge"
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.05]"
          >
            취소
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            챌린지 만들기
          </button>
        </div>
      </div>
    </motion.div>
  );
}
