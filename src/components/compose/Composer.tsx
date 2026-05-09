"use client";

// 글쓰기 폼 — 채널 선택 + 텍스트 영역 + 해시태그 자동완성 + "게시" 버튼
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Loader2, Send } from "lucide-react";
import { motion } from "framer-motion";
import {
  CHANNEL_LABEL,
  createPost,
  extractHashtags,
  getAllHashtags,
  type Channel,
  type Post,
} from "@/lib/mock-data";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Badge } from "@/components/ui/Badge";
import { useSupabaseProfile } from "@/lib/supabase-profile";
import { ChannelSelect } from "./ChannelSelect";
import {
  HashtagAutocomplete,
  getHashtagAtCursor,
} from "./HashtagAutocomplete";

const MAX_LEN = 500;

type Props = {
  onSubmitted: (post: Post) => void;
  onCancel?: () => void;
  /** 모달이 처음 열렸을 때 textarea 자동 포커스 */
  autoFocus?: boolean;
};

export function Composer({ onSubmitted, onCancel, autoFocus = true }: Props) {
  const { profile } = useSupabaseProfile();
  const [content, setContent] = useState("");
  const [channel, setChannel] = useState<Channel>("free");
  const [submitting, setSubmitting] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [highlight, setHighlight] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 자동완성용 — 모든 태그 한 번 로드
  const allTags = useMemo(() => getAllHashtags(), []);

  // 커서 위치의 #쿼리
  const ctx = getHashtagAtCursor(content, cursor);
  const query = ctx?.query ?? null;

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    const filtered = allTags.filter((t) => t.toLowerCase().startsWith(q));
    return filtered.slice(0, 8);
  }, [allTags, query]);

  // 추천 목록이 바뀌면 highlight 리셋
  useEffect(() => {
    setHighlight(0);
  }, [query, suggestions.length]);

  // 자동 높이 조정
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 320) + "px";
  }, [content]);

  // autoFocus
  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => textareaRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const insertTag = useCallback(
    (tag: string) => {
      if (!ctx) return;
      const before = content.slice(0, ctx.start);
      const after = content.slice(cursor);
      const inserted = `#${tag} `;
      const next = before + inserted + after;
      const newCursor = (before + inserted).length;
      setContent(next);
      // 다음 frame 에 커서 위치 복원
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.selectionStart = el.selectionEnd = newCursor;
        setCursor(newCursor);
      });
    },
    [content, cursor, ctx],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 자동완성이 떠 있을 때 키 처리
    if (query !== null && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        insertTag(suggestions[highlight]);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        insertTag(suggestions[highlight]);
        return;
      }
    }
    // Cmd/Ctrl + Enter 로 즉시 게시
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const trimmed = content.trim();
  const overLimit = content.length > MAX_LEN;
  const canSubmit = trimmed.length > 0 && !overLimit && !submitting;
  const detectedTags = extractHashtags(content);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const post = await createPost({ content: trimmed, channel });
      setContent("");
      onSubmitted(post);
    } catch {
      // 실패 시 그대로 두고 사용자에게 다시 시도 기회
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* 헤더 — 작성자 + 채널 */}
      <div className="flex items-center gap-3 pb-3">
        <UserAvatar
          nickname={profile?.nickname}
          role={profile?.role}
          avatarUrl={profile?.avatar_url}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold">
              {profile?.nickname ?? "닉네임 미설정"}
            </span>
            {profile?.role && <Badge role={profile.role} />}
          </div>
          <p className="text-xs text-foreground/55">
            {CHANNEL_LABEL[channel]}에 게시돼요
          </p>
        </div>
        <ChannelSelect value={channel} onChange={setChannel} />
      </div>

      {/* 본문 입력 + 자동완성 */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setCursor(e.target.selectionStart);
          }}
          onSelect={(e) =>
            setCursor((e.target as HTMLTextAreaElement).selectionStart)
          }
          onKeyDown={handleKeyDown}
          placeholder="무슨 일이 있었나요? #해시태그도 함께 적어보세요"
          rows={4}
          className="block w-full resize-none rounded-2xl bg-foreground/5 px-4 py-3 text-[15px] leading-relaxed outline-none ring-1 ring-inset ring-white/5 transition placeholder:text-foreground/35 focus:bg-foreground/10 focus:ring-accent/40"
        />

        <HashtagAutocomplete
          query={query}
          suggestions={suggestions}
          highlight={highlight}
          onPick={insertTag}
          onClose={() => {
            // ESC: 추천창만 닫고 다음 편집 시 다시 열리게 함
            // 실제 닫힘은 query가 null이 될 때 자동
            textareaRef.current?.focus();
          }}
          onMove={(delta) =>
            setHighlight((h) => {
              if (suggestions.length === 0) return 0;
              const next = (h + delta + suggestions.length) % suggestions.length;
              return next;
            })
          }
        />
      </div>

      {/* 인식된 해시태그 미리보기 */}
      {detectedTags.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex flex-wrap gap-1.5"
        >
          {detectedTags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-full bg-cyan-accent/15 px-2.5 py-1 text-xs font-medium text-cyan-accent ring-1 ring-inset ring-cyan-accent/25"
            >
              #{t}
            </span>
          ))}
        </motion.div>
      )}

      {/* 푸터 — 글자수 + 취소 + 게시 */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <span
          className={`text-xs tabular-nums ${
            overLimit ? "text-rose-400" : "text-foreground/45"
          }`}
        >
          {content.length} / {MAX_LEN}
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl px-4 py-2 text-sm font-semibold text-foreground/65 transition-colors hover:bg-foreground/5"
            >
              취소
            </button>
          )}
          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            whileHover={canSubmit ? { scale: 1.03 } : undefined}
            whileTap={canSubmit ? { scale: 0.97 } : undefined}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(124,58,237,0.45)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span>{submitting ? "게시 중…" : "게시"}</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
