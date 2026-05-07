"use client";

// 로그인 필요 페이지 래퍼.
// 운영 모드 — 미로그인 시 LoginRequired 화면 노출.
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { LoginRequired } from "./LoginRequired";

type Props = {
  children: ReactNode;
  /** 비로그인 안내 화면의 타이틀(페이지별 커스터마이즈) */
  title?: string;
  /** 비로그인 안내 화면의 설명 */
  description?: string;
};

export function AuthGate({ children, title, description }: Props) {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-violet-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginRequired title={title} description={description} />;
  }
  return <>{children}</>;
}
