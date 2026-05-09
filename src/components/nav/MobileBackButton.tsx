"use client";

// 모바일에서만 노출되는 ← 뒤로가기 버튼.
// PC(md 이상)에서는 hidden — 데스크톱은 메가메뉴/사이드바로 충분히 이동 가능.
// 진입 히스토리가 없는 경우엔 fallback 경로(기본 /dashboard)로 이동.
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** 히스토리가 없을 때 폴백할 경로 — 기본 /dashboard */
  fallbackHref?: string;
  /** 외부에서 추가 클래스 (다크 배경 페이지에선 색상 오버라이드 등) */
  className?: string;
  /** 접근성 라벨 — 기본 "뒤로 가기" */
  label?: string;
};

export function MobileBackButton({
  fallbackHref = "/dashboard",
  className,
  label = "뒤로 가기",
}: Props) {
  const router = useRouter();
  const handleClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className={cn(
        // 모바일/태블릿에서만 노출 — md 이상은 숨김.
        "grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 md:hidden dark:text-gray-300 dark:hover:bg-white/10",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}
