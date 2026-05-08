// 댓글 본문에서 @닉네임 토큰을 violet 볼드로 강조.
// 익명 게시판처럼 멘션이 비활성인 곳에서는 사용하지 말 것 (그냥 plain text 출력).

import { Fragment } from "react";
import { cn } from "@/lib/utils";

const MENTION_RE = /(@[가-힣a-zA-Z0-9]{2,10})/g;
const MENTION_TOKEN_RE = /^@[가-힣a-zA-Z0-9]{2,10}$/;

export function HighlightedContent({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = text.split(MENTION_RE);
  return (
    <p className={cn("whitespace-pre-wrap", className)}>
      {parts.map((part, i) =>
        MENTION_TOKEN_RE.test(part) ? (
          <span
            key={i}
            className="font-bold text-violet-500 dark:text-violet-300"
          >
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}
