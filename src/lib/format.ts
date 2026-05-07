// 한국어 상대 시간 포맷터
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function relativeTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);

  if (diff < 30_000) return "방금 전";
  if (diff < HOUR) return `${Math.floor(diff / MIN)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}일 전`;

  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
