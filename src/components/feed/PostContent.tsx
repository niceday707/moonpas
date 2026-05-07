"use client";

// 게시글 본문 — 해시태그를 인라인 링크로, 일정 길이 이상이면 "더보기" 토글
import { useState } from "react";
import { tokenizeContent } from "@/lib/mock-data";
import { HashtagPill } from "./HashtagPill";
import { cn } from "@/lib/utils";

type Props = {
  text: string;
  /** 미리보기 모드 — 일정 길이 넘으면 "더보기" 표시 */
  collapsible?: boolean;
  /** 미리보기 길이 (글자수) */
  previewLength?: number;
  className?: string;
};

export function PostContent({
  text,
  collapsible = false,
  previewLength = 180,
  className,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const isLong = collapsible && text.length > previewLength;
  const visible = isLong && !expanded ? text.slice(0, previewLength) + "…" : text;

  const tokens = tokenizeContent(visible);

  return (
    <div className={cn("whitespace-pre-wrap break-words text-[15px] leading-relaxed", className)}>
      {tokens.map((t, i) =>
        t.type === "text" ? (
          <span key={i}>{t.value}</span>
        ) : (
          <HashtagPill key={i} tag={t.value} />
        ),
      )}
      {isLong && !expanded && (
        <>
          {" "}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded(true);
            }}
            className="font-semibold text-foreground/60 hover:text-foreground"
          >
            더보기
          </button>
        </>
      )}
    </div>
  );
}
