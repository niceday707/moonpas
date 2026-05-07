"use client";

// Threads 스타일 글 카드 — 클릭하면 상세로 이동
import Link from "next/link";
import { MessageCircle, MoreHorizontal, Share2, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import type { Post } from "@/lib/mock-data";
import { Avatar } from "./Avatar";
import { Badge } from "@/components/ui/Badge";
import { LikeButton } from "./LikeButton";
import { PostContent } from "./PostContent";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  post: Post;
  /** 상세 페이지에서는 카드를 클릭 가능한 링크로 만들지 않음 */
  asLink?: boolean;
  className?: string;
};

export function PostCard({ post, asLink = true, className }: Props) {
  const isAnon = !!post.anonymous;
  const displayName = isAnon ? `익명${post.anonymousId ?? ""}` : post.author.name;
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/feed/${post.id}`
        : `/feed/${post.id}`;
    const text =
      post.content.slice(0, 80) + (post.content.length > 80 ? "..." : "");

    // navigator.share — 모바일 기기의 네이티브 공유 시트 호출
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "문파스", text, url });
      } catch {
        // 사용자 취소 또는 공유 불가
      }
      return;
    }

    // 공유 API 미지원 → 링크 클립보드 복사
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한 거부
    }
  };

  const inner = (
    <article
      className={cn(
        "glass relative rounded-2xl p-4 md:p-5",
        asLink && "transition-shadow hover:shadow-[0_8px_28px_rgba(124,58,237,0.25)]",
        className,
      )}
    >
      <header className="flex items-start gap-3">
        <Avatar author={post.author} anonymous={isAnon} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "truncate font-semibold",
                isAnon && "text-foreground/70",
              )}
            >
              {displayName}
            </span>
            {/* 익명 글에는 역할 배지를 노출하지 않는다 — 추적 방지 */}
            {!isAnon && (
              <Badge
                role={post.author.role}
                year={
                  post.author.role === "alumni"
                    ? post.author.graduationYear
                    : undefined
                }
              />
            )}
            <span className="text-xs text-foreground/50">· {relativeTime(post.createdAt)}</span>
          </div>
        </div>
        <button
          type="button"
          aria-label="더보기"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="rounded-full p-2 text-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground/70 min-h-[44px] min-w-[44px] grid place-items-center"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </header>

      <div className="mt-3 pl-[52px]">
        <PostContent text={post.content} collapsible={asLink} />

        <div className="mt-3 flex items-center gap-1 -ml-2">
          <LikeButton postId={post.id} liked={post.liked} count={post.likes} />

          <Link
            href={`/feed/${post.id}`}
            onClick={(e) => e.stopPropagation()}
            className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2 text-foreground/55 transition-colors hover:bg-foreground/5 hover:text-foreground"
            aria-label="댓글 보기"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="text-xs font-semibold tabular-nums">
              {post.commentCount}
            </span>
          </Link>

          {/* 공유 버튼 — navigator.share 또는 링크 복사 */}
          <button
            type="button"
            aria-label={copied ? "링크 복사됨" : "공유"}
            onClick={handleShare}
            className={cn(
              "ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors",
              copied
                ? "text-green-500"
                : "text-foreground/55 hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span>복사됨</span>
              </>
            ) : (
              <Share2 className="h-4.5 w-4.5" />
            )}
          </button>
        </div>
      </div>
    </article>
  );

  if (!asLink) return inner;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <Link href={`/feed/${post.id}`} className="block">
        {inner}
      </Link>
    </motion.div>
  );
}
