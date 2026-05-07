"use client";

// 단순 게시판 공용 페이지.
// 시드 글 목록을 카드로 그리고, 카드별로 댓글 섹션을 토글 가능하게 펼친다.
// 이슈토론·QnA·졸업생·선배후기·문태뉴스 5개 보드가 동일한 컴포넌트를 사용한다.
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/feed/Avatar";
import { CommentSection } from "@/components/comments/CommentSection";
import { countCommentsForTarget, subscribe } from "@/lib/mock-data";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BoardKey, BoardPost } from "@/lib/board-posts-data";

type Props = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  boardKey: BoardKey;
  posts: BoardPost[];
};

export function BoardPage({ title, subtitle, icon: Icon, posts }: Props) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <motion.header
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-6"
      >
        <div className="mb-2 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-accent/15">
            <Icon className="h-5 w-5 text-accent" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
            {title}
          </h1>
        </div>
        <p className="text-sm text-foreground/55">{subtitle}</p>
      </motion.header>

      <ul className="flex flex-col gap-3">
        {posts.map((post, i) => (
          <motion.li
            key={post.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: i * 0.05 }}
          >
            <BoardPostCard post={post} />
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────
// 카드 + 댓글 토글
// ─────────────────────────────────────────────

function BoardPostCard({ post }: { post: BoardPost }) {
  const targetId = `${post.board}:${post.id}`;
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(() => countCommentsForTarget(targetId));

  useEffect(() => {
    const refresh = () => setCount(countCommentsForTarget(targetId));
    refresh();
    return subscribe(refresh);
  }, [targetId]);

  return (
    <GlassCard interactive={false} className="flex flex-col gap-3 p-4 md:p-5">
      {/* 헤더 — 작성자 정보 (닉네임 + 역할 배지만 노출. 익명이면 "익명{N}") */}
      <header className="flex items-start gap-3">
        <Avatar author={post.author} anonymous={!!post.anonymous} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              className={cn(
                "truncate text-sm font-semibold",
                post.anonymous && "text-foreground/70",
              )}
            >
              {post.anonymous
                ? `익명${post.anonymousId ?? ""}`
                : post.author.name}
            </span>
            {!post.anonymous && (
              <Badge
                role={post.author.role}
                year={
                  post.author.role === "alumni"
                    ? post.author.graduationYear
                    : undefined
                }
              />
            )}
            <span className="text-xs text-foreground/45">
              · {relativeTime(post.createdAt)}
            </span>
          </div>
          {post.meta && (
            <p className="text-[11px] font-semibold text-accent/80">
              {post.meta}
            </p>
          )}
        </div>
      </header>

      {/* 본문 */}
      <div>
        {post.title && (
          <h2 className="mb-1.5 text-base font-extrabold leading-snug md:text-lg">
            {post.title}
          </h2>
        )}
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">
          {post.content}
        </p>
      </div>

      {/* 댓글 토글 */}
      <div className="border-t border-foreground/10 pt-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-semibold text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground/85"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          댓글 {count}개
          <ChevronDown
            className={cn(
              "ml-auto h-3.5 w-3.5 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <CommentSection
                targetId={targetId}
                bordered={false}
                showHeader={false}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}
