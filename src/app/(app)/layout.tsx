// 로그인 후 진입하는 메인 앱 셸.
// 게시글 상세 페이지에서 BottomNav 를 숨겨 CommentComposer 와 충돌하지 않게 함.
// (셸 자체는 client 컴포넌트 — usePathname 으로 경로 분기)
import type { ReactNode } from "react";
import { AppShell } from "@/components/nav/AppShell";
import { ComposeShell } from "@/components/compose/ComposeShell";
import { NotificationProvider } from "@/lib/notifications";
import { VisitorTracker } from "@/components/visit/VisitorTracker";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <NotificationProvider>
      {/* 셸 마운트 시 1회 /api/visit POST — 자식 트리에 영향 없음 */}
      <VisitorTracker />
      <ComposeShell>
        <AppShell>{children}</AppShell>
      </ComposeShell>
    </NotificationProvider>
  );
}
