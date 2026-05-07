"use client";

// 관리자 영역 레이아웃 — 좌측 사이드바 + 권한 체크.
// (app) 라우트 그룹 바깥이라 일반 TopBar/BottomNav 는 적용되지 않는다.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  FileText,
  Ticket,
  ArrowLeft,
  GraduationCap,
  Loader2,
  Lock,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser } from "@/lib/supabase-profile";
import { cn } from "@/lib/utils";

type AdminAuthState = "loading" | "unauthenticated" | "forbidden" | "ok";

const NAV_ITEMS = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "회원관리", icon: Users, exact: false },
  { href: "/admin/posts", label: "게시글관리", icon: FileText, exact: false },
  { href: "/admin/invites", label: "초대코드", icon: Ticket, exact: false },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading: userLoading } = useSupabaseUser();
  const [authState, setAuthState] = useState<AdminAuthState>("loading");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // profiles.role 확인
  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setAuthState("unauthenticated");
      return;
    }
    let active = true;
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("[admin] role 조회 실패", error);
          setAuthState("forbidden");
          return;
        }
        setAuthState(data?.role === "admin" ? "ok" : "forbidden");
      });
    return () => {
      active = false;
    };
  }, [user, userLoading]);

  // 페이지 이동 시 모바일 드로어 자동 닫기
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (authState === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0f0f1a] text-white">
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          관리자 권한 확인 중...
        </div>
      </div>
    );
  }

  if (authState !== "ok") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0f0f1a] px-4 text-white">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-xl"
        >
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-violet-600/20 text-violet-300">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold">권한이 없습니다</h1>
          <p className="mt-2 text-xs leading-relaxed text-white/60">
            {authState === "unauthenticated"
              ? "관리자 페이지에 접근하려면 먼저 로그인해야 합니다."
              : "이 페이지는 관리자 계정만 이용할 수 있습니다."}
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            대시보드로 이동
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      {/* 모바일 헤더 */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-[#0f0f1a]/95 px-4 py-3 backdrop-blur-sm md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-lg text-white/70 transition hover:bg-white/5"
          aria-label="메뉴 열기"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)]">
            <GraduationCap className="h-3.5 w-3.5 text-white" strokeWidth={2.3} />
          </span>
          <span className="text-sm font-extrabold tracking-tight">
            문<span className="text-gradient">파스</span>{" "}
            <span className="text-xs font-semibold text-violet-400">관리자</span>
          </span>
        </div>
        <span className="w-10" aria-hidden />
      </header>

      <div className="md:grid md:min-h-screen md:grid-cols-[240px_1fr]">
        {/* 데스크톱 사이드바 */}
        <aside className="hidden border-r border-white/[0.06] bg-[#13132a] md:block">
          <SidebarContent pathname={pathname} />
        </aside>

        {/* 본문 */}
        <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* 모바일 드로어 */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="fixed left-0 top-0 bottom-0 z-50 flex w-[260px] flex-col border-r border-white/[0.06] bg-[#13132a] md:hidden"
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <span className="text-sm font-bold text-violet-300">관리자 메뉴</span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-white/60 hover:bg-white/5"
                  aria-label="메뉴 닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <SidebarContent pathname={pathname} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarContent({ pathname }: { pathname: string }) {
  return (
    <div className="flex h-full flex-col">
      {/* 로고 */}
      <Link
        href="/admin"
        className="hidden items-center gap-2 border-b border-white/[0.06] px-5 py-5 md:flex"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] shadow-[0_3px_14px_rgba(124,58,237,0.4)]">
          <GraduationCap className="h-4 w-4 text-white" strokeWidth={2.3} />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-extrabold tracking-tight">
            문<span className="text-gradient">파스</span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-400">
            Admin
          </span>
        </div>
      </Link>

      {/* 네비 */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/30"
                  : "text-white/70 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 하단 — 사이트로 돌아가기 */}
      <div className="border-t border-white/[0.06] p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-white/60 transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          사이트로 돌아가기
        </Link>
      </div>
    </div>
  );
}
