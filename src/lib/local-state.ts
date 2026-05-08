// 투표(이슈토론) 중복 방지용 localStorage 헬퍼.
// 좋아요는 010_post_likes 마이그레이션 이후 서버 post_likes 테이블이 권위 소스.

const VOTED_KEY = "moonpas_voted_posts";

// ── 투표 (이슈토론) ─────────────────────────────────────
export type VoteChoice = "a" | "b";

export function getVoteMap(): Record<string, VoteChoice> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(VOTED_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, VoteChoice> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === "a" || v === "b") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function getVote(id: string): VoteChoice | null {
  return getVoteMap()[id] ?? null;
}

export function recordVote(id: string, choice: VoteChoice): void {
  if (typeof window === "undefined") return;
  const map = getVoteMap();
  map[id] = choice;
  window.localStorage.setItem(VOTED_KEY, JSON.stringify(map));
}
