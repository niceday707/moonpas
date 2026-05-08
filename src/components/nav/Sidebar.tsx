"use client";

// 데스크톱 좌측 사이드바 네비게이션
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bell,
  GraduationCap,
  Hash,
  Home,
  Moon,
  Package,
  UserRound,
  PlayCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: typeof Home;
};

const ITEMS: Item[] = [
  { href: "/dashboard", label: "홈", icon: Home },
  { href: "/board/anonymous", label: "문태 에타 🌙", icon: Moon },
  { href: "/board/free", label: "자유게시판", icon: Hash },
  { href: "/board/curriculum", label: "교육과정", icon: BookOpen },
  { href: "/board/college", label: "대입정보", icon: GraduationCap },
  { href: "/board/youtube", label: "문튜브", icon: PlayCircle },
  { href: "/board/lost", label: "분실물센터", icon: Package },
  { href: "/board/market", label: "나눔장터", icon: Package },
  { href: "/board/notice", label: "공지사항", icon: Bell },
  { href: "/profile", label: "내 프로필", icon: UserRound },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="주요 메뉴"
      className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-white/5 bg-transparent px-4 py-6 md:flex md:flex-col"
    >
      <ul className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "text-accent"
                    : "text-foreground/70 hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 -z-10 rounded-2xl bg-accent/10 ring-1 ring-inset ring-accent/30"
                    transition={{ type: "spring", stiffness: 300, damping: 26 }}
                  />
                )}
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-4">
        <div className="glass rounded-2xl p-4 text-xs text-foreground/60">
          <p className="font-semibold text-foreground">함께 만들어요</p>
          <p className="mt-1 leading-relaxed">
            꿈을 찾고 실력 키워 행복 나누는 배움 공동체
          </p>
        </div>
      </div>
    </aside>
  );
}
