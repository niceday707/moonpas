"use client";

// 게시판 목록 — /board/[boardType]
// notice: 고정글 우선 + "중요" 뱃지 / lost: 카드 그리드 + 상태 필터 / 그 외: 기본 리스트
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Eye,
  MessageSquare,
  PenSquare,
  Loader2,
  Paperclip,
  Pin,
  MapPin,
  ImageOff,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AuthGate } from "@/components/auth/AuthGate";
import { useSupabaseProfile } from "@/lib/supabase-profile";
import { cn } from "@/lib/utils";
import {
  BOARD_LABEL,
  POSTS_PER_PAGE,
  listPosts,
  parseLostContent,
  type BoardType,
  type PostRow,
  type PostStatus,
} from "@/lib/board";

const VALID_BOARDS = Object.keys(BOARD_LABEL) as BoardType[];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
function isNewPost(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < ONE_DAY_MS;
}

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
  const isNotice = boardType === "notice";
  const isLost = boardType === "lost";

  const { profile } = useSupabaseProfile();
  const role = (profile?.role ?? "") as string;
  // 공지사항: 일반 학생/학부모/졸업생은 글쓰기 버튼 숨김
  const canWrite = isNotice ? role === "admin" || role === "teacher" : true;

  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  // 분실물 상태 필터
  const [statusFilter, setStatusFilter] = useState<"" | PostStatus>("");

  // 필터 변경 시 페이지 초기화
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listPosts(boardType, page, {
      pinnedFirst: isNotice,
      status: isLost && statusFilter ? statusFilter : null,
    }).then((res) => {
      if (!active) return;
      setPosts(res.posts);
      setTotal(res.total);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [boardType, page, isNotice, isLost, statusFilter]);

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
        {canWrite ? (
          <Link
            href={`/board/${boardType}/write`}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
          >
            <PenSquare className="h-4 w-4" />
            글쓰기
          </Link>
        ) : (
          <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-[11px] font-semibold text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
            관리자만 작성
          </span>
        )}
      </div>

      {/* 분실물 상태 필터 */}
      {isLost && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(
            [
              { value: "", label: "전체" },
              { value: "active", label: "찾는 중 🔴" },
              { value: "resolved", label: "찾았어요 🟢" },
            ] as Array<{ value: "" | PostStatus; label: string }>
          ).map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  active
                    ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 본문 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-violet-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center dark:border-white/[0.07] dark:bg-[#16162a]">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isLost && statusFilter
              ? "조건에 해당하는 글이 없습니다."
              : "아직 게시글이 없습니다."}
          </p>
          {canWrite && !statusFilter && (
            <p className="mt-1 text-xs text-gray-400">
              첫 번째 글을 작성해보세요!
            </p>
          )}
        </div>
      ) : isLost ? (
        <LostGrid posts={posts} />
      ) : (
        <DefaultList posts={posts} boardType={boardType} highlightPinned={isNotice} />
      )}

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

// ── 기본 리스트 (자유게시판/공지 등) ─────────────────────────
function DefaultList({
  posts,
  boardType,
  highlightPinned,
}: {
  posts: PostRow[];
  boardType: BoardType;
  highlightPinned: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.07] dark:bg-[#16162a]">
      <ul className="divide-y divide-gray-100 dark:divide-white/[0.04]">
        {posts.map((post) => {
          const pinned = highlightPinned && post.is_pinned;
          const fresh = isNewPost(post.created_at);
          return (
            <li key={post.id}>
              <Link
                href={`/board/${boardType}/${post.id}`}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 transition-colors",
                  pinned
                    ? "bg-violet-50/70 hover:bg-violet-100/60 dark:bg-violet-500/[0.07] dark:hover:bg-violet-500/[0.12]"
                    : "hover:bg-gray-50 dark:hover:bg-white/[0.02]",
                )}
              >
                {/* 이미지 썸네일 — 글에 image_url 이 있으면 표시 */}
                {post.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.image_url}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {pinned && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-500 ring-1 ring-inset ring-rose-500/30 dark:text-rose-300">
                        <Pin className="h-2.5 w-2.5" />
                        중요
                      </span>
                    )}
                    <span className="truncate">{post.title}</span>
                    {fresh && (
                      <span className="shrink-0 rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 ring-1 ring-inset ring-violet-500/30 dark:text-violet-300">
                        NEW
                      </span>
                    )}
                    {post.file_url && (
                      <Paperclip
                        aria-label="PDF 첨부"
                        className="h-3.5 w-3.5 shrink-0 text-violet-500"
                      />
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {post.author?.nickname ?? "(알수없음)"}
                    </span>
                    {post.author && (
                      <Badge
                        role={post.author.role}
                        className="text-[9px] py-0 px-1.5"
                      />
                    )}
                    <span className="text-gray-400">·</span>
                    <span className="tabular-nums">
                      {formatDate(post.created_at)}
                    </span>
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
          );
        })}
      </ul>
    </div>
  );
}

// ── 분실물 카드 그리드 ─────────────────────────────────────
function LostGrid({ posts }: { posts: PostRow[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {posts.map((post) => (
        <LostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function LostCard({ post }: { post: PostRow }) {
  const info = useMemo(() => parseLostContent(post.content), [post.content]);
  const fresh = isNewPost(post.created_at);
  const resolved = post.status === "resolved";

  return (
    <Link
      href={`/board/lost/${post.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(124,58,237,0.18)] dark:border-white/[0.07] dark:bg-[#16162a]"
    >
      <div className="relative aspect-[4/3] w-full bg-gray-100 dark:bg-white/[0.04]">
        {post.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt=""
            className={cn(
              "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
              resolved && "opacity-70",
            )}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-300 dark:text-white/20">
            <ImageOff className="h-8 w-8" />
            <span className="text-[10px]">사진 없음</span>
          </div>
        )}

        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset backdrop-blur-sm",
              resolved
                ? "bg-emerald-500/80 text-white ring-white/20"
                : "bg-rose-500/85 text-white ring-white/20",
            )}
          >
            {resolved ? "찾았어요 🟢" : "찾는 중 🔴"}
          </span>
          {fresh && (
            <span className="inline-flex items-center rounded-full bg-violet-500/85 px-2 py-0.5 text-[10px] font-bold text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm">
              NEW
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-1 text-sm font-bold text-gray-900 dark:text-white">
          {post.title}
        </p>
        {info.location && (
          <p className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <MapPin className="h-3 w-3 shrink-0 text-violet-500" />
            <span className="line-clamp-1">{info.location}</span>
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-gray-400">
          <span className="font-medium text-gray-600 dark:text-gray-300">
            {post.author?.nickname ?? "(알수없음)"}
          </span>
          <span className="flex items-center gap-2">
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
  );
}
