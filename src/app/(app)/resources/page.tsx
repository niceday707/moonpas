"use client";

// 자료실 — 비로그인 열람 가능
import { FolderOpen } from "lucide-react";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function ResourcesPage() {
  return (
    <ComingSoon
      title="자료실"
      subtitle="기출문제·과목별 정리 자료·학습 PDF를 모아볼 수 있는 자료실을 준비 중입니다."
      icon={FolderOpen}
    />
  );
}
