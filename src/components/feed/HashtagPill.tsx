// 해시태그 인라인 링크 — 클릭 시 /feed?tag=... 로 필터
import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  tag: string;
  className?: string;
  /** true 면 pill 형태, false 면 인라인 텍스트 형태 */
  pill?: boolean;
};

export function HashtagPill({ tag, className, pill = false }: Props) {
  if (pill) {
    return (
      <Link
        href={`/feed?tag=${encodeURIComponent(tag)}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex items-center rounded-full bg-cyan-accent/15 px-2.5 py-1 text-xs font-medium text-cyan-accent ring-1 ring-inset ring-cyan-accent/25 transition-colors hover:bg-cyan-accent/25",
          className,
        )}
      >
        #{tag}
      </Link>
    );
  }

  return (
    <Link
      href={`/feed?tag=${encodeURIComponent(tag)}`}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "font-semibold text-cyan-accent hover:underline",
        className,
      )}
    >
      #{tag}
    </Link>
  );
}
