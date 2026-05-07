"use client";

// 트렌딩 해시태그 — 카드 위쪽 가로 스크롤 영역에 표시
import { useEffect, useState } from "react";
import { fetchTrendingHashtags, subscribe } from "@/lib/mock-data";
import { HashtagPill } from "./HashtagPill";

export function TrendingTags() {
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const t = await fetchTrendingHashtags(10);
      if (mounted) setTags(t);
    };
    load();
    const unsub = subscribe(load);
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  if (tags.length === 0) return null;

  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="flex gap-2 pb-1">
        {tags.map((t) => (
          <HashtagPill key={t.tag} tag={t.tag} pill />
        ))}
      </div>
    </div>
  );
}
