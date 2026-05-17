"use client";

// ============================================================================
// 문태 미디어 — 댓글/답글 입력창 (멘션 자동완성 포함)
// ----------------------------------------------------------------------------
// · 유튜브 Shorts/롱폼 댓글창과 같은 톤. 하단 고정 변형도 prop 으로 지원.
// · @ 입력 시 닉네임 자동완성 드롭다운 — search_mentionable_users RPC 활용.
//   (postId 가 없으므로 빈 문자열 + 일반 게시판 작성자 우선 결과를 받지만,
//    moontube 영상 컨텍스트에서는 닉네임 일치만 활용한다.)
// · 답글 모드면 입력값이 "@닉네임 " 으로 자동 시작. 본인이 지우면 멘션 해제.
// · 금지어(muntz-profanity) 1차 차단.
// · 모바일 키보드(visualViewport)는 fixed 변형에서만 추적.
// ============================================================================

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Send, X as XIcon } from "lucide-react";
import {
  getActiveMention,
  searchMentionableUsers,
  type MentionUser,
} from "@/lib/mentions";
import { findBannedWordInFields } from "@/lib/muntz-profanity";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export type ReplyTarget = {
  parentId: string;
  nickname: string;
  mentionUserId?: string | null;
};

type Props = {
  /** 입력 가능한 사용자 id (미로그인이면 null — 비활성) */
  userId: string | null;
  /** 답글 대상. null 이면 일반 댓글. */
  replyTo?: ReplyTarget | null;
  /** 답글 취소 (X 버튼). 호출 측에서 replyTo 를 null 로 바꾼다. */
  onCancelReply?: () => void;
  /** 댓글/답글 작성 */
  onSubmit: (
    text: string,
    options?: { parentId?: string | null; mentionUserId?: string | null },
  ) => Promise<{ ok: boolean; message?: string }>;
  placeholder?: string;
  /** 댓글 시트 하단 고정 모드 */
  variant?: "inline" | "sheet";
  /** 사용자 본인의 아바타 정보 (좌측 표시용, sheet 모드만) */
  selfAvatar?: {
    nickname?: string | null;
    role?: import("@/components/ui/Badge").Role | null;
    avatarUrl?: string | null;
  };
};

export function CommentInput({
  userId,
  replyTo,
  onCancelReply,
  onSubmit,
  placeholder = "댓글 추가...",
  variant = "inline",
  selfAvatar,
}: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caret, setCaret] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastReplyKey = useRef<string | null>(null);

  // ── 답글 모드 → "@닉네임 " prefix 자동 삽입 + 포커스 ───────────────────
  useEffect(() => {
    if (!replyTo) {
      lastReplyKey.current = null;
      return;
    }
    const key = `${replyTo.parentId}::${replyTo.nickname}`;
    if (lastReplyKey.current === key) return;
    lastReplyKey.current = key;
    const prefix = `@${replyTo.nickname} `;
    setText((curr) => {
      // 이전 prefix 가 남아 있으면 갈아끼움
      const stripped = curr.replace(/^@\S+\s+/, "");
      return prefix + stripped;
    });
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(prefix.length, prefix.length);
        setCaret(prefix.length);
      } catch {
        /* 일부 구형 모바일 브라우저 미지원 */
      }
    });
  }, [replyTo]);

  // ── 멘션 자동완성 ──────────────────────────────────────────────────────
  const [mentionResults, setMentionResults] = useState<MentionUser[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);

  const activeMention = useMemo(
    () => getActiveMention(text, caret),
    [text, caret],
  );

  useEffect(() => {
    setMentionActiveIdx(0);
  }, [activeMention?.start, activeMention?.query]);

  // 300ms 디바운스 — postId 없이도 닉네임 검색은 가능.
  const mentionQuery = activeMention?.query ?? null;
  useEffect(() => {
    if (mentionQuery === null || !userId) {
      setMentionResults([]);
      setMentionLoading(false);
      return;
    }
    setMentionLoading(true);
    const t = window.setTimeout(async () => {
      const rows = await searchMentionableUsers({
        query: mentionQuery,
        // 영상 댓글은 게시글 컨텍스트가 없으므로 빈 uuid 전달.
        // RPC 가 post 컨텍스트 매칭에 실패해도 닉네임 일치 결과는 돌아옴.
        postId: "00000000-0000-0000-0000-000000000000",
        currentUserId: userId,
      });
      setMentionResults(rows);
      setMentionLoading(false);
    }, 300);
    return () => window.clearTimeout(t);
  }, [mentionQuery, userId]);

  function syncCaret() {
    const el = inputRef.current;
    if (!el) return;
    setCaret(el.selectionStart ?? 0);
  }

  function insertMention(user: MentionUser) {
    if (!activeMention) return;
    const { start, end } = activeMention;
    const inserted = `@${user.nickname} `;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const next = before + inserted + after;
    const newCaret = before.length + inserted.length;
    setText(next);
    setMentionResults([]);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(newCaret, newCaret);
        setCaret(newCaret);
      } catch {
        /* ignore */
      }
    });
  }

  function closeDropdown() {
    setMentionResults([]);
    setMentionLoading(false);
  }

  // ── visualViewport 키보드 추적 (sheet 변형) ────────────────────────────
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    if (variant !== "sheet") return;
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const off = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardOffset(Math.max(0, Math.round(off)));
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [variant]);

  async function submit(e?: FormEvent) {
    if (e) e.preventDefault();
    const t = text.trim();
    if (!t || busy || !userId) return;
    const banned = findBannedWordInFields([t]);
    if (banned) {
      setError(`부적절한 단어가 포함되어 있어요: "${banned}"`);
      return;
    }
    setBusy(true);
    const res = await onSubmit(t, {
      parentId: replyTo?.parentId ?? null,
      mentionUserId: replyTo?.mentionUserId ?? null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? "댓글 등록에 실패했어요.");
      return;
    }
    setText("");
    setError(null);
    closeDropdown();
    if (replyTo && onCancelReply) onCancelReply();
  }

  const canSend = !!text.trim() && !!userId && !busy;
  const showDropdown =
    !!activeMention &&
    (mentionLoading ||
      mentionResults.length > 0 ||
      activeMention.query.length > 0);

  // ── 렌더 ───────────────────────────────────────────────────────────────
  const inputRow = (
    <form onSubmit={submit} className="relative">
      {/* @멘션 드롭다운 — 입력행 바로 위 */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-x-0 bottom-full mb-2 px-2"
          >
            <div className="mx-auto max-h-[200px] overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900/95 shadow-xl backdrop-blur-md">
              {mentionResults.length === 0 ? (
                <p className="px-3 py-3 text-center text-xs text-white/45">
                  {mentionLoading ? "검색 중…" : "일치하는 사용자가 없습니다"}
                </p>
              ) : (
                <ul>
                  {mentionResults.map((u, i) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertMention(u)}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
                          i === mentionActiveIdx
                            ? "bg-violet-500/15"
                            : "hover:bg-white/[0.04]",
                        )}
                      >
                        <UserAvatar
                          nickname={u.nickname}
                          role={u.role}
                          avatarUrl={u.avatar_url}
                          size="xs"
                        />
                        <span className="text-sm font-semibold text-white">
                          {u.nickname}
                        </span>
                        <Badge
                          role={u.role}
                          className="px-1.5 py-0 text-[9px]"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 답글 모드 배너 */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5 text-[11px] text-white/60">
              <span>
                <span className="font-semibold text-violet-300">
                  @{replyTo.nickname}
                </span>
                {"에게 답글 작성 중"}
              </span>
              <button
                type="button"
                onClick={onCancelReply}
                aria-label="답글 취소"
                className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full text-white/45 hover:bg-white/10 hover:text-white"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2 px-3 py-2">
        {variant === "sheet" && (
          <div className="shrink-0 pb-1">
            <UserAvatar
              nickname={selfAvatar?.nickname ?? "나"}
              role={selfAvatar?.role ?? "student"}
              avatarUrl={selfAvatar?.avatarUrl ?? null}
              size="sm"
            />
          </div>
        )}
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
            requestAnimationFrame(syncCaret);
          }}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          onSelect={syncCaret}
          onBlur={() => window.setTimeout(closeDropdown, 100)}
          onKeyDown={(e) => {
            if (showDropdown && mentionResults.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionActiveIdx((i) =>
                  Math.min(i + 1, mentionResults.length - 1),
                );
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionActiveIdx((i) => Math.max(i - 1, 0));
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const u = mentionResults[mentionActiveIdx];
                if (u) insertMention(u);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                closeDropdown();
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={userId ? placeholder : "로그인 후 댓글을 작성할 수 있어요"}
          disabled={!userId || busy}
          rows={1}
          maxLength={1000}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            "min-h-[36px] max-h-32 flex-1 resize-none rounded-2xl px-3 py-2 text-sm leading-relaxed outline-none transition-colors",
            "border border-white/10 bg-white/[0.07] text-white placeholder:text-white/35",
            "focus:border-violet-400/50 focus:bg-white/[0.09]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          style={{ scrollbarWidth: "none", colorScheme: "dark" }}
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="댓글 등록"
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full transition-all",
            canSend
              ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_0_14px_rgba(124,58,237,0.4)] hover:brightness-110"
              : "bg-white/[0.07] text-white/30",
            "disabled:cursor-not-allowed",
          )}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      {error && (
        <p className="px-4 pb-2 text-[11px] font-semibold text-rose-300">
          {error}
        </p>
      )}
    </form>
  );

  if (variant === "sheet") {
    return (
      <div
        className="border-t border-white/10 bg-neutral-950/95 backdrop-blur-md"
        style={{
          paddingBottom:
            keyboardOffset > 0
              ? keyboardOffset
              : "env(safe-area-inset-bottom)",
        }}
      >
        {inputRow}
      </div>
    );
  }

  return inputRow;
}
