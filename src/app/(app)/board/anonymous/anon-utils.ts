// 문태 에타 — 익명 게시판 공용 유틸 (태그 정의 / content 파서)

// ── 태그 정의 ──────────────────────────────────────────────
export const ANON_TAGS = [
  { key: "daily", emoji: "💭", label: "일상", color: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
  { key: "school", emoji: "🎓", label: "학교", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  { key: "love", emoji: "💕", label: "연애", color: "bg-pink-500/20 text-pink-300 border-pink-500/40" },
  { key: "worry", emoji: "😤", label: "고민", color: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  { key: "food", emoji: "🍽", label: "급식", color: "bg-green-500/20 text-green-300 border-green-500/40" },
  { key: "study", emoji: "📚", label: "공부", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" },
  { key: "chat", emoji: "🎵", label: "잡담", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },
  { key: "info", emoji: "💡", label: "정보", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" },
] as const;

export type AnonTagKey = (typeof ANON_TAGS)[number]["key"];

// ── content JSON 파싱 ──────────────────────────────────────
export function parseAnonContent(content: string): { tag: AnonTagKey | null; body: string } {
  try {
    const obj = JSON.parse(content) as unknown;
    if (obj && typeof obj === "object" && "body" in obj && typeof (obj as { body: unknown }).body === "string") {
      const o = obj as { tag?: unknown; body: string };
      const tagKeys = ANON_TAGS.map((t) => t.key) as string[];
      return {
        tag: typeof o.tag === "string" && tagKeys.includes(o.tag) ? (o.tag as AnonTagKey) : null,
        body: o.body,
      };
    }
  } catch { /* plain text */ }
  return { tag: null, body: content };
}

export function getTagInfo(key: string | null) {
  return ANON_TAGS.find((t) => t.key === key) ?? null;
}
