"use client";

// 이슈토론 — 찬반이 갈리는 학교·사회 이슈
import { Megaphone } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { BoardPage } from "@/components/board/BoardPage";
import { DEBATE_POSTS } from "@/lib/board-posts-data";

export default function DebatePage() {
  return (
    <AuthGate
      title="이슈토론은 로그인이 필요합니다"
      description="다양한 주제로 의견을 나누는 토론 공간이에요. 학교 계정으로 로그인 후 참여해 주세요."
    >
      <BoardPage
        title="이슈토론"
        subtitle="찬반이 갈리는 학교·사회 이슈를 함께 토론해 보세요."
        icon={Megaphone}
        boardKey="debate"
        posts={DEBATE_POSTS}
      />
    </AuthGate>
  );
}
