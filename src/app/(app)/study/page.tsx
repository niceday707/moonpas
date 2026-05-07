"use client";

// 스터디 — 로그인 필요
import { BookMarked } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function StudyPage() {
  return (
    <AuthGate
      title="스터디 모집은 로그인이 필요합니다"
      description="함께 공부할 친구를 찾고 모임을 만들 수 있는 공간이에요."
    >
      <ComingSoon
        title="스터디"
        subtitle="과목별·목표별 스터디를 모집하고 참여할 수 있는 기능을 준비 중입니다."
        icon={BookMarked}
      />
    </AuthGate>
  );
}
