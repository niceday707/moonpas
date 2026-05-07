"use client";

// 진로진학 상담 — 로그인 필요
import { Compass } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function CareerPage() {
  return (
    <AuthGate
      title="진로진학 상담은 로그인이 필요합니다"
      description="진로·진학 고민을 선생님·선배와 1:1로 나눌 수 있는 공간이에요."
    >
      <ComingSoon
        title="진로진학 상담"
        subtitle="진로진학 담당 교사와 선배 멘토에게 비공개로 상담을 요청할 수 있는 기능을 준비 중입니다."
        icon={Compass}
      />
    </AuthGate>
  );
}
