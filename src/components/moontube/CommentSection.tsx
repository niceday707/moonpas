"use client";

// ============================================================================
// 문태 미디어 — 댓글 전체 영역 (목록 + 입력창 + 정렬/요약 헤더)
// ----------------------------------------------------------------------------
// 두 곳에서 재사용된다.
//  · 롱폼 워치 모달   → variant="inline"  (부모 스크롤 안에 자연스럽게)
//  · 쇼츠 풀스크린  → variant="sheet"   (자체 flex 컨테이너, 하단 고정 입력)
//
// 역할 분리:
//  · 데이터 보관/낙관적 갱신/네트워크 → page.tsx
//  · 표시/정렬/답글 UI/입력          → 이 컴포넌트
// ============================================================================

import { useMemo, useState } from "react";
import { ArrowDownNarrowWide, Clock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommentInput, type ReplyTarget } from "./CommentInput";
import { CommentItem } from "./CommentItem";
import type {
  CommentActions,
  CommentSort,
  MoontubeUIComment,
} from "./types";
import type { Role } from "@/components/ui/Badge";

type Props = {
  itemId: string;
  comments: MoontubeUIComment[];
  /** 현재 로그인 사용자 id — 댓글 작성 가능 여부 + 본인 표시 분기에 사용 */
  currentUserId: string | null;
  /** 본인 아바타(시트 변형의 입력행에 노출) */
  selfAvatar?: {
    nickname?: string | null;
    role?: Role | null;
    avatarUrl?: string | null;
  };
  actions: CommentActions;
  /** 인라인(모달 본문 내부) / 시트(자체 flex 컨테이너 — 쇼츠 슬라이드업) */
  variant?: "inline" | "sheet";
  /** fallback 영상이라 미로그인이어도 작성 허용해야 하는 경우 true */
  allowAnonymousWrite?: boolean;
};

export function CommentSection({
  itemId,
  comments,
  currentUserId,
  selfAvatar,
  actions,
  variant = "inline",
  allowAnonymousWrite = false,
}: Props) {
  const [sort, setSort] = useState<CommentSort>("popular");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);

  // 루트 댓글 + 그 답글들로 분리
  const { roots, repliesByParent, totalCount } = useMemo(() => {
    const r: MoontubeUIComment[] = [];
    const m: Record<string, MoontubeUIComment[]> = {};
    for (const c of comments) {
      if (c.parentId) (m[c.parentId] ??= []).push(c);
      else r.push(c);
    }
    return { roots: r, repliesByParent: m, totalCount: comments.length };
  }, [comments]);

  // 정렬 — 인기순(좋아요 수 desc → 최신순 tiebreak) / 최신순
  const sortedRoots = useMemo(() => {
    const arr = [...roots];
    if (sort === "popular") {
      arr.sort((a, b) => {
        if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else {
      arr.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return arr;
  }, [roots, sort]);

  // 입력행에 전달할 핸들러 — replyTo 가 있으면 답글로 라우팅
  const handleSubmit = async (
    text: string,
    opts?: { parentId?: string | null; mentionUserId?: string | null },
  ) => {
    const res = await actions.onSubmit(text, opts);
    return res;
  };

  // 입력 활성 조건 — 로그인 또는 fallback 허용
  const canWrite = !!currentUserId || allowAnonymousWrite;
  // userId 가 없을 때도 sheet 입력창은 노출(disabled 안내)
  const inputUserId = canWrite ? (currentUserId ?? "anonymous") : null;

  // ── 헤더 ──────────────────────────────────────────────────────────────────
  const header = (
    <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-bold text-white">
        <MessageSquare className="h-4 w-4 text-violet-300" strokeWidth={2.2} />
        댓글 <span className="font-extrabold">{totalCount}</span>
      </h2>
      <div
        role="tablist"
        aria-label="댓글 정렬"
        className="inline-flex items-center rounded-full bg-white/[0.06] p-0.5 text-[11px] font-semibold"
      >
        <SortChip
          active={sort === "popular"}
          onClick={() => setSort("popular")}
          icon={<ArrowDownNarrowWide className="h-3 w-3" />}
          label="인기순"
        />
        <SortChip
          active={sort === "latest"}
          onClick={() => setSort("latest")}
          icon={<Clock className="h-3 w-3" />}
          label="최신순"
        />
      </div>
    </div>
  );

  // ── 목록 ──────────────────────────────────────────────────────────────────
  const list =
    sortedRoots.length === 0 ? (
      <p className="py-10 text-center text-xs text-white/45">
        첫 댓글을 남겨보세요!
      </p>
    ) : (
      <ul className="flex flex-col gap-4 px-4 py-4">
        {sortedRoots.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            replies={repliesByParent[c.id] ?? []}
            canComment={canWrite}
            onStartReply={(target) => setReplyTo(target)}
            actions={actions}
          />
        ))}
      </ul>
    );

  // ── 입력행 ────────────────────────────────────────────────────────────────
  const input = (
    <CommentInput
      userId={inputUserId}
      replyTo={replyTo}
      onCancelReply={() => setReplyTo(null)}
      onSubmit={handleSubmit}
      placeholder={replyTo ? "답글 추가..." : "댓글 추가..."}
      variant={variant}
      selfAvatar={selfAvatar}
    />
  );

  // ── 변형별 레이아웃 ────────────────────────────────────────────────────────
  if (variant === "sheet") {
    // 쇼츠 풀스크린 — 부모(상위 모달)가 flex 컨테이너이며 본 영역이 60% 차지.
    // 헤더 sticky + 본문 스크롤 + 입력 sticky.
    return (
      <div
        key={itemId}
        className="flex h-full min-h-0 flex-col bg-neutral-950/95 text-white"
      >
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
          {list}
        </div>
        {input}
      </div>
    );
  }

  // 인라인 — 부모(모달 본문)가 자체 스크롤. 입력은 sticky 하단에 붙인다.
  return (
    <div className="flex flex-col text-white">
      <div className="sticky top-0 z-10 bg-neutral-950/95 backdrop-blur-md">
        {header}
      </div>
      {list}
      <div className="sticky bottom-0 z-10 -mx-1 border-t border-white/10 bg-neutral-950/95 backdrop-blur-md">
        {input}
      </div>
    </div>
  );
}

function SortChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors",
        active
          ? "bg-violet-500 text-white shadow-[0_2px_8px_rgba(124,58,237,0.35)]"
          : "text-white/55 hover:bg-white/[0.04] hover:text-white",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
