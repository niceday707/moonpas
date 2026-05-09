"use client";

// 인스타그램 스타일 하단 고정 댓글 입력바.
// - visualViewport API 로 모바일 가상 키보드 높이를 추적해 입력바를 키보드 바로 위에 위치시킴.
// - 답글 모드: 입력 필드에 "@닉네임 " 자동 입력 + 위쪽 배너에 "OOO에게 답글 작성 중" + 취소 버튼.
// - @멘션 자동완성: 캐럿 앞 @토큰을 감지해 텍스트에어리어 위에 드롭다운 표시 (300ms 디바운스).
//   · 익명 게시판은 enableMentions={false} 로 비활성.
// - 라이트(일반 게시판) / 다크(익명 게시판) 테마 지원.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Send, X as XIcon } from "lucide-react";
import { createComment } from "@/lib/board";
import {
  getActiveMention,
  saveMentionsAndNotify,
  searchMentionableUsers,
  type MentionUser,
} from "@/lib/mentions";
import { notifyComment, notifyReply } from "@/lib/notify";
import { Badge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/utils";

/**
 * 답글 대상.
 *   id            : DB 에 저장될 parent_id — 항상 "최상위 댓글의 id" 여야 한다.
 *                   답글의 답글이라도 호출 측이 root 로 평탄화해서 넘겨준다.
 *   label         : 입력창에 자동 삽입될 "@라벨 " 의 라벨. 대상 닉네임/익명N 모두 가능.
 *   mentionUserId : "@닉네임" 으로 호명된 실제 사용자의 id (구조화 포인터, 선택).
 *                   익명 게시판은 항상 null.
 */
export type ReplyTarget = {
  id: string;
  label: string;
  mentionUserId?: string | null;
};

type Props = {
  postId: string;
  /** 작성자 식별자. null 이면 입력 비활성화. */
  userId: string | null;
  /** 답글 대상. null 이면 일반 댓글. */
  replyTo: ReplyTarget | null;
  /** 답글 모드 취소 (X 버튼 / 작성 완료 시 호출) */
  onCancelReply: () => void;
  /** 작성 완료 — 부모가 목록 새로고침 + 마지막 댓글로 스크롤 */
  onSubmitted: () => void | Promise<void>;
  /** 좌측 아바타 영역 (UserAvatar 또는 익명 아이콘) */
  avatar: React.ReactNode;
  /** 입력창 포커스 시 부모가 댓글 목록 자동 스크롤 트리거 */
  onFocus?: () => void;
  theme?: "light" | "dark";
  placeholder?: string;
  /** @멘션 자동완성 활성 여부. 익명 게시판은 false. 기본 true. */
  enableMentions?: boolean;
  /** 멘션 알림 message 에 들어갈 작성자 닉네임 */
  actorNickname?: string | null;
};

export function CommentComposer({
  postId,
  userId,
  replyTo,
  onCancelReply,
  onSubmitted,
  avatar,
  onFocus,
  theme = "light",
  placeholder = "댓글을 입력하세요...",
  enableMentions = true,
  actorNickname,
}: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  /** 가상 키보드가 가린 viewport 하단 영역 높이(px). 키보드 닫히면 0. */
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [caret, setCaret] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // 인스타 스타일 평탄화 답글에서는 여러 답글이 같은 parent_id(=root) 를 공유하므로,
  // id 가 아닌 (id + label + mentionUserId) 합성 키로 prefix 재삽입 여부를 판단해야
  // 같은 루트 안 다른 답글 버튼을 눌렀을 때 "@닉네임 " 이 갱신된다.
  const lastReplyKey = useRef<string | null>(null);

  // ── 멘션 검색 상태 ────────────────────────────────────────
  const [mentionResults, setMentionResults] = useState<MentionUser[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);

  /** 현재 입력 중인 @토큰 (멘션이 비활성이면 항상 null) */
  const activeMention = useMemo(() => {
    if (!enableMentions) return null;
    return getActiveMention(text, caret);
  }, [enableMentions, text, caret]);

  // 활성 토큰이 바뀌면 인덱스 리셋
  useEffect(() => {
    setMentionActiveIdx(0);
  }, [activeMention?.start, activeMention?.query]);

  // ── visualViewport 로 모바일 키보드 추적 ─────────────────
  useEffect(() => {
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
  }, []);

  // ── 답글 타겟 변경 → "@닉네임 " 프리픽스 자동 입력 + 포커스 ──
  useEffect(() => {
    if (!replyTo) {
      lastReplyKey.current = null;
      return;
    }
    const key = `${replyTo.id}::${replyTo.label}::${replyTo.mentionUserId ?? ""}`;
    if (lastReplyKey.current === key) return;
    lastReplyKey.current = key;
    const prefix = `@${replyTo.label} `;
    setText((curr) => {
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
        /* 일부 모바일 브라우저에서 setSelectionRange 미지원 — 무시 */
      }
    });
  }, [replyTo]);

  // ── 멘션 검색 (300ms 디바운스) ────────────────────────────
  // 의존성을 query/start 만으로 좁혀, 캐럿이 같은 토큰 안에서 움직일 때 재검색을 막는다.
  const mentionQuery = activeMention?.query ?? null;
  const mentionStart = activeMention?.start ?? null;
  useEffect(() => {
    if (!enableMentions || mentionQuery === null || !userId) {
      setMentionResults([]);
      setMentionLoading(false);
      return;
    }
    setMentionLoading(true);
    const t = window.setTimeout(async () => {
      const rows = await searchMentionableUsers({
        query: mentionQuery,
        postId,
        currentUserId: userId,
      });
      setMentionResults(rows);
      setMentionLoading(false);
    }, 300);
    return () => window.clearTimeout(t);
  }, [enableMentions, mentionQuery, mentionStart, postId, userId]);

  function handleCancelReply() {
    setText((curr) => curr.replace(/^@\S+\s+/, ""));
    onCancelReply();
  }

  /** 캐럿 위치 동기화 — selectionStart 가 곧 caret. */
  function syncCaret() {
    const el = inputRef.current;
    if (!el) return;
    setCaret(el.selectionStart ?? 0);
  }

  /** 드롭다운에서 멘션 항목 선택 시 텍스트 치환 */
  function insertMention(user: MentionUser) {
    if (!activeMention) return;
    const { start, end } = activeMention;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const inserted = `@${user.nickname} `;
    const newText = before + inserted + after;
    const newCaret = before.length + inserted.length;
    setText(newText);
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

  async function submit() {
    const t = text.trim();
    if (!t || busy || !userId) return;
    setBusy(true);
    const { error, commentId } = await createComment({
      authorId: userId,
      postId,
      content: t,
      parentId: replyTo?.id ?? null,
      mentionUserId: replyTo?.mentionUserId ?? null,
    });
    setBusy(false);
    if (error) {
      window.alert("댓글 작성에 실패했어요.");
      return;
    }

    // ── 알림 생성 ─────────────────────────────────────────
    // 부드러운 UX 를 위해 모두 await 하지 않음 (실패해도 댓글 작성은 성공 처리)
    if (commentId) {
      const actor = actorNickname?.trim() || "누군가";

      // 답글이면 부모 댓글 작성자 + mention_user_id 에게 reply 알림,
      // 일반 댓글이면 글 작성자에게 comment 알림.
      // (notify.ts 가 익명 게시판/자기 자신/수신자 설정 모두 가드)
      if (replyTo) {
        notifyReply({
          postId,
          parentCommentId: replyTo.id,
          mentionUserId: replyTo.mentionUserId ?? null,
          commentId,
          actorId: userId,
          actorNickname: actor,
        });
      } else {
        notifyComment({
          postId,
          commentId,
          actorId: userId,
          actorNickname: actor,
        });
      }

      // 본문에서 추출한 @닉네임 별도 처리 (멘션 알림). 익명 게시판은 비활성.
      if (enableMentions) {
        saveMentionsAndNotify({
          commentId,
          postId,
          authorId: userId,
          authorNickname: actor,
          content: t,
        });
      }
    }

    setText("");
    setCaret(0);
    closeDropdown();
    if (replyTo) onCancelReply();
    await onSubmitted();
  }

  const isLight = theme === "light";
  const disabled = !userId || busy;
  const canSend = !!text.trim() && !disabled;

  // 드롭다운 노출 조건: 활성 토큰 있음 + (로딩 중 OR 결과 있음 OR 검색어 있어 "결과 없음" 표시)
  const showDropdown =
    !!activeMention &&
    enableMentions &&
    (mentionLoading ||
      mentionResults.length > 0 ||
      activeMention.query.length > 0);

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-40",
        isLight
          ? "border-t border-gray-200 bg-white/95 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#0f0f1a]/95"
          : "border-t border-white/[0.07] backdrop-blur-2xl",
      )}
      style={{
        bottom: keyboardOffset,
        paddingBottom: keyboardOffset > 0 ? 0 : "env(safe-area-inset-bottom)",
        background: isLight ? undefined : "rgba(15,12,41,0.92)",
      }}
    >
      {/* @멘션 드롭다운 — 입력바 바로 위에 absolute */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-x-0 bottom-full px-3 pb-2 sm:px-4"
          >
            <div
              className={cn(
                "pointer-events-auto mx-auto max-h-[200px] max-w-screen-md overflow-y-auto rounded-2xl border shadow-xl",
                isLight
                  ? "border-gray-200 bg-white dark:border-white/[0.1] dark:bg-[#16162a]"
                  : "border-white/[0.1] bg-[#13132a]",
              )}
            >
              {mentionResults.length === 0 ? (
                <p
                  className={cn(
                    "px-3 py-3 text-center text-xs",
                    isLight ? "text-gray-400" : "text-white/40",
                  )}
                >
                  {mentionLoading
                    ? "검색 중…"
                    : "일치하는 사용자가 없습니다"}
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
                            ? isLight
                              ? "bg-violet-50 dark:bg-violet-500/15"
                              : "bg-violet-500/15"
                            : isLight
                              ? "hover:bg-gray-50 dark:hover:bg-white/[0.04]"
                              : "hover:bg-white/[0.04]",
                        )}
                      >
                        <UserAvatar
                          nickname={u.nickname}
                          role={u.role}
                          avatarUrl={u.avatar_url}
                          size="xs"
                        />
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            isLight
                              ? "text-gray-900 dark:text-white"
                              : "text-white",
                          )}
                        >
                          {u.nickname}
                        </span>
                        <Badge
                          role={u.role}
                          className="text-[9px] py-0 px-1.5"
                        />
                        {u.is_commenter && (
                          <span
                            className={cn(
                              "ml-auto text-[10px] font-semibold",
                              isLight
                                ? "text-violet-500 dark:text-violet-300"
                                : "text-violet-300",
                            )}
                          >
                            이 글 댓글 작성자
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 답글 작성 중 배너 */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "mx-auto flex max-w-screen-md items-center gap-2 px-4 py-2 text-[11px]",
                isLight
                  ? "border-b border-gray-100 bg-violet-50/80 text-gray-600 dark:border-white/[0.05] dark:bg-violet-500/[0.07] dark:text-gray-300"
                  : "border-b border-white/[0.05] text-white/55",
              )}
            >
              <span>
                <span
                  className={cn(
                    "font-semibold",
                    isLight
                      ? "text-violet-600 dark:text-violet-300"
                      : "text-violet-300",
                  )}
                >
                  {replyTo.label}
                </span>
                {"에게 답글 작성 중"}
              </span>
              <button
                type="button"
                onClick={handleCancelReply}
                aria-label="답글 취소"
                className={cn(
                  "ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors",
                  isLight
                    ? "text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.08]"
                    : "text-white/40 hover:bg-white/[0.08] hover:text-white/85",
                )}
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 입력 행 */}
      <div className="mx-auto flex max-w-screen-md items-end gap-2 px-3 py-2 sm:px-4">
        <div className="shrink-0 pb-1">{avatar}</div>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // 캐럿은 onChange 직후 selectionStart 로 동기화
            requestAnimationFrame(syncCaret);
          }}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          onSelect={syncCaret}
          onFocus={() => onFocus?.()}
          onBlur={() => {
            // 포커스 해제 시 드롭다운 닫기 (단, 마우스다운으로 항목 클릭하는 경우는 onMouseDown preventDefault 로 보호됨)
            window.setTimeout(closeDropdown, 100);
          }}
          onKeyDown={(e) => {
            // 멘션 드롭다운 키보드 네비
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
              submit();
            }
          }}
          placeholder={
            userId ? placeholder : "로그인 후 댓글을 작성할 수 있어요"
          }
          disabled={disabled}
          rows={1}
          maxLength={500}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          data-comment-composer-input
          className={cn(
            "min-h-[36px] max-h-32 flex-1 resize-none rounded-2xl border px-3 py-2 text-sm leading-relaxed outline-none transition-all",
            isLight
              ? "border-gray-200 bg-gray-50 text-gray-900 caret-violet-600 placeholder:text-gray-400 focus:border-violet-500 focus:bg-white dark:border-white/[0.1] dark:bg-gray-800 dark:text-white dark:caret-white dark:placeholder:text-white/40 dark:focus:border-violet-400/60 dark:focus:bg-gray-800"
              : "border-white/[0.09] bg-white/[0.07] text-white caret-white placeholder-white/40 focus:border-violet-400/40 focus:bg-white/[0.09]",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
          style={{
            scrollbarWidth: "none",
            colorScheme: isLight ? "light dark" : "dark",
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label="댓글 등록"
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all",
            canSend
              ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_0_16px_rgba(124,58,237,0.4)] hover:brightness-110"
              : isLight
                ? "bg-gray-100 text-gray-400 dark:bg-white/[0.07] dark:text-gray-500"
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
    </div>
  );
}
