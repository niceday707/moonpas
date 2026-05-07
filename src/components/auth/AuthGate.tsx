"use client";

// 로그인 필요 페이지 래퍼.
// - 개발 모드(IS_DEV_MODE = true): 비로그인이어도 children + 안내 배너 노출.
// - 운영 모드(IS_DEV_MODE = false): 비로그인이면 LoginRequired 화면으로 대체.
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { LoginRequired } from "./LoginRequired";
import { DevModeBanner } from "./DevModeBanner";

type Props = {
  children: ReactNode;
  /** 비로그인 안내 화면의 타이틀(페이지별 커스터마이즈) */
  title?: string;
  /** 비로그인 안내 화면의 설명 */
  description?: string;
};

export function AuthGate({ children, title, description }: Props) {
  const { isLoggedIn, isDevMode } = useAuth();

  // 개발 모드에서는 로그인 체크를 우회하고 상단에 안내 배너만 노출한다.
  if (isDevMode) {
    return (
      <>
        <DevModeBanner />
        {children}
      </>
    );
  }

  if (!isLoggedIn) {
    return <LoginRequired title={title} description={description} />;
  }
  return <>{children}</>;
}
