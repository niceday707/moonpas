"use client";

// 개발 모드 안내 배너 — AuthGate가 우회될 때 페이지 상단에 표시된다.
// IS_DEV_MODE 플래그를 false로 바꾸면 자동으로 더 이상 노출되지 않는다.
import { AlertTriangle } from "lucide-react";

export function DevModeBanner() {
  return (
    <div className="mx-auto mb-4 mt-2 flex max-w-screen-md items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-100/80 px-3 py-2 text-[12px] font-medium text-amber-900 shadow-[0_4px_16px_rgba(245,158,11,0.18)] backdrop-blur-md dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200 md:text-[13px]">
      <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2.4} />
      <span className="leading-snug">
        개발 모드: 로그인 없이 접근 중입니다 (배포 시 구글 로그인 필요)
      </span>
    </div>
  );
}
