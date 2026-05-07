"use client";

// 선배 후기 — 대학·전공·진로 합격 수기
import { Star } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { BoardPage } from "@/components/board/BoardPage";
import { REVIEWS_POSTS } from "@/lib/board-posts-data";

export default function ReviewsPage() {
  return (
    <AuthGate
      title="선배 후기는 로그인이 필요합니다"
      description="대학·전공·진로 선배의 진솔한 후기를 모아둔 공간이에요."
    >
      <BoardPage
        title="선배 후기"
        subtitle="대학별·전공별 합격 수기와 학교 생활 후기를 모아봐요."
        icon={Star}
        boardKey="reviews"
        posts={REVIEWS_POSTS}
      />
    </AuthGate>
  );
}
