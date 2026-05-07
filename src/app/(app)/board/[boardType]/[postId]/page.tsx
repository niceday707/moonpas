"use client";

// 글 상세 — /board/[boardType]/[postId]
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AuthGate } from "@/components/auth/AuthGate";
import {
  BOARD_LABEL,
  createComment,
  deleteComment,
  deletePost,
  getPost,
  incrementViewCount,
  listComments,
  type BoardType,
  type CommentRow,
  type PostRow,
} from "@/lib/board";
import { useSupabaseProfile } from "@/lib/supabase-profile";

const VALID_BOARDS = Object.keys(BOARD_LABEL) as BoardType[];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}

export default function PostDetailPage() {
  const params = useParams<{ boardType: string; postId: string }>();
  const boardType = params.boardType as BoardType;

  if (!VALID_BOARDS.includes(boardType)) {
    return (
      <div className="mx-auto max-w-screen-md px-4 py-10 text-center text-sm text-gray-500">
        존재하지 않는 게시판입니다.
      </div>
    );
  }

  return (
    <AuthGate
      title={`${BOARD_LABEL[boardType]}은 로그인이 필요합니다`}
      description="로그인 후 글과 댓글을 확인하실 수 있어요."
    >
      <DetailInner boardType={boardType} postId={params.postId} />
    </AuthGate>
  );
}

function DetailInner({ boardType, postId }: { boardType: BoardType; postId: string }) {
  const router = useRouter();
  const { user } = useSupabaseProfile();
  const [post, setPost] = useState<PostRow | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const viewCounted = useRef(false);

  const refreshComments = useCallback(async () => {
    const list = await listComments(postId);
    setComments(list);
  }, [postId]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([getPost(postId), listComments(postId)]).then(
      ([p, c]) => {
        if (!active) return;
        setPost(p);
        setComments(c);
        setLoading(false);
      },
    );

    // 조회수 +1 (마운트 1회)
    if (!viewCounted.current) {
      viewCounted.current = true;
      incrementViewCount(postId);
    }

    return () => {
      active = false;
    };
  }, [postId]);

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
          href={`/board/${boardType}`}
          className="mt-4 inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white"
        >
          {BOARD_LABEL[boardType]}로 돌아가기
        </Link>
      </div>
    );
  }

  const isOwner = !!user && user.id === post.author_id;

  async function handleDelete() {
    if (!post) return;
    if (!window.confirm("정말 삭제하시겠어요? 되돌릴 수 없어요.")) return;
    const { error } = await deletePost(post.id);
    if (error) {
      window.alert("삭제에 실패했어요.");
      return;
    }
    router.push(`/board/${boardType}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-screen-md px-4 py-6"
    >
      <Link
        href={`/board/${boardType}`}
        className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-800 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {BOARD_LABEL[boardType]}
      </Link>

      <article className="mt-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-white/[0.07] dark:bg-[#16162a]">
        <h1 className="text-xl font-extrabold leading-snug text-gray-900 dark:text-white">
          {post.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
          <span className="font-semibold text-gray-700 dark:text-gray-200">
            {post.author?.nickname ?? "(알수없음)"}
          </span>
          {post.author && <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />}
          <span className="text-gray-300">·</span>
          <span className="tabular-nums">{formatDateTime(post.created_at)}</span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1 text-gray-400">
            <Eye className="h-3 w-3" />
            {post.view_count}
          </span>

          {isOwner && (
            <span className="ml-auto flex gap-1">
              <Link
                href={`/board/${boardType}/write?id=${post.id}`}
                className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.05]"
              >
                <Pencil className="h-3 w-3" />
                수정
              </Link>
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[11px] text-red-500 transition hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-3 w-3" />
                삭제
              </button>
            </span>
          )}
        </div>

        {post.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt=""
            className="mt-4 max-h-96 w-full rounded-lg object-contain"
          />
        )}

        <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
          {post.content}
        </div>

        {/* PDF 다운로드 */}
        {post.file_url && (
          <a
            href={post.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 transition hover:bg-gray-100 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
          >
            <FileText className="h-6 w-6 shrink-0 text-violet-500" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {post.file_name ?? "첨부 파일"}
              </p>
              <p className="text-[10px] text-gray-500">
                새 탭에서 열기 / 다운로드
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">
              <Download className="h-3.5 w-3.5" />
              다운로드
            </span>
          </a>
        )}
      </article>

      {/* 댓글 ─────────────────────── */}
      <section className="mt-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.07] dark:bg-[#16162a]">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">
          댓글 {comments.length}
        </h2>

        {comments.length === 0 ? (
          <p className="mt-3 text-xs text-gray-400">
            아직 댓글이 없어요. 첫 댓글을 남겨보세요.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 dark:divide-white/[0.04]">
            {comments.map((c) => {
              const owner = !!user && user.id === c.author_id;
              return (
                <li key={c.id} className="py-3">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {c.author?.nickname ?? "(알수없음)"}
                    </span>
                    {c.author && (
                      <Badge role={c.author.role} className="text-[9px] py-0 px-1.5" />
                    )}
                    <span className="text-gray-300">·</span>
                    <span className="tabular-nums">{formatDateTime(c.created_at)}</span>
                    {owner && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm("이 댓글을 삭제하시겠어요?")) return;
                          await deleteComment(c.id);
                          await refreshComments();
                        }}
                        className="ml-auto text-red-500 transition hover:underline"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                    {c.content}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <CommentInput postId={post.id} onCreated={refreshComments} />
      </section>
    </motion.div>
  );
}

function CommentInput({
  postId,
  onCreated,
}: {
  postId: string;
  onCreated: () => Promise<void>;
}) {
  const { user } = useSupabaseProfile();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    return (
      <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
        로그인 후 댓글을 작성할 수 있습니다.
      </p>
    );
  }

  async function handleSubmit() {
    const t = text.trim();
    if (!t) return;
    setSubmitting(true);
    if (!user) {
      setSubmitting(false);
      return;
    }
    const { error } = await createComment({
      authorId: user.id,
      postId,
      content: t,
    });
    setSubmitting(false);
    if (error) {
      window.alert("댓글 작성에 실패했어요.");
      return;
    }
    setText("");
    await onCreated();
  }

  return (
    <div className="mt-4 flex items-end gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="댓글을 입력하세요"
        rows={2}
        disabled={submitting}
        className="min-h-[44px] flex-1 resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !text.trim()}
        className="flex h-11 items-center gap-1 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        등록
      </button>
    </div>
  );
}
