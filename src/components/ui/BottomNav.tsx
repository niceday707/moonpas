"use client";

// 모바일 하단 네비게이션 — 홈 / 피드 / 글쓰기 / 알림 / 내정보
// "글쓰기" 는 라우팅 대신 글쓰기 모달을 연다
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, LayoutList, PencilLine, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCompose } from "@/components/compose/ComposeProvider";
import { useNotifications } from "@/lib/notifications";

type NavItem = {
  href?: string;
  action?: "compose";
  label: string;
  icon: typeof Home;
  primary?: boolean;
  badge?: boolean; // 알림 배지 표시 여부
};

const ITEMS: NavItem[] = [
  { href: "/dashboard", label: "홈", icon: Home },
  { href: "/board/free", label: "피드", icon: LayoutList },
  { action: "compose", label: "글쓰기", icon: PencilLine, primary: true },
  { href: "/notifications", label: "알림", icon: Bell, badge: true },
  { href: "/profile", label: "내정보", icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  const { open } = useCompose();
  const { unreadCount } = useNotifications();

  return (
    <nav
      aria-label="하단 메뉴"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 md:hidden",
        "glass border-t border-white/10",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = !!item.href && pathname === item.href;
          const badgeCount = item.badge ? unreadCount : 0;

          const inner = (
            <>
              <span className="relative">
                {item.primary ? (
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] text-white shadow-[0_6px_20px_rgba(124,58,237,0.5)]">
                    <Icon className="h-6 w-6" />
                  </span>
                ) : (
                  <Icon className={cn("h-6 w-6 transition-colors", active ? "text-accent" : "")} />
                )}
                {/* 알림 배지 */}
                {badgeCount > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold leading-none text-white">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </span>
              <span className="text-[10px] leading-none">{item.label}</span>
              {active && !item.primary && (
                <motion.span
                  layoutId="bottom-nav-active"
                  className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent"
                />
              )}
            </>
          );

          const className = cn(
            "flex w-full flex-col items-center justify-center gap-1.5 py-3 min-h-[60px]",
            "text-[10px] font-medium transition-colors",
            active ? "text-accent" : "text-foreground/55",
            item.primary && "text-accent",
          );

          return (
            <li key={item.label} className="relative">
              {item.action === "compose" ? (
                <button
                  type="button"
                  aria-label="글쓰기"
                  onClick={open}
                  className={className}
                >
                  {inner}
                </button>
              ) : (
                <Link href={item.href!} className={className}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
