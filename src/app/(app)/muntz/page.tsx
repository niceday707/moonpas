"use client";

// ============================================================================
// 문츠(Muntz) — 모바일 몰입형 fullscreen 쇼츠 뷰어 + 학생/교사 수동 등록
// ----------------------------------------------------------------------------
// - 페이지 자체가 `fixed inset-0` 로 화면을 덮어 AppShell 의 TopBar/main 패딩 위로
//   올라간다. BottomNav 는 AppShell 에서 /muntz 일 때 숨김 처리.
// - 한 슬라이드 = 100dvh. snap-y snap-mandatory 로 한 영상씩 착착 넘어감.
// - 비디오는 9:16 비율 유지. 모바일은 폭 가득(`w=min(100%, 100dvh*9/16)`),
//   PC는 가운데 폰 프레임(`max-w-[420px]`) 안에서 같은 피드가 동작.
// - 영상은 서버 저장 없음 — 공식 youtube-nocookie iframe 만 사용.
//
// 데이터 흐름:
//   1) Supabase `muntz_items` 에서 visible / auto_approved 만 최신순 조회.
//   2) 조회 실패 시 MUNTZ_ITEMS_FALLBACK 으로 빈 화면 방지.
//   3) 학생/교사가 우상단 + 버튼으로 새 쇼츠 등록 (RLS 가 권한 강제).
//   4) 각 카드의 ⋯ 버튼 → 숨김 처리 (RLS 가 본인/admin 만 통과).
//
// ⚠️ TODO(검수): 등록된 영상의 실제 내용은 사람이 최종 검수하는 것이 원칙.
//    1차 정책은 "등록 즉시 노출 + 문제시 숨김" — 사후 대응에 의존.
// ============================================================================
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  Heart,
  Loader2,
  MoreVertical,
  Plus,
  Share2,
  X,
} from "lucide-react";
import {
  MUNTZ_ITEMS_FALLBACK,
  MUNTZ_CATEGORIES,
  CATEGORY_COLOR,
  TARGET_GRADE_LABEL,
  extractYoutubeId,
  muntzEmbedUrl,
  type MuntzCategory,
  type MuntzItem,
  type TargetGrade,
} from "@/lib/muntz-data";
import {
  createMuntzItem,
  hideMuntzItem,
  listVisibleMuntzItems,
} from "@/lib/muntz-service";
import { findBannedWordInFields } from "@/lib/muntz-profanity";
import { useSupabaseUser } from "@/lib/supabase-profile";
import { cn } from "@/lib/utils";

type Tab = "전체" | MuntzCategory;
const TABS: Tab[] = ["전체", ...MUNTZ_CATEGORIES];

export default function MuntzPage() {
  const router = useRouter();
  const { user } = useSupabaseUser();
  const [tab, setTab] = useState<Tab>("전체");
  const [items, setItems] = useState<MuntzItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Supabase 에서 visible/auto_approved 조회. 빈 결과 또는 실패 시 fallback.
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const remote = await listVisibleMuntzItems();
      if (remote.length === 0) {
        setItems(MUNTZ_ITEMS_FALLBACK);
        setUsingFallback(true);
      } else {
        setItems(remote);
        setUsingFallback(false);
      }
    } catch {
      setItems(MUNTZ_ITEMS_FALLBACK);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo<MuntzItem[]>(
    () =>
      tab === "전체" ? items : items.filter((it) => it.category === tab),
    [items, tab],
  );

  // 페이지 진입 동안 body 스크롤 잠금 — fullscreen 뷰어 밖으로 스크롤 새는 것 방지.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 토스트 자동 사라짐
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleHide = useCallback(
    async (id: string) => {
      // 낙관적 UI — 먼저 화면에서 제거하고, 실패하면 reload 로 되돌림.
      const before = items;
      setItems((prev) => prev.filter((it) => it.id !== id));
      const res = await hideMuntzItem(id);
      if (!res.ok) {
        setItems(before);
      }
      setToast(res.message);
    },
    [items],
  );

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      {/* 어두운 글로우 그라데이션 — PC 에서 폰 프레임 양 옆 분위기. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(124,58,237,0.25),transparent_60%)]"
      />

      {/* PC: 가운데 정렬 + 폰 프레임. 모바일: 화면 가득. */}
      <div className="relative mx-auto h-[100dvh] w-full max-w-full md:max-w-[420px] md:rounded-[2.25rem] md:overflow-hidden md:my-4 md:h-[calc(100dvh-2rem)] md:ring-1 md:ring-white/10 md:shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        {/* 상단 오버레이 — 뒤로가기 + 타이틀 + 카테고리 필터 */}
        <TopOverlay
          tab={tab}
          onTabChange={setTab}
          onBack={() => router.back()}
          onUploadClick={() => setUploadOpen(true)}
        />

        {/* 피드 / 로딩 / 빈 상태 */}
        {loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState onUploadClick={() => setUploadOpen(true)} />
        ) : (
          <div
            className={cn(
              "h-full snap-y snap-mandatory overflow-y-scroll scroll-smooth",
              // 모바일 사파리 momentum 스크롤
              "[-webkit-overflow-scrolling:touch]",
              // 스크롤바 숨김 (몰입감)
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}
          >
            {filtered.map((it) => (
              <Slide
                key={`${tab}:${it.id}`}
                item={it}
                onHide={() => void handleHide(it.id)}
              />
            ))}
          </div>
        )}

        {/* fallback 배너 — Supabase 데이터 없을 때 안내 */}
        {usingFallback && !loading && (
          <div className="pointer-events-none absolute bottom-[max(env(safe-area-inset-bottom),0.5rem)] left-1/2 z-30 -translate-x-1/2 rounded-full bg-amber-500/90 px-3 py-1 text-[11px] font-semibold text-black shadow-lg">
            아직 등록된 영상이 없어 샘플을 보여드리고 있어요
          </div>
        )}

        {/* 토스트 */}
        <AnimatePresence>
          {toast && (
            <motion.div
              key="toast"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-none absolute left-1/2 top-20 z-40 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 업로드 모달 */}
      <AnimatePresence>
        {uploadOpen && (
          <UploadModal
            userId={user?.id ?? null}
            onClose={() => setUploadOpen(false)}
            onSuccess={(message) => {
              setToast(message);
              setUploadOpen(false);
              void reload();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 상단 오버레이 ──────────────────────────────────────────────────────────
function TopOverlay({
  tab,
  onTabChange,
  onBack,
  onUploadClick,
}: {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onBack: () => void;
  onUploadClick: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 px-3 pt-[max(env(safe-area-inset-top),0.5rem)]">
      {/* 1행: 뒤로가기 + 타이틀 + 등록 버튼 */}
      <div className="pointer-events-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로 가기"
          className="grid h-10 w-10 place-items-center rounded-full bg-black/40 backdrop-blur-md transition-colors hover:bg-black/60"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-sm font-bold tracking-tight">
          문츠 <span aria-hidden>🎬</span>
        </div>
        <button
          type="button"
          onClick={onUploadClick}
          aria-label="문츠 영상 등록"
          className="grid h-10 w-10 place-items-center rounded-full bg-violet-600/80 text-white shadow-[0_4px_14px_rgba(124,58,237,0.5)] backdrop-blur-md transition-colors hover:bg-violet-500"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>

      {/* 2행: 카테고리 필터 — 작은 칩, 가로 스크롤 */}
      <div
        role="tablist"
        aria-label="문츠 카테고리"
        className={cn(
          "pointer-events-auto -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {TABS.map((t) => {
          const active = tab === t;
          const accent = t === "전체" ? "#7c3aed" : CATEGORY_COLOR[t];
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(t)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold backdrop-blur-md transition-colors",
                active
                  ? "text-white shadow-[0_4px_14px_rgba(0,0,0,0.4)]"
                  : "bg-white/10 text-white/80 hover:bg-white/20",
              )}
              style={active ? { backgroundColor: accent } : undefined}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 슬라이드 (1영상) ───────────────────────────────────────────────────────
function Slide({
  item,
  onHide,
}: {
  item: MuntzItem;
  onHide: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center bg-black">
      {/* 비디오: 9:16 비율 유지 — 화면 폭과 (100dvh*9/16) 중 작은 값 */}
      <div
        className={cn(
          "relative aspect-[9/16] overflow-hidden bg-neutral-900",
          // width 는 화면에 맞춰 항상 9:16 비율로 들어가도록 clamp.
          "w-[min(100%,calc(100dvh*9/16))]",
          // 모서리는 모바일은 직각, PC 폰 프레임 내부는 살짝 둥글게.
          "md:rounded-[1.75rem]",
        )}
      >
        <iframe
          src={muntzEmbedUrl(item.youtubeId)}
          title={item.title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          loading="lazy"
        />

        {/* 하단 그라데이션 — 텍스트 가독성 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent"
        />

        {/* 우상단 더보기 (신고/숨김) 메뉴 */}
        <div className="absolute right-3 top-3 z-20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            aria-label="더보기"
            className="grid h-9 w-9 place-items-center rounded-full bg-black/50 backdrop-blur-md transition-colors hover:bg-black/70"
          >
            <MoreVertical className="h-4 w-4 text-white" strokeWidth={2.2} />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-hidden
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div
                role="menu"
                className="absolute right-0 top-11 z-20 min-w-[140px] overflow-hidden rounded-xl border border-white/10 bg-neutral-900/95 text-xs font-semibold text-white shadow-xl backdrop-blur-md"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    if (
                      window.confirm(
                        "이 영상을 숨김 처리할까요?\n관리자/본인만 처리할 수 있어요.",
                      )
                    ) {
                      onHide();
                    }
                  }}
                  className="block w-full px-3 py-2.5 text-left text-rose-300 hover:bg-white/5"
                >
                  신고 / 숨김 처리
                </button>
                {item.youtubeUrl && (
                  <a
                    role="menuitem"
                    href={item.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full border-t border-white/10 px-3 py-2.5 text-left text-white/80 hover:bg-white/5"
                  >
                    유튜브에서 보기 ↗
                  </a>
                )}
              </div>
            </>
          )}
        </div>

        {/* 하단 정보 오버레이 */}
        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-5 pr-16">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            <span
              className="rounded-full px-2 py-0.5 text-white"
              style={{ backgroundColor: CATEGORY_COLOR[item.category] }}
            >
              {item.category}
            </span>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-white backdrop-blur-md">
              {TARGET_GRADE_LABEL[item.targetGrade]}
            </span>
          </div>

          <p className="mt-2 text-[13px] font-semibold text-violet-300">
            @{item.authorNickname}
          </p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-snug">
            {item.title}
          </h2>

          {/* 설명 — 1~2줄만 + 더보기 토글 */}
          {item.description && (
            <div className="mt-1 text-[13px] leading-snug text-white/85">
              <p className={expanded ? "" : "line-clamp-2"}>{item.description}</p>
              {item.description.length > 40 && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 text-[12px] font-semibold text-white/70 underline-offset-2 hover:underline"
                  aria-expanded={expanded}
                >
                  {expanded ? "접기" : "더보기"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* 우측 액션 버튼 (더미) */}
        <div className="absolute bottom-6 right-3 z-10 flex flex-col items-center gap-4">
          <ActionButton
            label="좋아요"
            icon={Heart}
            active={liked}
            activeColor="#ec4899"
            onClick={() => setLiked((v) => !v)}
          />
          <ActionButton
            label="공유"
            icon={Share2}
            onClick={() => {
              // 더미 — 실제 공유는 추후 구현
            }}
          />
          <ActionButton
            label="저장"
            icon={Bookmark}
            active={saved}
            activeColor="#f59e0b"
            onClick={() => setSaved((v) => !v)}
          />
        </div>
      </div>
    </section>
  );
}

// ─── 우측 액션 버튼 ─────────────────────────────────────────────────────────
function ActionButton({
  label,
  icon: Icon,
  active = false,
  activeColor,
  onClick,
}: {
  label: string;
  icon: typeof Heart;
  active?: boolean;
  activeColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className="group flex flex-col items-center gap-1"
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-md transition-transform group-active:scale-90">
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={active ? "on" : "off"}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Icon
              className="h-5 w-5"
              strokeWidth={2.2}
              style={
                active && activeColor
                  ? { color: activeColor, fill: activeColor }
                  : { color: "white" }
              }
            />
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="text-[10px] font-semibold text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        {label}
      </span>
    </button>
  );
}

// ─── 로딩 상태 ──────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/60">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>문츠 불러오는 중...</span>
      </div>
    </div>
  );
}

// ─── 빈 상태 ────────────────────────────────────────────────────────────────
function EmptyState({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div className="flex flex-col items-center gap-3 text-sm text-white/70">
        <p>해당 카테고리에 아직 등록된 쇼츠가 없어요.</p>
        <button
          type="button"
          onClick={onUploadClick}
          className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(124,58,237,0.5)] hover:bg-violet-500"
        >
          + 첫 번째 영상 올리기
        </button>
      </div>
    </div>
  );
}

// ─── 업로드 모달 ────────────────────────────────────────────────────────────
function UploadModal({
  userId,
  onClose,
  onSuccess,
}: {
  userId: string | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [authorNickname, setAuthorNickname] = useState("");
  const [category, setCategory] = useState<MuntzCategory>(MUNTZ_CATEGORIES[0]);
  const [targetGrade, setTargetGrade] = useState<TargetGrade>("all");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const youtubeId = useMemo(() => extractYoutubeId(url), [url]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError("로그인 정보를 확인할 수 없습니다. 다시 로그인 후 시도해주세요.");
      return;
    }
    if (!youtubeId) {
      setError("유효한 유튜브 쇼츠 링크가 아닙니다. 11자리 영상 ID 가 필요해요.");
      return;
    }
    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!authorNickname.trim()) {
      setError("작성자 닉네임을 입력해주세요.");
      return;
    }

    const bannedHit = findBannedWordInFields([title, description, authorNickname]);
    if (bannedHit) {
      setError(`부적절한 단어가 포함되어 있어요: "${bannedHit}"`);
      return;
    }

    setSubmitting(true);
    const youtubeUrl = `https://www.youtube.com/shorts/${youtubeId}`;
    const res = await createMuntzItem(
      {
        youtubeId,
        youtubeUrl,
        title: title.trim(),
        authorNickname: authorNickname.trim(),
        category,
        targetGrade,
        description: description.trim() || undefined,
      },
      userId,
    );
    setSubmitting(false);

    if (!res.ok) {
      setError(res.message);
      return;
    }
    onSuccess("문츠에 등록되었습니다!");
  };

  return (
    <motion.div
      key="upload-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="문츠 영상 등록"
    >
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-neutral-950 text-white shadow-2xl sm:rounded-3xl"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-bold">문츠 영상 등록</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="max-h-[75vh] overflow-y-auto px-5 py-4 [scrollbar-width:thin]"
        >
          <Field label="유튜브 쇼츠 링크" required>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/shorts/..."
              required
              autoFocus
              className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-violet-500"
            />
            <p className="mt-1 text-[11px] text-white/50">
              {youtubeId
                ? `✓ 인식된 영상 ID: ${youtubeId}`
                : "shorts / watch / youtu.be 모든 형식 지원"}
            </p>
          </Field>

          <Field label="제목" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-violet-500"
            />
          </Field>

          <Field label="작성자 닉네임" required>
            <input
              type="text"
              value={authorNickname}
              onChange={(e) => setAuthorNickname(e.target.value)}
              maxLength={30}
              required
              placeholder="@ 빼고"
              className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-violet-500"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="카테고리" required>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MuntzCategory)}
                className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-violet-500"
              >
                {MUNTZ_CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-neutral-900">
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="대상 학년" required>
              <select
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value as TargetGrade)}
                className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-violet-500"
              >
                {(["all", "1", "2", "3"] as TargetGrade[]).map((g) => (
                  <option key={g} value={g} className="bg-neutral-900">
                    {TARGET_GRADE_LABEL[g]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="한줄 설명">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="간단한 소개 (선택)"
              className="w-full resize-none rounded-lg bg-white/[0.06] px-3 py-2 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-violet-500"
            />
          </Field>

          {error && (
            <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">
              {error}
            </p>
          )}

          <p className="mt-3 text-[11px] leading-snug text-white/50">
            등록한 영상은 다른 학생/교사에게 즉시 노출됩니다. 부적절한 영상은
            관리자가 숨김 처리할 수 있어요.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/15"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(124,58,237,0.5)] transition-colors hover:bg-violet-500 disabled:opacity-60"
            >
              {submitting ? (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  등록 중...
                </span>
              ) : (
                "등록"
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11px] font-semibold text-white/70">
        {label}
        {required && <span className="ml-0.5 text-rose-400">*</span>}
      </span>
      {children}
    </label>
  );
}
