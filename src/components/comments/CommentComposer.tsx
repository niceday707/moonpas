"use client";

// 인스타그램 스타일 하단 고정 댓글 입력바.
// - visualViewport API 로 모바일 가상 키보드 높이를 추적해 입력바를 키보드 바로 위에 위치시킴.
// - 답글 모드: 입력 필드에 "@닉네임 " 자동 입력 + 위쪽 배너에 "OOO에게 답글 작성 중" + 취소 버튼.
// - 라이트(일반 게시판) / 다크(익명 게시판) 테마 지원.
//
// 일반 게시판과 익명 게시판 모두 같은 컴포넌트를 사용한다.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Send, X as XIcon } from "lucide-react";
import { createComment } from "@/lib/board";
import { cn } from "@/lib/utils";

export type ReplyTarget = { id: string; label: string };

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
}: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  /** 가상 키보드가 가린 viewport 하단 영역 높이(px). 키보드 닫히면 0. */
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastReplyId = useRef<string | null>(null);

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
      lastReplyId.current = null;
      return;
    }
    if (lastReplyId.current === replyTo.id) return;
    lastReplyId.current = replyTo.id;
    const prefix = `@${replyTo.label} `;
    setText((curr) => {
      const stripped = curr.replace(/^@\S+\s+/, "");
      return prefix + stripped;
    });
    // 다음 프레임에 포커스 + 캐럿을 prefix 뒤로
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(prefix.length, prefix.length);
      } catch {
        /* 일부 모바일 브라우저에서 setSelectionRange 미지원 — 무시 */
      }
    });
  }, [replyTo]);

  function handleCancelReply() {
    setText((curr) => curr.replace(/^@\S+\s+/, ""));
    onCancelReply();
  }

  async function submit() {
    const t = text.trim();
    if (!t || busy || !userId) return;
    setBusy(true);
    const { error } = await createComment({
      authorId: userId,
      postId,
      content: t,
      parentId: replyTo?.id ?? null,
    });
    setBusy(false);
    if (error) {
      window.alert("댓글 작성에 실패했어요.");
      return;
    }
    setText("");
    if (replyTo) onCancelReply();
    await onSubmitted();
  }

  const isLight = theme === "light";
  const disabled = !userId || busy;
  const canSend = !!text.trim() && !disabled;

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
        // 키보드가 올라와 있을 땐 safe-area 가 의미 없음 (이미 키보드가 화면 하단을 차지)
        paddingBottom: keyboardOffset > 0 ? 0 : "env(safe-area-inset-bottom)",
        background: isLight ? undefined : "rgba(15,12,41,0.92)",
      }}
    >
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
          onChange={(e) => setText(e.target.value)}
          onFocus={() => onFocus?.()}
          onKeyDown={(e) => {
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
          className={cn(
            "min-h-[36px] max-h-32 flex-1 resize-none rounded-2xl border px-3 py-2 text-sm leading-relaxed outline-none transition-all",
            isLight
              ? "border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:bg-white dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white"
              : "border-white/[0.09] bg-white/[0.07] text-white/85 placeholder-white/30 focus:border-violet-400/40 focus:bg-white/[0.09]",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
          style={{ scrollbarWidth: "none" }}
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
