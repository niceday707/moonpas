"use client";

// 게시판 목록 — /board/[boardType]
// 자유게시판(free)을 비롯한 board_type 별 글 목록을 Supabase 에서 직접 조회.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, MessageSquare, PenSquare, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AuthGate } from "@/components/auth/AuthGate";
import {
  BOARD_LABEL,
  POSTS_PER_PAGE,
  listPosts,
  type BoardType,
  type PostRow,
} from "@/lib/board";

const VALID_BOARDS = Object.keys(BOARD_LABEL) as BoardType[];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}.${dd}`;
}

export default function BoardListPage() {
  const params = useParams<{ boardType: string }>();
  const boardType = params.boardType as BoardType;

  if (!VALID_BOARDS.includes(boardType)) {
    return (
      <div className="mx-auto max-w-screen-md px-4 py-10 text-center">
        <p className="text-sm text-gray-500">존재하지 않는 게시판입니다.</p>
      </div>
    );
  }

  return (
    <AuthGate
      title={`${BOARD_LABEL[boardType]}은 로그인이 필요합니다`}
      description="문태고 학생·교사·학부모·졸업생만 이용할 수 있어요."
    >
      <BoardListInner boardType={boardType} />
    </AuthGate>
  );
}

function BoardListInner({ boardType }: { boardType: BoardType }) {
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listPosts(boardType, page).then((res) => {
      if (!active) return;
      setPosts(res.posts);
      setTotal(res.total);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [boardType, page]);

  const totalPages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-screen-md px-4 py-6"
    >
      {/* 헤더 */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            {BOARD_LABEL[boardType]}
          </h1>
          <p className="mt-1 text-xs text-gray-400">총 {total}개의 글</p>
        </div>
        <Link
          href={`/board/${boardType}/write`}
          className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
        >
          <PenSquare className="h-4 w-4" />
          글쓰기
        </Link>
      </div>

      {/* 글 목록 */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.07] dark:bg-[#16162a]">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-violet-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              아직 게시글이 없습니다.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              첫 번째 글을 작성해보세요!
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/board/${boardType}/${post.id}`}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                >
                  {/* 이미지 썸네일 — 글에 image_url 이 있으면 모든 게시판에서 표시 */}
                  {post.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.image_url}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-white">
                      {post.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {post.author?.nickname ?? "(알수없음)"}
                      </span>
                      {post.author && (
                        <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />
                      )}
                      <span className="text-gray-400">·</span>
                      <span className="tabular-nums">{formatDate(post.created_at)}</span>
                      <span className="ml-auto flex items-center gap-2 text-gray-400">
                        <span className="flex items-center gap-0.5">
                          <Eye className="h-3 w-3" />
                          {post.view_count}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="h-3 w-3" />
                          {post.comment_count}
                        </span>
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={
                "h-8 min-w-[32px] rounded-md text-xs font-semibold transition " +
                (p === page
                  ? "bg-violet-600 text-white"
                  : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.05]")
              }
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
