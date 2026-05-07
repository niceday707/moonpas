"use client";

// 학습 Q&A — 과목별 질문·답변
import { HelpCircle } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { BoardPage } from "@/components/board/BoardPage";
import { QNA_POSTS } from "@/lib/board-posts-data";

export default function QnaPage() {
  return (
    <AuthGate
      title="학습 Q&A는 로그인이 필요합니다"
      description="공부하다 막힌 문제를 함께 푸는 공간이에요. 로그인 후 질문·답변에 참여하세요."
    >
      <BoardPage
        title="학습 Q&A"
        subtitle="과목별 질문과 답변을 모아보고, 함께 풀이를 공유해요."
        icon={HelpCircle}
        boardKey="qna"
        posts={QNA_POSTS}
      />
    </AuthGate>
  );
}
