// 로그인 후 진입하는 메인 앱 셸 — 메가메뉴 TopBar + 모바일 BottomNav
import type { ReactNode } from "react";
import { TopBar } from "@/components/nav/TopBar";
import { BottomNav } from "@/components/ui/BottomNav";
import { ComposeShell } from "@/components/compose/ComposeShell";
import { NotificationProvider } from "@/lib/notifications";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <NotificationProvider>
      <ComposeShell>
        <div className="min-h-screen">
          <TopBar />
          {/* 모바일: 하단 네비게이션(~60px+safe-area) 공간 확보 / 태블릿+데스크톱: 일반 패딩 */}
          <main className="pb-28 pt-0 md:pb-12">{children}</main>
          <BottomNav />
        </div>
      </ComposeShell>
    </NotificationProvider>
  );
}
