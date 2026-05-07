"use client";

// 문태뉴스 — 학교 행사·동아리·수상 소식 (비로그인 열람 가능)
import { Newspaper } from "lucide-react";
import { BoardPage } from "@/components/board/BoardPage";
import { NEWS_POSTS } from "@/lib/board-posts-data";

export default function NewsPage() {
  return (
    <BoardPage
      title="문태뉴스"
      subtitle="학교 행사·동아리 활동·수상 소식을 한눈에."
      icon={Newspaper}
      boardKey="news"
      posts={NEWS_POSTS}
    />
  );
}
