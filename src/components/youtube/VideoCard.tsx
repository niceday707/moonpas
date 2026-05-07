"use client";

// 문튜브 영상 카드 — 글래스모피즘 + hover 살짝 떠오르기 + iframe 임베드
// 대시보드의 미리보기 섹션과 /youtube 전체 페이지 양쪽에서 재사용한다.
import { motion } from "framer-motion";
import {
  CATEGORY_COLOR,
  youtubeEmbedUrl,
  type YoutubeVideo,
} from "@/lib/youtube-data";
import { cn } from "@/lib/utils";

type VideoCardProps = {
  video: YoutubeVideo;
  /** 우측 상단에 ✕ 삭제 버튼 노출 (교사 전용 페이지 진입시) */
  onRemove?: () => void;
  className?: string;
};

export function VideoCard({ video, onRemove, className }: VideoCardProps) {
  const accent = CATEGORY_COLOR[video.category];

  return (
    <motion.article
      whileHover={{
        y: -4,
        boxShadow: `0 12px 40px ${accent}55`,
        transition: { type: "spring", stiffness: 300, damping: 22 },
      }}
      className={cn(
        // 글래스모피즘 베이스 — globals.css 의 .glass 와 동일한 룩
        "glass group relative flex flex-col overflow-hidden rounded-2xl",
        "ring-1 ring-inset ring-white/5",
        className,
      )}
    >
      {/* 16:9 임베드 플레이어 */}
      <div className="relative aspect-video w-full overflow-hidden bg-black/40">
        <iframe
          src={youtubeEmbedUrl(video.id)}
          title={video.title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
        {/* 좌상단 카테고리 배지 — iframe 위 오버레이 */}
        <span
          className="pointer-events-none absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-md"
          style={{ background: `${accent}cc` }}
        >
          {video.category}
        </span>

        {/* 교사 전용 삭제 버튼 */}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="영상 삭제"
            className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white/80 opacity-0 ring-1 ring-white/20 backdrop-blur-md transition-opacity hover:bg-red-500/80 hover:text-white group-hover:opacity-100"
          >
            ✕
          </button>
        )}
      </div>

      {/* 제목 */}
      <div className="flex flex-1 flex-col gap-1 px-4 py-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
          {video.title}
        </h3>
        <p className="text-[11px] text-foreground/45">YouTube · 문튜브</p>
      </div>

      {/* 호버시 카테고리 컬러로 살짝 빛나는 라인 */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
        }}
      />
    </motion.article>
  );
}
