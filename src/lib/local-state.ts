// 좋아요/투표 중복 방지용 localStorage 헬퍼.
// 서버 측 인증 데이터가 아니라 단순 클라이언트 캐시이므로,
// 한 사용자가 여러 디바이스에서 좋아요/투표를 다시 누를 수는 있다.
// 본격적인 1인 1표 보장이 필요하면 별도 테이블(post_likes / post_votes) 로 옮기자.

const LIKED_KEY = "moonpas_liked_posts";
const VOTED_KEY = "moonpas_voted_posts";

// ── 좋아요 ─────────────────────────────────────────────
export function getLikedPosts(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(LIKED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export function isPostLiked(id: string): boolean {
  return getLikedPosts().has(id);
}

export function addLikedPost(id: string): void {
  if (typeof window === "undefined") return;
  const set = getLikedPosts();
  set.add(id);
  window.localStorage.setItem(LIKED_KEY, JSON.stringify([...set]));
}

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
