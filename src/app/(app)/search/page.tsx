"use client";

// /search?q=키워드 — 모든 게시판 통합 검색 결과.
// 익명 게시판은 결과에서 제외 (searchAllPosts 가 처리).
// PC/모바일 동일 UI — TopBar 검색창과 BottomNav 의 검색 버튼이 모두 이 페이지로 들어온다.
import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Search as SearchIcon, Loader2 } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { NicknameButton } from "@/components/profile/NicknameButton";
import { BOARD_LABEL, postDetailHref, searchAllPosts, type PostRow } from "@/lib/board";
import { displayAuthorNameFor } from "@/lib/author-display";
import { logSearch, normalizeKeyword } from "@/lib/search-log";

export default function SearchPage() {
  return (
    <AuthGate
      title="검색에는 로그인이 필요합니다"
      description="문태고 학생·교사·학부모·졸업생만 이용할 수 있어요."
    >
      <Suspense fallback={null}>
        <SearchInner />
      </Suspense>
    </AuthGate>
  );
}

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get("q") ?? "";

  const [input, setInput] = useState(initialQ);
  const [keyword, setKeyword] = useState(initialQ);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(false);

  // ?q= 변경 시 입력값/검색어를 동기화 (외부 링크 진입 대응)
  useEffect(() => {
    const next = params.get("q") ?? "";
    setInput(next);
    setKeyword(next);
  }, [params]);

  useEffect(() => {
    const k = normalizeKeyword(keyword);
    if (k.length < 2) {
      setPosts([]);
      return;
    }
    let active = true;
    setLoading(true);
    searchAllPosts(k, 60).then((rows) => {
      if (!active) return;
      setPosts(rows);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [keyword]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const k = normalizeKeyword(input);
    if (k.length < 2) return;
    void logSearch(input);
    // URL 갱신 — 새로고침/공유 시에도 같은 결과
    router.replace(`/search?q=${encodeURIComponent(k)}`);
    setKeyword(input);
  }

  return (
    <main className="mx-auto w-full max-w-screen-md px-4 py-6 md:py-10">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-foreground/55 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        홈으로
      </Link>

      <h1 className="text-lg font-extrabold tracking-tight md:text-xl">
        통합 검색
      </h1>
      <p className="mt-0.5 text-xs text-foreground/55">
        모든 게시판(익명 제외)의 글을 제목·내용에서 함께 찾아드려요.
      </p>

      <form
        onSubmit={submit}
        className="mt-4 flex h-11 items-center overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03] focus-within:border-violet-400"
      >
        <SearchIcon className="ml-3 h-4 w-4 shrink-0 text-foreground/40" />
        <input
          type="text"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="2글자 이상 입력해주세요"
          className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-foreground/35"
        />
        <button
          type="submit"
          className="h-full bg-violet-600 px-4 text-xs font-bold text-white transition-colors hover:bg-violet-700"
        >
          검색
        </button>
      </form>

      <SearchResults loading={loading} keyword={keyword} posts={posts} />
    </main>
  );
}

function SearchResults({
  loading,
  keyword,
  posts,
}: {
  loading: boolean;
  keyword: string;
  posts: PostRow[];
}) {
  const k = normalizeKeyword(keyword);

  const summary = useMemo(() => {
    if (k.length < 2) return null;
    return (
      <p className="mt-5 text-xs text-foreground/55">
        <span className="font-semibold text-foreground/80">&ldquo;{k}&rdquo;</span> 검색 결과{" "}
        <span className="font-extrabold text-violet-600 dark:text-violet-400">
          {posts.length}
        </span>
        건
      </p>
    );
  }, [k, posts.length]);

  if (loading) {
    return (
      <div className="mt-8 flex items-center justify-center text-sm text-foreground/50">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        검색 중…
      </div>
    );
  }
  if (k.length < 2) {
    return (
      <div className="mt-10 rounded-2xl border border-foreground/10 bg-foreground/[0.02] py-10 text-center text-sm text-foreground/50">
        검색어를 입력해주세요 (2글자 이상)
      </div>
    );
  }
  if (posts.length === 0) {
    return (
      <>
        {summary}
        <div className="mt-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] py-10 text-center text-sm text-foreground/50">
          일치하는 글이 없어요.
        </div>
      </>
    );
  }

  return (
    <>
      {summary}
      <ul className="mt-3 divide-y divide-foreground/5 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02]">
        {posts.map((p) => (
          <li key={p.id}>
            <Link
              href={postDetailHref(p.board_type, p.id, {
                challengeId: p.challenge_id,
                postCategory: p.post_category,
              })}
              className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-foreground/5 sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="shrink-0 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-300">
                {BOARD_LABEL[p.board_type]}
              </span>
              <span className="line-clamp-1 min-w-0 flex-1 text-sm font-medium">
                {p.title}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[11px] text-foreground/45">
                <NicknameButton userId={p.author?.id ?? null}>
                  {displayAuthorNameFor({
                    boardType: p.board_type,
                    author: p.author,
                  })}
                </NicknameButton>
                <span>·</span>
                <span className="tabular-nums">
                  {new Date(p.created_at).toLocaleDateString("ko-KR", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
