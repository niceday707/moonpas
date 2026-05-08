"use client";

// 문태 에타 — 감성 밤하늘 익명 게시판 (/board/anonymous)
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp,
  Eye,
  Heart,
  Image as ImageIcon,
  Loader2,
  Lock,
  MessageCircle,
  X,
} from "lucide-react";
import {
  createPost,
  incrementLikeCount,
  listPosts,
  type PostRow,
} from "@/lib/board";
import { useSupabaseUser } from "@/lib/supabase-profile";
import { uploadImage } from "@/lib/storage";
import { addLikedPost, getLikedPosts } from "@/lib/local-state";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ANON_TAGS, parseAnonContent, getTagInfo, type AnonTagKey } from "./anon-utils";

type SortType = "latest" | "popular" | "comments";

// ── 반짝이는 별 ────────────────────────────────────────────
type Star = { id: number; top: string; left: string; size: number; duration: number; delay: number };

function Stars() {
  const [stars, setStars] = useState<Star[]>([]);
  useEffect(() => {
    setStars(
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        top: `${Math.random() * 85}%`,
        left: `${Math.random() * 100}%`,
        size: Math.random() * 2.5 + 1.5,
        duration: Math.random() * 3 + 2,
        delay: Math.random() * 4,
      })),
    );
  }, []);
  return (
    <>
      {stars.map((s) => (
        <motion.div
          key={s.id}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size }}
          animate={{ opacity: [0.1, 1, 0.1] }}
          transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
        />
      ))}
    </>
  );
}

// ── 글 카드 ────────────────────────────────────────────────
function AnonCard({
  post,
  liked,
  onLike,
}: {
  post: PostRow;
  liked: boolean;
  onLike: (e: React.MouseEvent) => void;
}) {
  const { tag, body } = parseAnonContent(post.content);
  const tagInfo = getTagInfo(tag);

  return (
    <Link href={`/board/anonymous/${post.id}`} className="block">
      <motion.article
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22 }}
        className={cn(
          "rounded-2xl border border-white/[0.08] p-4 cursor-pointer",
          "bg-white/[0.06] backdrop-blur-xl",
          "transition-all duration-200",
          "hover:-translate-y-0.5 hover:border-violet-400/40",
          "hover:shadow-[0_8px_32px_rgba(167,139,250,0.12)]",
        )}
      >
        {/* 상단: 태그 + 시간 */}
        <div className="flex items-center gap-2 mb-2.5">
          {tagInfo ? (
            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", tagInfo.color)}>
              {tagInfo.emoji} {tagInfo.label}
            </span>
          ) : (
            <span className="text-[11px] text-white/30">🌙 익명</span>
          )}
          <span className="text-[11px] text-white/35 ml-auto">{relativeTime(post.created_at)}</span>
        </div>

        {/* 제목 */}
        {post.title && (
          <h2 className="text-sm font-bold text-white mb-1.5 leading-snug">{post.title}</h2>
        )}

        {/* 본문 미리보기 */}
        <p className="text-sm text-white/70 leading-relaxed line-clamp-3">{body}</p>

        {/* 썸네일 */}
        {post.image_url && (
          <div className="mt-3 rounded-xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.image_url}
              alt=""
              className="w-full h-32 object-cover"
            />
          </div>
        )}

        {/* 하단: 공감/댓글/조회 */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.07]">
          <button
            type="button"
            onClick={onLike}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              liked ? "text-pink-400" : "text-white/35 hover:text-pink-400",
            )}
          >
            <Heart className={cn("h-3.5 w-3.5 transition-all", liked && "fill-current scale-110")} />
            {post.like_count}
          </button>
          <span className="flex items-center gap-1.5 text-xs text-white/35">
            <MessageCircle className="h-3.5 w-3.5" />
            {post.comment_count}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-white/35 ml-auto">
            <Eye className="h-3.5 w-3.5" />
            {post.view_count}
          </span>
        </div>
      </motion.article>
    </Link>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────
export default function AnonBoardPage() {
  const { user } = useSupabaseUser();

  // 피드 상태
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sort, setSort] = useState<SortType>("latest");
  const [tagFilter, setTagFilter] = useState<AnonTagKey | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [newCount, setNewCount] = useState(0);
  const [newestAt, setNewestAt] = useState("");

  // 컴포저 상태
  const [composerOpen, setComposerOpen] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [bodyInput, setBodyInput] = useState("");
  const [selectedTag, setSelectedTag] = useState<AnonTagKey | null>(null);
  const [posting, setPosting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const feedTopRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 좋아요 상태 초기화
  useEffect(() => {
    setLikedIds(getLikedPosts());
  }, []);

  // 글 로드
  const loadPosts = useCallback(
    async (pageNum: number, reset = false) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const contentLike = tagFilter ? `%"tag":"${tagFilter}"%` : null;
      const { posts: fetched, total } = await listPosts("anonymous", pageNum, {
        contentLike,
        sortBy: sort === "popular" ? "like_count" : "created_at",
      });

      if (reset || pageNum === 1) {
        if (fetched.length > 0) setNewestAt(fetched[0].created_at);
        setPosts(fetched);
      } else {
        setPosts((prev) => [...prev, ...fetched]);
      }

      setHasMore(pageNum * 20 < total);
      setLoading(false);
      setLoadingMore(false);
    },
    [tagFilter, sort],
  );

  // 초기 로드 + 필터/정렬 변경 시 리셋
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setNewCount(0);
    loadPosts(1, true);
  }, [loadPosts]);

  // 무한 스크롤 IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          const next = page + 1;
          setPage(next);
          loadPosts(next);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, page, loadPosts]);

  // 30초마다 새 글 확인
  useEffect(() => {
    if (!newestAt) return;
    const interval = setInterval(async () => {
      const { posts: fresh } = await listPosts("anonymous", 1, {
        contentLike: tagFilter ? `%"tag":"${tagFilter}"%` : null,
      });
      const newer = fresh.filter((p) => p.created_at > newestAt);
      if (newer.length > 0) setNewCount(newer.length);
    }, 30000);
    return () => clearInterval(interval);
  }, [newestAt, tagFilter]);

  // 새 글 불러오기
  const loadNewPosts = async () => {
    setNewCount(0);
    await loadPosts(1, true);
    setPage(1);
    feedTopRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 좋아요
  const handleLike = async (e: React.MouseEvent, postId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || likedIds.has(postId)) return;
    addLikedPost(postId);
    setLikedIds((prev) => new Set([...prev, postId]));
    const { nextCount } = await incrementLikeCount(postId);
    if (nextCount !== null) {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, like_count: nextCount } : p)));
    }
  };

  // 이미지 선택
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // 게시
  const handlePost = async () => {
    if (!user || !bodyInput.trim()) return;
    setPosting(true);
    let imageUrl: string | null = null;
    if (imageFile) imageUrl = await uploadImage(imageFile, user.id);
    const content = JSON.stringify({ tag: selectedTag, body: bodyInput.trim() });

    // 제목이 비어있으면 본문 첫 줄에서 자동 추출 — posts.title NOT NULL/CHECK 제약 회피
    const trimmedTitle = titleInput.trim();
    const fallbackTitle =
      bodyInput.trim().split(/\r?\n/)[0]?.slice(0, 100).trim() || "(제목 없음)";
    const finalTitle = trimmedTitle || fallbackTitle;

    const { error, code, details, hint } = await createPost({
      authorId: user.id,
      boardType: "anonymous",
      title: finalTitle,
      content,
      imageUrl,
    });
    if (!error) {
      setTitleInput("");
      setBodyInput("");
      setSelectedTag(null);
      setImageFile(null);
      setImagePreview(null);
      setComposerOpen(false);
      await loadPosts(1, true);
      setPage(1);
      feedTopRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      // 사용자에게 원인 노출 — 콘솔 로그도 board.ts 에서 이미 남기지만 alert 로 즉시 알림
      const lines = [
        "게시에 실패했습니다.",
        `사유: ${error}`,
        code ? `code: ${code}` : null,
        details ? `details: ${details}` : null,
        hint ? `hint: ${hint}` : null,
      ].filter(Boolean);
      alert(lines.join("\n"));
    }
    setPosting(false);
  };

  const displayPosts =
    sort === "comments"
      ? [...posts].sort((a, b) => b.comment_count - a.comment_count)
      : posts;

  return (
    <div
      className="relative min-h-screen"
      style={{ background: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}
    >
      {/* 별 레이어 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Stars />
        <div className="absolute right-8 top-8 text-5xl opacity-[0.12] select-none">🌙</div>
      </div>

      {/* ── 히어로 ── */}
      <div className="relative flex h-[160px] flex-col items-center justify-center text-center px-4 md:h-[200px]">
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-[28px] font-extrabold text-white tracking-tight"
        >
          문태 에타 🌙
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="mt-2 text-sm tracking-[0.18em] text-violet-300/80"
        >
          여기선 솔직해도 괜찮아요
        </motion.p>
      </div>

      {/* 물결 SVG 디바이더 */}
      <div className="-mb-px">
        <svg viewBox="0 0 1440 36" xmlns="http://www.w3.org/2000/svg" className="w-full" aria-hidden>
          <path
            d="M0 36 C360 0 720 36 1080 18 C1260 9 1380 30 1440 20 L1440 36 Z"
            fill="rgba(255,255,255,0.025)"
          />
        </svg>
      </div>

      {/* ── 컨텐츠 영역 ── */}
      <div className="relative mx-auto max-w-screen-lg px-3 pb-32 pt-2 md:px-6">
        <div className="flex gap-6">
          {/* ── 메인 피드 ── */}
          <div className="min-w-0 flex-1">
            {/* 글쓰기 컴포저 */}
            <div className="mb-4">
              <div
                className={cn(
                  "rounded-2xl border transition-all duration-300",
                  "bg-white/[0.06] backdrop-blur-xl",
                  composerOpen
                    ? "border-violet-400/40 shadow-[0_0_24px_rgba(167,139,250,0.12)]"
                    : "border-white/[0.08]",
                )}
              >
                {!composerOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        alert("로그인이 필요해요");
                        return;
                      }
                      setComposerOpen(true);
                    }}
                    className="w-full px-4 py-4 text-left text-sm text-white/35 hover:text-white/55 transition-colors"
                  >
                    무슨 생각을 하고 있나요? ✨
                  </button>
                ) : (
                  <div className="p-4">
                    <input
                      type="text"
                      placeholder="제목 (선택 — 없으면 본문 첫 줄로 표시)"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      className="w-full bg-transparent text-sm font-semibold text-white placeholder-white/25 outline-none pb-2.5 mb-3 border-b border-white/[0.09]"
                    />
                    <textarea
                      autoFocus
                      placeholder="솔직한 이야기를 써보세요..."
                      value={bodyInput}
                      onChange={(e) => setBodyInput(e.target.value)}
                      rows={4}
                      className="w-full bg-transparent text-sm text-white/90 placeholder-white/25 outline-none resize-none leading-relaxed"
                    />

                    {/* 이미지 미리보기 */}
                    {imagePreview && (
                      <div className="relative mt-2 rounded-xl overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imagePreview} alt="" className="w-full max-h-40 object-cover" />
                        <button
                          type="button"
                          onClick={() => { setImageFile(null); setImagePreview(null); }}
                          className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* 태그 선택 */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {ANON_TAGS.map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setSelectedTag(selectedTag === t.key ? null : t.key)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] transition-all",
                            selectedTag === t.key
                              ? cn(t.color, "shadow-[0_0_10px_rgba(167,139,250,0.25)]")
                              : "border-white/10 text-white/35 hover:border-white/20 hover:text-white/55",
                          )}
                        >
                          {t.emoji} {t.label}
                        </button>
                      ))}
                    </div>

                    {/* 툴바 */}
                    <div className="mt-4 flex items-center gap-3 border-t border-white/[0.07] pt-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageSelect}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-white/35 hover:text-white/65 transition-colors"
                        title="이미지 첨부"
                      >
                        <ImageIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setComposerOpen(false); setTitleInput(""); setBodyInput(""); setSelectedTag(null); setImageFile(null); setImagePreview(null); }}
                        className="text-white/25 hover:text-white/50 transition-colors text-xs"
                      >
                        취소
                      </button>
                      <span className="ml-auto flex items-center gap-1 text-[10px] text-white/25">
                        <Lock className="h-3 w-3" />
                        완전 익명으로 게시됩니다 🔒
                      </span>
                      <button
                        type="button"
                        onClick={handlePost}
                        disabled={!bodyInput.trim() || posting}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                          "bg-gradient-to-r from-violet-500 to-purple-600 text-white",
                          "hover:shadow-[0_0_20px_rgba(124,58,237,0.45)]",
                          "disabled:cursor-not-allowed disabled:opacity-40",
                        )}
                      >
                        {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "✨ 게시"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 태그 필터 가로 스크롤 */}
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
              <button
                type="button"
                onClick={() => setTagFilter(null)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-all",
                  tagFilter === null
                    ? "border-violet-400/50 bg-violet-500/20 text-violet-300 shadow-[0_0_10px_rgba(167,139,250,0.15)]"
                    : "border-white/[0.09] text-white/45 hover:border-white/20 hover:text-white/65",
                )}
              >
                전체
              </button>
              {ANON_TAGS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTagFilter(tagFilter === t.key ? null : t.key)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-all",
                    tagFilter === t.key
                      ? cn(t.color, "shadow-[0_0_10px_rgba(167,139,250,0.15)]")
                      : "border-white/[0.09] text-white/45 hover:border-white/20 hover:text-white/65",
                  )}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>

            {/* 정렬 탭 */}
            <div ref={feedTopRef} className="mb-3 flex items-center gap-1.5">
              {(["latest", "popular", "comments"] as SortType[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSort(s)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                    sort === s
                      ? "border border-violet-400/40 bg-violet-500/15 text-violet-300"
                      : "text-white/40 hover:text-white/65",
                  )}
                >
                  {s === "latest" ? "최신" : s === "popular" ? "인기" : "댓글많은"}
                </button>
              ))}
            </div>

            {/* 새 글 배너 */}
            <AnimatePresence>
              {newCount > 0 && (
                <motion.button
                  type="button"
                  onClick={loadNewPosts}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-400/30 bg-violet-500/10 py-2.5 text-sm font-semibold text-violet-300 transition-colors hover:bg-violet-500/15"
                >
                  <ChevronUp className="h-4 w-4" />
                  새 글 {newCount}개 확인하기
                </motion.button>
              )}
            </AnimatePresence>

            {/* 피드 */}
            {loading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
                ))}
              </div>
            ) : displayPosts.length === 0 ? (
              <div className="py-24 text-center">
                <div className="mb-3 text-5xl">🌙</div>
                <p className="text-sm text-white/35">아직 글이 없어요. 첫 번째 글을 써보세요!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {displayPosts.map((post) => (
                    <AnonCard
                      key={post.id}
                      post={post}
                      liked={likedIds.has(post.id)}
                      onLike={(e) => handleLike(e, post.id)}
                    />
                  ))}
                </AnimatePresence>

                {/* 무한 스크롤 sentinel */}
                <div ref={sentinelRef} className="h-4" />

                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                  </div>
                )}

                {!hasMore && posts.length > 0 && (
                  <p className="py-4 text-center text-xs text-white/20">모든 글을 불러왔어요 🌙</p>
                )}
              </div>
            )}
          </div>

          {/* ── PC 사이드바 ── */}
          <aside className="hidden w-60 shrink-0 lg:flex lg:flex-col gap-4 pt-1">
            {/* 태그 클라우드 */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-4">
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/50">
                태그 탐색
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {ANON_TAGS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTagFilter(t.key)}
                    className={cn(
                      "rounded-full border px-2 py-1 text-[11px] transition-opacity hover:opacity-75",
                      t.color,
                    )}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 지금 뜨는 글 TOP 5 */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-4">
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/50">
                지금 뜨는 글 🔥
              </h3>
              {posts.length === 0 ? (
                <p className="text-xs text-white/25">아직 글이 없어요</p>
              ) : (
                <ul className="space-y-0">
                  {[...posts]
                    .sort((a, b) => b.like_count + b.view_count - (a.like_count + a.view_count))
                    .slice(0, 5)
                    .map((p, i) => {
                      const { body } = parseAnonContent(p.content);
                      return (
                        <li key={p.id}>
                          <Link
                            href={`/board/anonymous/${p.id}`}
                            className="flex items-start gap-2 py-2 hover:opacity-65 transition-opacity"
                          >
                            <span className="mt-0.5 shrink-0 text-xs font-bold text-violet-400">{i + 1}</span>
                            <p className="line-clamp-2 text-xs leading-relaxed text-white/65">
                              {p.title || body}
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>

            {/* 오늘 통계 */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-4">
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/50">
                오늘 에타 📊
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/45">글</span>
                  <span className="font-semibold text-violet-300">{posts.length}개</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/45">총 공감</span>
                  <span className="font-semibold text-pink-300">
                    {posts.reduce((s, p) => s + p.like_count, 0)}개
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/45">총 댓글</span>
                  <span className="font-semibold text-cyan-300">
                    {posts.reduce((s, p) => s + p.comment_count, 0)}개
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* 모바일 FAB — 글쓰기 */}
      <button
        type="button"
        aria-label="글쓰기"
        onClick={() => {
          if (!user) { alert("로그인이 필요해요"); return; }
          setComposerOpen(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className={cn(
          "fixed bottom-24 right-4 z-30 lg:hidden",
          "flex h-14 w-14 items-center justify-center rounded-full text-xl",
          "bg-gradient-to-br from-violet-500 to-purple-700 text-white",
          "shadow-[0_4px_24px_rgba(124,58,237,0.55)]",
          "hover:shadow-[0_4px_32px_rgba(124,58,237,0.7)]",
          "transition-shadow",
        )}
      >
        ✏️
      </button>
    </div>
  );
}
