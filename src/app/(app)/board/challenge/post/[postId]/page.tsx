"use client";

// 챌린지 인증 글 상세 — /board/challenge/post/[postId]
//
// /board/challenge/{id} 가 [challengeId] 라우트와 충돌하기 때문에,
// 인증 글 상세는 literal `post/` 디렉토리 아래에 별도 라우트로 둔다.
// 본인/관리자만 보이는 삭제 버튼 + 확인 모달 + 토스트 포함.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Eye, Loader2, Pencil, Share2, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { Badge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { PostComments } from "@/components/comments/PostComments";
import { deletePost, incrementViewCount } from "@/lib/board";
import { buildPostShareUrl, sharePost } from "@/lib/share";
import { supabase } from "@/lib/supabase";
import { useSupabaseProfile } from "@/lib/supabase-profile";
import type { Role } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type ChallengePost = {
  id: string;
  author_id: string;
  challenge_id: string | null;
  title: string;
  content: string;
  image_url: string | null;
  view_count: number;
  created_at: string;
  author: {
    id: string;
    nickname: string;
    role: Role;
    avatar_url: string | null;
  } | null;
};

export default function ChallengePostDetailPage() {
  return (
    <AuthGate
      title="챌린지 인증 글은 로그인이 필요합니다"
      description="로그인 후 인증 글을 확인할 수 있어요."
    >
      <ChallengePostInner />
    </AuthGate>
  );
}

function ChallengePostInner() {
  const params = useParams<{ postId: string }>();
  const postId = params.postId;
  const router = useRouter();
  const { user, profile } = useSupabaseProfile();

  const [post, setPost] = useState<ChallengePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null,
  );
  const viewCounted = useRef(false);

  useEffect(() => {
    if (!postId) return;
    let active = true;
    setLoading(true);

    supabase
      .from("posts")
      .select(
        "id, author_id, challenge_id, title, content, image_url, view_count, created_at, board_type, author:profiles!author_id ( id, nickname, role, avatar_url )",
      )
      .eq("id", postId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          if (error) console.error("[challenge/post] 조회 실패", error);
          setPost(null);
        } else {
          // board_type 이 challenge 가 아니면 잘못된 진입.
          const row = data as unknown as ChallengePost & { board_type: string };
          if (row.board_type !== "challenge") {
            setPost(null);
          } else {
            const author = Array.isArray(row.author)
              ? (row.author[0] ?? null)
              : row.author;
            setPost({
              id: row.id,
              author_id: row.author_id,
              challenge_id: row.challenge_id,
              title: row.title,
              content: row.content,
              image_url: row.image_url,
              view_count: row.view_count ?? 0,
              created_at: row.created_at,
              author,
            });
          }
        }
        setLoading(false);
      });

    // 조회수 +1 (마운트 1회) — 다른 게시판 상세와 동일한 RPC 사용
    if (!viewCounted.current) {
      viewCounted.current = true;
      incrementViewCount(postId);
    }

    return () => {
      active = false;
    };
  }, [postId]);

  function showToast(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 2400);
  }

  async function handleDelete() {
    if (!post || deleting) return;
    setDeleting(true);
    const { error } = await deletePost(post.id);
    setDeleting(false);
    setConfirmOpen(false);
    if (error) {
      showToast("err", "삭제에 실패했습니다");
      return;
    }
    showToast("ok", "인증 글이 삭제되었습니다");
    // 토스트가 잠깐 보인 뒤 챌린지 상세로 복귀
    window.setTimeout(() => {
      if (post.challenge_id) {
        router.push(`/board/challenge/${post.challenge_id}`);
      } else {
        router.push("/board/challenge");
      }
    }, 700);
  }

  async function handleShare() {
    if (!post) return;
    const url = buildPostShareUrl("challenge", post.id);
    const result = await sharePost({ title: post.title, url });
    if (result.kind === "copied") {
      showToast("ok", "링크가 복사되었습니다");
    } else if (result.kind === "error") {
      showToast("err", result.message);
    }
    // shared / cancelled 는 별도 토스트 없이 자연스럽게 종료
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-violet-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-screen-md px-4 py-10 text-center">
        <p className="text-sm text-gray-500">존재하지 않거나 삭제된 글입니다.</p>
        <Link
          href="/board/challenge"
          className="mt-4 inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white"
        >
          챌린지 목록으로
        </Link>
      </div>
    );
  }

  const isOwner = !!user && user.id === post.author_id;
  const isAdmin = profile?.role === "admin";
  const canDelete = isOwner || isAdmin;

  const backHref = post.challenge_id
    ? `/board/challenge/${post.challenge_id}`
    : "/board/challenge";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-screen-md px-4 pt-6"
      // 하단 고정 댓글 입력바(약 60px) + safe-area 만큼 여유
      style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom))" }}
    >
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-800 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        챌린지로 돌아가기
      </Link>

      <article className="mt-3 space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/[0.07] dark:bg-[#16162a]">
        {/* 작성자 + 액션 */}
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar
              size="sm"
              nickname={post.author?.nickname}
              role={post.author?.role ?? null}
              avatarUrl={post.author?.avatar_url ?? null}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold text-gray-900 dark:text-white">
                  {post.author?.nickname ?? "(알수없음)"}
                </span>
                {post.author && (
                  <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />
                )}
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <span>{formatDateTime(post.created_at)}</span>
                <span className="text-gray-300">·</span>
                <span className="inline-flex items-center gap-0.5">
                  <Eye className="h-3 w-3" />
                  {post.view_count.toLocaleString()}
                </span>
              </p>
            </div>
          </div>

          {/* 액션 — 공유(전체) | 수정 / 삭제(본인 또는 admin) */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleShare}
              aria-label="공유"
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]"
            >
              <Share2 className="h-3.5 w-3.5" />
              공유
            </button>

            {canDelete && (
              <Link
                href={
                  post.challenge_id
                    ? `/board/challenge/write?challengeId=${post.challenge_id}&id=${post.id}`
                    : `/board/challenge/write?id=${post.id}`
                }
                className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-600 transition-colors hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
              >
                <Pencil className="h-3.5 w-3.5" />
                수정
              </Link>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={deleting}
                className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                삭제
              </button>
            )}
          </div>
        </header>

        {/* 제목 */}
        <h1 className="text-xl font-extrabold leading-snug text-gray-900 dark:text-white">
          {post.title}
        </h1>

        {/* 이미지 — 탭하면 라이트박스로 확대 */}
        {post.image_url && (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
            <ImageLightbox
              src={post.image_url}
              alt={post.title}
              className="block max-h-[640px] w-full object-contain"
            />
          </div>
        )}

        {/* 본문 */}
        {post.content && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800 dark:text-gray-100">
            {post.content}
          </p>
        )}
      </article>

      {/* 댓글 — 목록 + 하단 고정 입력바 */}
      <PostComments
        postId={post.id}
        boardType="challenge"
        currentUserId={user?.id ?? null}
        composerProfile={{
          nickname: profile?.nickname ?? null,
          role: profile?.role ?? null,
          avatarUrl: profile?.avatar_url ?? null,
        }}
      />

      {/* 삭제 확인 모달 */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => !deleting && setConfirmOpen(false)}
          >
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-4 w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#16162a]"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-rose-500/15 text-rose-500">
                  <Trash2 className="h-4 w-4" />
                </span>
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                  정말 삭제하시겠습니까?
                </h2>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                이 인증 글과 댓글이 모두 삭제됩니다. 되돌릴 수 없어요.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={deleting}
                  className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:bg-white/[0.1]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-opacity",
                    "bg-rose-600 hover:bg-rose-700",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {deleting ? "삭제 중…" : "삭제"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 토스트 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none fixed inset-x-0 bottom-10 z-50 flex justify-center px-4"
          >
            <div
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-semibold shadow-xl backdrop-blur-md",
                toast.kind === "ok"
                  ? "border-emerald-400/30 bg-emerald-600/95 text-white"
                  : "border-rose-400/30 bg-rose-600/95 text-white",
              )}
            >
              {toast.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}
