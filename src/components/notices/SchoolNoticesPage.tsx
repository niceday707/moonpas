"use client";

// 학교공지 / 문태소식 / 가정통신문 — 3 페이지 공용 클라이언트 컴포넌트.
//
//   /api/school-notices?source={source} 에서 최신 30개 조회.
//   각 행 클릭 시 문태고 홈페이지 원문(new tab)으로 이동.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import {
  SCHOOL_NOTICE_SOURCE_META,
  type SchoolNoticeSource,
} from "@/lib/schoolNotices";
import { cn } from "@/lib/utils";

type SchoolNoticeRow = {
  id: string;
  source: SchoolNoticeSource;
  title: string;
  date: string; // YYYY-MM-DD
  original_url: string;
  ntt_sn: string;
  created_at: string;
};

function formatDate(isoDate: string): string {
  // "YYYY-MM-DD" → "YYYY.MM.DD"
  return isoDate.replaceAll("-", ".");
}

export function SchoolNoticesPage({ source }: { source: SchoolNoticeSource }) {
  const meta = SCHOOL_NOTICE_SOURCE_META[source];
  const [items, setItems] = useState<SchoolNoticeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchList = async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/school-notices?source=${source}&limit=30`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        items?: SchoolNoticeRow[];
        error?: string;
      };
      if (!json.ok) {
        setError(json.error ?? "조회에 실패했어요");
        setItems([]);
        return;
      }
      setItems(json.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    }
  };

  useEffect(() => {
    setItems(null); // source 전환 시 스켈레톤
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/school-notices?sync=true`, {
        method: "GET",
        cache: "no-store",
      });
      // 동기화 결과와 무관하게 목록은 다시 fetch (실패 시 기존 데이터 유지)
      await res.json().catch(() => null);
      await fetchList();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:py-8">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-5"
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-500 dark:text-violet-300">
              문태고 홈페이지
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-3xl">
              <span aria-hidden>{meta.emoji}</span>
              {meta.label}
            </h1>
            <p className="mt-1 text-sm text-foreground/55">
              제목·날짜만 가져옵니다. 원문은 클릭 시 새 탭으로 열려요.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            aria-label="새로고침"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors",
              "hover:bg-gray-50 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.07]",
              syncing && "opacity-60",
            )}
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {syncing ? "동기화 중" : "새로고침"}
          </button>
        </div>
      </motion.header>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/15 dark:text-amber-300">
          {error}
        </div>
      )}

      {items === null ? (
        <SkeletonList />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-white/[0.06] dark:border-white/[0.07] dark:bg-[#16162a]">
          {items.map((n) => (
            <li key={n.id}>
              <a
                href={n.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
              >
                <span
                  aria-hidden
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-50 text-base dark:bg-violet-500/15"
                >
                  {meta.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-white">
                    {n.title}
                  </p>
                  <p className="mt-1 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                    {formatDate(n.date)}
                  </p>
                </div>
                <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-white/[0.06] dark:border-white/[0.07] dark:bg-[#16162a]">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-3.5">
          <div className="mt-0.5 h-7 w-7 shrink-0 animate-pulse rounded-lg bg-gray-100 dark:bg-white/[0.06]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-4/5 animate-pulse rounded bg-gray-100 dark:bg-white/[0.06]" />
            <div className="h-2.5 w-1/4 animate-pulse rounded bg-gray-100 dark:bg-white/[0.04]" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center dark:border-white/[0.07] dark:bg-[#16162a]">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        아직 가져온 글이 없어요
      </p>
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
        우측 상단의 &ldquo;새로고침&rdquo; 버튼으로 학교 홈페이지에서 직접 가져올 수 있어요.
      </p>
    </div>
  );
}
