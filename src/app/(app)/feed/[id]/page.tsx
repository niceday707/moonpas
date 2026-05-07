"use client";

// 게시글 상세 — 원글 + 통합 댓글/대댓글 섹션
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import {
  fetchPostById,
  subscribe,
  type Post,
} from "@/lib/mock-data";
import { PostCard } from "@/components/feed/PostCard";
import { PostListSkeleton } from "@/components/feed/PostListSkeleton";
import { AuthGate } from "@/components/auth/AuthGate";
import { CommentSection } from "@/components/comments/CommentSection";

type PageProps = {
  // Next 14: params is plain object, but `use()` 호환을 위해 Promise 타입도 허용
  params: { id: string } | Promise<{ id: string }>;
};

export default function PostDetailPage(props: PageProps) {
  return (
    <AuthGate
      title="자유게시판은 로그인이 필요합니다"
      description="글 상세와 댓글을 보려면 로그인해 주세요."
    >
      <PostDetailInner {...props} />
    </AuthGate>
  );
}

function PostDetailInner(props: PageProps) {
  // params가 Promise인 경우 use()로 풀고, 아니면 그대로 사용
  const params =
    typeof (props.params as { then?: unknown }).then === "function"
      ? use(props.params as Promise<{ id: string }>)
      : (props.params as { id: string });

  const id = params.id;
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const p = await fetchPostById(id);
      if (cancelled) return;
      setPost(p);
      setLoading(false);
    };
    load();
    const unsub = subscribe(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [id]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* 헤더 */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로"
          className="grid h-10 w-10 place-items-center rounded-full glass transition-colors hover:bg-foreground/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-extrabold tracking-tight md:text-2xl">
          글 상세
        </h1>
      </div>

      {loading ? (
        <PostListSkeleton rows={1} />
      ) : !post ? (
        <NotFound />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-4 pb-20"
        >
          <PostCard post={post} asLink={false} />
          <CommentSection targetId={`feed:${post.id}`} />
        </motion.div>
      )}
    </div>
  );
}

function NotFound() {
  return (
    <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-16 text-center">
      <p className="text-base font-semibold">글을 찾을 수 없어요</p>
      <p className="text-sm text-foreground/55">삭제되었거나 잘못된 주소예요.</p>
    </div>
  );
}
