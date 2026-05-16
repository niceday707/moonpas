"use client";

// 메인 앱 셸 — TopBar + 본문 + BottomNav 의 클라이언트 래퍼.
// 게시글 상세 페이지(/board/[boardType]/[postId])에서는 모바일 BottomNav 를 숨겨
// CommentComposer(하단 고정 댓글 입력바)와의 위치/터치 충돌을 방지한다.
//
// 매칭 규칙: /board/<anything>/<anything except "write">
//   · /board/free            → 목록 (BottomNav 표시)
//   · /board/free/write      → 글쓰기 (BottomNav 표시)
//   · /board/free/abc-123    → 상세 (BottomNav 숨김)
//   · /board/anonymous/uuid  → 상세 (BottomNav 숨김)

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "@/components/nav/TopBar";
import { BottomNav } from "@/components/ui/BottomNav";

const POST_DETAIL_RE = /^\/board\/[^/]+\/(?!write$)[^/]+$/;

export function isPostDetailPath(pathname: string | null): boolean {
  return !!pathname && POST_DETAIL_RE.test(pathname);
}

// /muntz: fullscreen 쇼츠 뷰어. 페이지 자체가 fixed inset-0 로 화면을 덮기 때문에
// BottomNav 가 영상 위에 떠 있으면 몰입을 깬다.
const FULLSCREEN_VIEWER_PATHS = new Set<string>(["/muntz"]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideBottomNav =
    isPostDetailPath(pathname) ||
    (!!pathname && FULLSCREEN_VIEWER_PATHS.has(pathname));

  return (
    <div className="min-h-screen">
      <TopBar />
      <main
        className={
          hideBottomNav
            ? // 상세 페이지: BottomNav 가 없으니 main 자체의 하단 패딩은 최소만 유지
              // (CommentComposer 가려짐 방지를 위한 패딩은 페이지 레벨에서 따로 처리)
              "pt-0"
            : "pb-28 pt-0 md:pb-12"
        }
      >
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
