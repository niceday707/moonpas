"use client";

// 졸업생 게시판 — 선후배가 만나 추억과 응원을 나누는 공간
import { Users } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { BoardPage } from "@/components/board/BoardPage";
import { ALUMNI_POSTS } from "@/lib/board-posts-data";

export default function AlumniPage() {
  return (
    <AuthGate
      title="졸업생 게시판은 로그인이 필요합니다"
      description="문태고 선후배가 만나는 공간이에요. 로그인 후 인사말을 남겨보세요."
    >
      <BoardPage
        title="졸업생 게시판"
        subtitle="졸업생이 후배에게 응원을 남기고 함께 추억을 나누는 공간."
        icon={Users}
        boardKey="alumni"
        posts={ALUMNI_POSTS}
      />
    </AuthGate>
  );
}
