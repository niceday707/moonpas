"use client";

// 메인 피드 (/feed) — Threads 스타일
// - 정렬 탭, 해시태그 필터, 무한 스크롤
// - 새 글 알림 배너 (시뮬레이션된 백그라운드 업데이트)
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import {
  countNewPostsSince,
  fetchPosts,
  startBackgroundSim,
  subscribe,
  type Post,
  type Sort,
} from "@/lib/mock-data";
import { PostCard } from "@/components/feed/PostCard";
import { PostListSkeleton } from "@/components/feed/PostListSkeleton";
import { SortTabs } from "@/components/feed/SortTabs";
import { NewPostsBanner } from "@/components/feed/NewPostsBanner";
import { TrendingTags } from "@/components/feed/TrendingTags";
import { AuthGate } from "@/components/auth/AuthGate";

const PAGE_SIZE = 5;

export default function FeedPage() {
  // useSearchParams 는 Suspense 경계가 필요
  return (
    <AuthGate
      title="자유게시판은 로그인이 필요합니다"
      description="문태고 학생·교사·학부모·졸업생이 함께하는 자유게시판이에요. 로그인 후 글과 댓글을 남겨보세요."
    >
      <Suspense fallback={<PostListSkeleton rows={3} />}>
        <FeedPageInner />
      </Suspense>
    </AuthGate>
  );
}

function FeedPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sortParam = (searchParams.get("sort") as Sort | null) ?? "latest";
  const tagParam = searchParams.get("tag") ?? undefined;

  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<number | null>(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [seenAt, setSeenAt] = useState<number>(() => Date.now());
  const [newCount, setNewCount] = useState(0);
  const [bumpKey, setBumpKey] = useState(0); // 정렬/필터 바뀌었을 때 재로드 트리거

  const sentinelRef = useRef<HTMLDivElement>(null);

  // 정렬·태그 변경 시 리셋
  useEffect(() => {
    setPosts([]);
    setCursor(0);
    setInitialLoading(true);
    setNewCount(0);
    setSeenAt(Date.now());
    setBumpKey((k) => k + 1);
  }, [sortParam, tagParam]);

  // 첫 페이지 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { posts: page, nextCursor } = await fetchPosts({
        sort: sortParam,
        hashtag: tagParam,
        cursor: 0,
        limit: PAGE_SIZE,
      });
      if (cancelled) return;
      setPosts(page);
      setCursor(nextCursor);
      setInitialLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [bumpKey, sortParam, tagParam]);

  // 무한 스크롤 — sentinel 가시화 시 다음 페이지 로드
  const loadMore = useCallback(async () => {
    if (loadingMore || cursor === null) return;
    setLoadingMore(true);
    const { posts: page, nextCursor } = await fetchPosts({
      sort: sortParam,
      hashtag: tagParam,
      cursor,
      limit: PAGE_SIZE,
    });
    setPosts((prev) => [...prev, ...page]);
    setCursor(nextCursor);
    setLoadingMore(false);
  }, [loadingMore, cursor, sortParam, tagParam]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || cursor === null) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [loadMore, cursor]);

  // 백그라운드 시뮬레이션 시작
  useEffect(() => {
    startBackgroundSim();
  }, []);

  // 데이터 변경 구독 — 새 글 카운트 갱신
  // 최신순일 때 + 태그 필터 없을 때만 의미 있는 배너이므로 그 경우에만 활성화
  const showNewBanner = sortParam === "latest" && !tagParam;

  useEffect(() => {
    if (!showNewBanner) {
      setNewCount(0);
      return;
    }
    const recompute = () => setNewCount(countNewPostsSince(seenAt));
    recompute();
    const unsub = subscribe(recompute);
    const interval = setInterval(recompute, 5_000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [seenAt, showNewBanner]);

  const handleNewPostsClick = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setSeenAt(Date.now());
    setNewCount(0);
    setBumpKey((k) => k + 1);
  };

  const handleSortChange = (next: Sort) => {
    const p = new URLSearchParams(searchParams.toString());
    if (next === "latest") p.delete("sort");
    else p.set("sort", next);
    const qs = p.toString();
    router.replace(qs ? `/feed?${qs}` : "/feed", { scroll: false });
  };

  const headerLabel = useMemo(() => {
    if (tagParam) return `#${tagParam}`;
    return "메인 피드";
  }, [tagParam]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* 헤더 */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight md:text-3xl">
              {tagParam ? <span className="text-gradient">{headerLabel}</span> : headerLabel}
            </h1>
            <p className="mt-0.5 text-xs text-foreground/55">
              {tagParam
                ? `${headerLabel} 태그가 달린 글을 모았어요`
                : "Threads 스타일 자유게시판"}
            </p>
          </div>
          <SortTabs value={sortParam} onChange={handleSortChange} />
        </div>

        {tagParam && (
          <Link
            href="/feed"
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1 text-xs text-foreground/70 hover:bg-foreground/10"
          >
            <X className="h-3.5 w-3.5" />
            태그 필터 해제
          </Link>
        )}

        {!tagParam && <TrendingTags />}
      </div>

      {/* 새 글 N개 배너 */}
      {showNewBanner && (
        <NewPostsBanner count={newCount} onClick={handleNewPostsClick} />
      )}

      {/* 본문 */}
      {initialLoading ? (
        <PostListSkeleton rows={3} />
      ) : posts.length === 0 ? (
        <EmptyState tag={tagParam} />
      ) : (
        <motion.div layout className="flex flex-col gap-4">
          <AnimatePresence initial={false} mode="popLayout">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </AnimatePresence>

          {/* 무한 스크롤 sentinel */}
          <div
            ref={sentinelRef}
            className="flex h-16 items-center justify-center text-foreground/40"
          >
            {cursor !== null ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span className="text-xs">— 끝까지 봤어요 —</span>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function EmptyState({ tag }: { tag?: string }) {
  return (
    <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-16 text-center">
      <p className="text-base font-semibold">
        {tag ? `#${tag} 글이 아직 없어요` : "아직 글이 없어요"}
      </p>
      <p className="text-sm text-foreground/55">
        오른쪽 아래 + 버튼으로 첫 글을 남겨보세요.
      </p>
    </div>
  );
}
