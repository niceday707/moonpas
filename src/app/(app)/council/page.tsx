"use client";

// 학생자치회 — 로그인 필요
import { Vote } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function CouncilPage() {
  return (
    <AuthGate
      title="학생자치회는 로그인이 필요합니다"
      description="학생회 활동·안건·투표를 함께하는 공간이에요. 로그인 후 이용해 주세요."
    >
      <ComingSoon
        title="학생자치회"
        subtitle="학생회 공지, 안건 토의, 투표를 한 곳에서 볼 수 있도록 준비 중입니다."
        icon={Vote}
      />
    </AuthGate>
  );
}
