"use client";

// ============================================================================
// 문츠(Muntz) — 모바일 몰입형 fullscreen 쇼츠 뷰어
// ----------------------------------------------------------------------------
// - 페이지 자체가 `fixed inset-0` 로 화면을 덮어 AppShell 의 TopBar/main 패딩 위로
//   올라간다. BottomNav 는 AppShell 에서 /muntz 일 때 숨김 처리.
// - 한 슬라이드 = 100dvh. snap-y snap-mandatory 로 한 영상씩 착착 넘어감.
// - 비디오는 9:16 비율 유지. 모바일은 폭 가득(`w=min(100%, 100dvh*9/16)`),
//   PC는 가운데 폰 프레임(`max-w-[420px]`) 안에서 같은 피드가 동작.
// - 영상은 서버 저장 없음 — 공식 youtube-nocookie iframe 만 사용.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  Heart,
  Share2,
} from "lucide-react";
import {
  MUNTZ_ITEMS,
  MUNTZ_CATEGORIES,
  CATEGORY_COLOR,
  TARGET_GRADE_LABEL,
  muntzEmbedUrl,
  type MuntzCategory,
  type MuntzItem,
} from "@/lib/muntz-data";
import { cn } from "@/lib/utils";

type Tab = "전체" | MuntzCategory;
const TABS: Tab[] = ["전체", ...MUNTZ_CATEGORIES];

export default function MuntzPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("전체");

  const items = useMemo<MuntzItem[]>(
    () =>
      tab === "전체"
        ? MUNTZ_ITEMS
        : MUNTZ_ITEMS.filter((it) => it.category === tab),
    [tab],
  );

  // 페이지 진입 동안 body 스크롤 잠금 — fullscreen 뷰어 밖으로 스크롤 새는 것 방지.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
        <TopOverlay tab={tab} onTabChange={setTab} onBack={() => router.back()} />

        {/* 피드 */}
        {items.length === 0 ? (
          <EmptyState />
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
            {items.map((it) => (
              <Slide key={`${tab}:${it.id}`} item={it} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 상단 오버레이 ──────────────────────────────────────────────────────────
function TopOverlay({
  tab,
  onTabChange,
  onBack,
}: {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onBack: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 px-3 pt-[max(env(safe-area-inset-top),0.5rem)]">
      {/* 1행: 뒤로가기 + 타이틀 */}
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
        {/* 좌우 균형용 더미 (뒤로가기 버튼과 동일 폭) */}
        <div className="h-10 w-10" aria-hidden />
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
function Slide({ item }: { item: MuntzItem }) {
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

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

// ─── 빈 상태 ────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/60">
      해당 카테고리에 아직 등록된 쇼츠가 없어요.
    </div>
  );
}
