"use client";

// 로딩 스켈레톤 — 학교 로고 펄스 형태로도 사용 가능
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** true 면 학교 로고 펄스 스켈레톤, false 면 단순 사각 스켈레톤 */
  logo?: boolean;
};

export function Skeleton({ className, logo = false }: Props) {
  if (logo) {
    return (
      <div
        role="status"
        aria-label="불러오는 중"
        className={cn(
          "grid place-items-center rounded-2xl glass p-10",
          className,
        )}
      >
        <div className="skeleton-pulse grid h-16 w-16 place-items-center rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] shadow-[0_0_30px_rgba(124,58,237,0.5)]">
          <GraduationCap className="h-8 w-8 text-white" strokeWidth={2} />
        </div>
        <p className="skeleton-pulse mt-4 text-sm text-foreground/60">
          불러오는 중…
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="불러오는 중"
      className={cn(
        "skeleton-pulse rounded-xl bg-foreground/10",
        className,
      )}
    />
  );
}
