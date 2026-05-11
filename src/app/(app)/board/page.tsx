"use client";

// 전체 게시판 통합 최신글 — /board
// 모든 board_type 의 최신글을 created_at DESC 로 보여준다.
// 챌린지 인증 글은 postDetailHref 헬퍼가 /board/challenge/post/[postId] 로 라우팅.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, Loader2, MessageSquare, Pin } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { Badge, type Role } from "@/components/ui/Badge";
import { NicknameButton } from "@/components/profile/NicknameButton";
import {
  BOARD_LABEL,
  getLatestPosts,
  postDetailHref,
  type BoardType,
  type PostRow,
} from "@/lib/board";
import {
  displayAuthorNameFor,
  shouldShowAuthorBadgeFor,
} from "@/lib/author-display";

const PAGE_SIZE = 100;

const BOARD_BADGE_COLOR: Record<BoardType, string> = {
  free: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
  notice: "text-red-600 bg-red-50 dark:bg-red-900/20",
  qa: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  debate: "text-orange-500 bg-orange-50 dark:bg-orange-900/20",
  challenge: "text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20",
  market: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
  lost: "text-rose-500 bg-rose-50 dark:bg-rose-900/20",
  study: "text-teal-500 bg-teal-50 dark:bg-teal-900/20",
  college: "text-violet-600 bg-violet-50 dark:bg-violet-900/20",
  curriculum: "text-green-600 bg-green-50 dark:bg-green-900/20",
  council: "text-pink-500 bg-pink-50 dark:bg-pink-900/20",
  youtube: "text-red-500 bg-red-50 dark:bg-red-900/20",
  resources: "text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20",
  news: "text-amber-700 bg-amber-50 dark:bg-amber-900/20",
  alumni: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20",
  alumni_news: "text-violet-600 bg-violet-50 dark:bg-violet-900/20",
  senior: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
  event_member: "text-violet-600 bg-violet-50 dark:bg-violet-900/20",
  event_find: "text-orange-500 bg-orange-50 dark:bg-orange-900/20",
  event_praise: "text-pink-500 bg-pink-50 dark:bg-pink-900/20",
  event_study: "text-teal-500 bg-teal-50 dark:bg-teal-900/20",
  event_quiz: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
  guess_who: "text-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/20",
  anonymous: "text-purple-500 bg-purple-50 dark:bg-purple-900/20",
};

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}

export default function BoardAllPage() {
  return (
    <AuthGate
      title="전체 게시판은 로그인이 필요합니다"
      description="문태고 학생·교사·학부모·졸업생만 이용할 수 있어요."
    >
      <BoardAllInner />
    </AuthGate>
  );
}

function BoardAllInner() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getLatestPosts(PAGE_SIZE).then((list) => {
      if (!active) return;
      setPosts(list);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto w-full max-w-screen-md px-4 py-6"
    >
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            📚 전체 게시판
          </h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            모든 게시판의 최신글을 한눈에 볼 수 있어요.
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.07] dark:bg-[#16162a]">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-violet-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">
            아직 등록된 게시글이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-white/[0.04]">
            {posts.map((p) => (
              <li key={p.id}>
                <Link
                  href={postDetailHref(p.board_type, p.id, {
                    challengeId: p.challenge_id,
                    postCategory: p.post_category,
                  })}
                  className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02] sm:gap-3"
                >
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${BOARD_BADGE_COLOR[p.board_type]}`}
                  >
                    {BOARD_LABEL[p.board_type]}
                  </span>

                  <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-gray-800 dark:text-gray-100">
                    <span className="line-clamp-1 flex items-center gap-1">
                      {p.is_pinned && (
                        <Pin className="h-2.5 w-2.5 shrink-0 text-rose-500" />
                      )}
                      {p.title}
                    </span>
                  </span>

                  {p.comment_count > 0 && (
                    <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-violet-500">
                      <MessageSquare className="h-3 w-3" />
                      {p.comment_count}
                    </span>
                  )}

                  <span className="hidden shrink-0 items-center gap-1 text-[11px] sm:flex">
                    <NicknameButton
                      userId={p.author?.id ?? null}
                      className="text-gray-600 dark:text-gray-300"
                    >
                      {displayAuthorNameFor({
                        boardType: p.board_type,
                        author: p.author,
                      })}
                    </NicknameButton>
                    {shouldShowAuthorBadgeFor(p.board_type) && p.author && (
                      <Badge
                        role={p.author.role as Role}
                        className="text-[9px] py-0 px-1"
                      />
                    )}
                  </span>

                  <span className="hidden shrink-0 text-[11px] tabular-nums text-gray-400 md:block">
                    {formatShortDate(p.created_at)}
                  </span>

                  <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-gray-400">
                    <Eye className="h-3 w-3" />
                    {p.view_count.toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
