"use client";

// 해시태그 자동완성 팝업 — 텍스트 영역 아래에 떠 있다가 클릭 시 태그 삽입
import { useEffect } from "react";
import { Hash } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  /** 현재 # 뒤에 입력된 쿼리 (없으면 닫힘) */
  query: string | null;
  suggestions: string[];
  highlight: number;
  onPick: (tag: string) => void;
  onClose: () => void;
  /** 위/아래 키 입력으로 highlight 인덱스 조정 */
  onMove: (delta: number) => void;
};

// 단어 문자 판정 — 알파벳/숫자/한글/언더스코어
function isWordChar(ch: string): boolean {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  if (c === 0x5f) return true; // _
  if (c >= 0x30 && c <= 0x39) return true; // 0-9
  if (c >= 0x41 && c <= 0x5a) return true; // A-Z
  if (c >= 0x61 && c <= 0x7a) return true; // a-z
  if (c >= 0xac00 && c <= 0xd7a3) return true; // 한글 음절
  if (c >= 0x1100 && c <= 0x11ff) return true; // 한글 자모
  if (c >= 0x3130 && c <= 0x318f) return true; // 한글 호환 자모
  return false;
}

/**
 * 본문에서 커서 직전의 #토큰을 추출 — 없으면 null.
 * 예: "안녕 #해시" 에서 커서가 끝에 있으면 { start: 3, query: "해시" }.
 */
export function getHashtagAtCursor(
  value: string,
  cursor: number,
): { start: number; query: string } | null {
  // 커서 직전 가장 가까운 # 찾기 — 도중에 비단어 문자(공백 등)가 있으면 무효
  let i = cursor - 1;
  while (i >= 0) {
    const ch = value[i];
    if (ch === "#") break;
    if (!isWordChar(ch)) return null;
    i--;
  }
  if (i < 0) return null; // # 못 찾음
  // # 바로 앞이 단어 문자면 (예: "a#b") 자동완성 비활성
  if (i > 0 && isWordChar(value[i - 1])) return null;
  return { start: i, query: value.slice(i + 1, cursor) };
}

export function HashtagAutocomplete({
  query,
  suggestions,
  highlight,
  onPick,
  onClose,
  onMove,
}: Props) {
  // 키보드 핸들러는 Composer 에서 직접 textarea 에 부착 — 여기서는 mouse 만 처리
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = query !== null && suggestions.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.ul
          key="hashtag-suggest"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
          role="listbox"
          aria-label="해시태그 추천"
          className="glass absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-2xl py-1 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
          // 자동완성 이동을 위해 onMove 를 부모가 wheel/key 로 호출
          onMouseDown={(e) => e.preventDefault()}
        >
          {suggestions.map((tag, i) => (
            <li key={tag}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                onClick={() => onPick(tag)}
                onMouseEnter={() => onMove(i - highlight)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                  i === highlight
                    ? "bg-accent/15 text-accent"
                    : "text-foreground/80 hover:bg-foreground/5",
                )}
              >
                <Hash className="h-3.5 w-3.5 opacity-70" />
                <span className="font-medium">{tag}</span>
              </button>
            </li>
          ))}
        </motion.ul>
      )}
    </AnimatePresence>
  );
}
