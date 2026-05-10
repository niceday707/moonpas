'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getAutoBanners, type AutoBanner } from '@/lib/autoBanners';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ─── 타입 ───
interface DBBanner {
  id: string;
  title: string;
  description: string | null;
  link: string | null;
  image_url: string | null;
  background_color: string;
  is_active: boolean;
  order_index: number;
}

type BannerItem =
  | (DBBanner & { _source: 'manual' })
  | (AutoBanner & { _source: 'auto' });

// ═══════════════════════════════════════════
// 메인 슬라이더
// ═══════════════════════════════════════════
export default function BannerSlider() {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      // 1) 자동 배너 (코드 생성)
      const auto: BannerItem[] = getAutoBanners().map((b) => ({
        ...b,
        _source: 'auto' as const,
      }));

      // 2) DB 수동 배너 (기존 관리자 업로드 배너)
      const { data } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      const manual: BannerItem[] = (data || []).map((b: DBBanner) => ({
        ...b,
        _source: 'manual' as const,
      }));

      // 수동 먼저 → 자동 뒤에
      setBanners([...manual, ...auto]);
    }

    load();
  }, []);

  // 자동 슬라이드 (5초, 호버 시 정지)
  useEffect(() => {
    if (banners.length <= 1 || isHovered) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length, isHovered]);

  const goPrev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  const goNext = useCallback(() => {
    setCurrent((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const banner = banners[current];

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl
                 h-[120px] md:h-[140px] lg:h-[160px] group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 배너 콘텐츠 */}
      <BannerContent banner={banner} />

      {/* 좌우 화살표 */}
      {banners.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20
                       w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm
                       flex items-center justify-center text-white/80
                       hover:bg-black/40 hover:text-white transition-all
                       opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20
                       w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm
                       flex items-center justify-center text-white/80
                       hover:bg-black/40 hover:text-white transition-all
                       opacity-0 group-hover:opacity-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* 도트 인디케이터 */}
      {banners.length > 1 && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current
                  ? 'w-6 bg-white'
                  : 'w-1.5 bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}

      {/* 카운터 */}
      {banners.length > 1 && (
        <div className="absolute top-3 right-3 z-20 px-2 py-0.5
                        rounded-full bg-black/20 backdrop-blur-sm
                        text-white/80 text-xs font-medium">
          {current + 1} / {banners.length}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// 배너 콘텐츠 분기
// ═══════════════════════════════════════════
function BannerContent({ banner }: { banner: BannerItem }) {
  const inner =
    banner._source === 'auto' ? (
      <AutoBannerView banner={banner as AutoBanner & { _source: 'auto' }} />
    ) : (
      <ManualBannerView banner={banner as DBBanner & { _source: 'manual' }} />
    );

  const link = banner.link;
  if (link) {
    return (
      <Link href={link} className="block w-full h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

// ═══════════════════════════════════════════
// 수동 배너 (기존 디자인 유지)
// ═══════════════════════════════════════════
function ManualBannerView({
  banner,
}: {
  banner: DBBanner & { _source: 'manual' };
}) {
  return (
    <div className="relative w-full h-full">
      {banner.image_url ? (
        <>
          <img
            src={banner.image_url}
            alt={banner.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />
        </>
      ) : (
        <div
          className="w-full h-full"
          style={{ backgroundColor: banner.background_color || '#6C63FF' }}
        >
          <div className="absolute inset-0 overflow-hidden opacity-10">
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-white rounded-full" />
            <div className="absolute -bottom-8 left-1/4 w-24 h-24 bg-white rounded-full" />
          </div>
        </div>
      )}
      <div className="absolute inset-0 flex items-center px-6 md:px-8 z-10">
        <div>
          <h3 className="text-white text-lg md:text-xl lg:text-2xl font-bold drop-shadow-lg">
            {banner.title}
          </h3>
          {banner.description && (
            <p className="text-white/80 text-sm md:text-base mt-1 drop-shadow">
              {banner.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 자동 배너 분기
// ═══════════════════════════════════════════
function AutoBannerView({
  banner,
}: {
  banner: AutoBanner & { _source: 'auto' };
}) {
  if (banner.banner_type === 'auto_exam') {
    return <ExamBanner banner={banner} />;
  }
  return <EventBanner banner={banner} />;
}

// ─────────────────────────────────────────
// 시험 D-day 배너
// ─────────────────────────────────────────
function ExamBanner({ banner }: { banner: AutoBanner }) {
  const isUrgent = banner.dday <= 7;

  return (
    <div
      className={`relative w-full h-full bg-gradient-to-r ${banner.gradient} overflow-hidden`}
    >
      {/* 배경 패턴 */}
      <div className="absolute inset-0">
        <div
          className="absolute top-0 right-0 w-[300px] h-[300px] opacity-[0.06]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg, white 0px, white 1px, transparent 1px, transparent 20px
            )`,
          }}
        />
        <div
          className={`absolute -top-12 -right-12 w-40 h-40 rounded-full
            bg-white/5 ${isUrgent ? 'animate-pulse' : ''}`}
        />
        <div className="absolute -bottom-8 left-1/3 w-20 h-20 rounded-full bg-white/5" />
      </div>

      {/* 콘텐츠 */}
      <div className="relative z-10 h-full flex items-center px-6 md:px-8 lg:px-10">
        {/* D-day 숫자 */}
        <div className="flex-shrink-0 mr-4 md:mr-6">
          <div
            className={`text-4xl md:text-5xl lg:text-6xl font-black text-white
              ${isUrgent ? 'animate-pulse' : ''}`}
            style={{
              textShadow: isUrgent
                ? '0 0 20px rgba(255,150,100,0.8), 0 0 40px rgba(255,100,100,0.3)'
                : '0 0 15px rgba(255,255,255,0.2)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {banner.title}
          </div>
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-white/50 text-[10px] md:text-xs font-semibold uppercase tracking-[0.15em]">
            UPCOMING EXAM
          </span>
          <span className="text-white text-sm md:text-base lg:text-lg font-bold mt-0.5 truncate">
            {banner.description}
          </span>
          <span className="text-white/60 text-xs md:text-sm mt-1 hidden sm:block">
            {banner.emoji} 목표를 향해 달려가자!
          </span>
        </div>

        {/* 우측 이모지 (PC만) */}
        <div
          className={`hidden lg:flex items-center ml-auto text-5xl
            opacity-40 ${isUrgent ? 'animate-bounce' : ''}`}
        >
          {banner.emoji}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 학교 행사 / 대회 배너
// ─────────────────────────────────────────
function EventBanner({ banner }: { banner: AutoBanner }) {
  return (
    <div
      className={`relative w-full h-full bg-gradient-to-r ${banner.gradient} overflow-hidden`}
    >
      {/* 배경 반짝이 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full" />
        <div className="absolute -bottom-6 left-1/4 w-24 h-24 bg-white/5 rounded-full" />
        <div
          className="absolute top-4 right-20 w-1 h-1 bg-white/40 rounded-full animate-ping"
        />
        <div
          className="absolute bottom-6 right-40 w-1 h-1 bg-white/30 rounded-full animate-ping"
          style={{ animationDelay: '0.5s' }}
        />
        <div
          className="absolute top-8 left-1/2 w-1 h-1 bg-white/30 rounded-full animate-ping"
          style={{ animationDelay: '1s' }}
        />
      </div>

      {/* 콘텐츠 */}
      <div className="relative z-10 h-full flex items-center px-6 md:px-8 lg:px-10">
        <div
          className="text-3xl md:text-4xl mr-4 animate-bounce"
          style={{ animationDuration: '2s' }}
        >
          {banner.emoji}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-white/60 text-xs font-medium">
            {banner.dday === 0 ? '🎊 오늘 행사' : `D-${banner.dday}`}
          </span>
          <span className="text-white text-lg md:text-xl lg:text-2xl font-bold truncate">
            {banner.description}
          </span>
        </div>
        <div className="hidden md:block ml-auto">
          <span
            className="px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-full
                       text-white text-xs font-medium border border-white/20"
          >
            일정 보기 →
          </span>
        </div>
      </div>
    </div>
  );
}
