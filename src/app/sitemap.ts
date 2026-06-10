import type { MetadataRoute } from "next";

const SITE_URL = "https://www.moontaenian.kr";

// 16개 게시판 — board_type 키
const BOARD_TYPES = [
  "free",
  "notice",
  "lost",
  "market",
  "debate",
  "challenge",
  "college",
  "curriculum",
  "council",
  "qa",
  "youtube",
  "resources",
  "study",
  "news",
  "alumni",
  "senior",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/dashboard`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/board/anonymous`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
  ];

  const boardRoutes: MetadataRoute.Sitemap = BOARD_TYPES.map((bt) => ({
    url: `${SITE_URL}/board/${bt}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticRoutes, ...boardRoutes];
}
