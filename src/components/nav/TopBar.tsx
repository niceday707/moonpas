"use client";

// 상단 메가메뉴 — 고파스 스타일 항상 펼쳐진 4열 메뉴 카드 (데스크톱)
// 태블릿/모바일 → 우측 슬라이드 전체화면 드로어 메뉴
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap, ChevronDown, Users, Menu, X, Search, Bell } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";

// ── 메뉴 정의 ───────────────────────────────────────────────────────────
type NavItem = { href: string; label: string; count: number };
type NavGroup = { label: string; items: NavItem[] };

const MEGA_NAV: NavGroup[] = [
  {
    label: "커뮤니티",
    items: [
      { href: "/feed", label: "자유게시판", count: 1234 },
      { href: "/notices", label: "공지사항", count: 87 },
      { href: "/lost", label: "분실물센터", count: 78 },
      { href: "/market", label: "나눔장터", count: 78 },
      { href: "/debate", label: "이슈토론", count: 432 },
    ],
  },
  {
    label: "재학생",
    items: [
      { href: "/admission", label: "2028 대입 정보센터", count: 248 },
      { href: "/curriculum", label: "교육과정 가이드", count: 312 },
      { href: "/council", label: "학생자치회", count: 67 },
      { href: "/qna", label: "학습 Q&A", count: 891 },
      { href: "/career", label: "진로진학 상담", count: 145 },
    ],
  },
  {
    label: "문태생활",
    items: [
      { href: "/youtube", label: "문튜브", count: 124 },
      { href: "/resources", label: "자료실", count: 567 },
      { href: "/study", label: "스터디", count: 89 },
      { href: "/news", label: "문태뉴스", count: 203 },
    ],
  },
  {
    label: "문태교우",
    items: [
      { href: "/alumni", label: "졸업생 게시판", count: 178 },
      { href: "/reviews", label: "선배 후기", count: 94 },
    ],
  },
];

const SINGLE_NAV = [{ href: "/profile", label: "내 프로필" }];

// 날짜 포맷
const TODAY_KR = new Date().toLocaleDateString("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

// ── 컴포넌트 ────────────────────────────────────────────────────────────
export function TopBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { unreadCount } = useNotifications();

  // lg 이상에서 메뉴 자동 닫기
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 메뉴 열릴 때 바디 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    setExpanded(null);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      window.alert("검색 기능은 준비 중입니다");
    }
  };

  return (
    <div>
      {/* ── 상단 고정 영역 (슬림바 + 헤더) ── */}
      <div className="sticky top-0 z-40">
        {/* 슬림바 — 데스크톱 전용 */}
        <div className="hidden border-b border-gray-200 bg-gray-50 px-4 py-1 text-[11px] text-gray-500 dark:border-white/[0.06] dark:bg-[#0d0d1a] dark:text-gray-400 lg:block">
          <div className="mx-auto flex max-w-screen-xl items-center justify-between">
            <span>{TODAY_KR}</span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              현재 접속자{" "}
              <strong className="text-violet-600 dark:text-violet-400">47</strong>명
            </span>
          </div>
        </div>

        {/* 메인 헤더 */}
        <header className="border-b border-gray-200 bg-white/95 backdrop-blur-sm dark:border-white/[0.07] dark:bg-[#0f0f1a]/95">
          <div className="mx-auto flex max-w-screen-xl items-center gap-4 px-4 md:px-6">
            {/* 로고 */}
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-2 py-3"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] shadow-[0_3px_14px_rgba(124,58,237,0.4)]">
                <GraduationCap className="h-4 w-4 text-white" strokeWidth={2.3} />
              </span>
              <span className="text-base font-extrabold tracking-tight text-gray-900 dark:text-white">
                문<span className="text-gradient">파스</span>
              </span>
            </Link>

            {/* 데스크톱 단일 링크 — lg 이상만 */}
            <nav className="hidden flex-1 items-center gap-0.5 lg:flex">
              <Link
                href="/dashboard"
                className={cn(
                  "px-3 py-3 text-sm font-semibold transition-colors",
                  pathname === "/dashboard"
                    ? "text-violet-600 dark:text-violet-400"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white",
                )}
              >
                홈
              </Link>

              {SINGLE_NAV.map((nav) => (
                <Link
                  key={nav.href}
                  href={nav.href}
                  className={cn(
                    "px-3 py-3 text-sm font-semibold transition-colors",
                    pathname === nav.href
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white",
                  )}
                >
                  {nav.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              {/* 통합검색 — 데스크톱 전용 */}
              <form
                onSubmit={handleSearch}
                className="hidden items-center gap-2 lg:flex"
              >
                <span className="hidden text-[11px] font-semibold text-gray-500 dark:text-gray-400 xl:inline">
                  문태고 커뮤니티
                </span>
                <div className="flex h-9 items-center overflow-hidden rounded-lg border border-gray-200 bg-white focus-within:border-violet-400 dark:border-white/[0.1] dark:bg-[#14142a]">
                  <Search className="ml-2.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="검색어를 입력하세요"
                    className="w-44 bg-transparent px-2 py-1 text-xs text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
                  />
                  <button
                    type="submit"
                    className="h-full bg-violet-600 px-3 text-xs font-bold text-white transition-colors hover:bg-violet-700"
                  >
                    검색
                  </button>
                </div>
              </form>

              {/* 알림 벨 — 태블릿 + 데스크톱 (모바일은 BottomNav에 있음) */}
              <Link
                href="/notifications"
                aria-label={`알림 ${unreadCount > 0 ? `(읽지 않은 알림 ${unreadCount}개)` : ""}`}
                className="relative hidden h-11 w-11 place-items-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 md:grid"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold leading-none text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>

              <ThemeToggle />

              {/* 햄버거 버튼 — 모바일 + 태블릿 (lg 미만) */}
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="grid h-11 w-11 place-items-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 lg:hidden"
                aria-label="메뉴 열기"
                aria-expanded={menuOpen}
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* ── 전체화면 드로어 메뉴 (모바일 + 태블릿, lg 미만) ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* 배경 오버레이 */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={closeMenu}
              aria-hidden
            />

            {/* 우측 슬라이드 패널 */}
            <motion.div
              key="drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[360px] flex-col overflow-hidden bg-white shadow-2xl dark:bg-[#14142a] lg:hidden"
            >
              {/* 드로어 헤더 */}
              <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)]">
                    <GraduationCap className="h-3.5 w-3.5 text-white" strokeWidth={2.3} />
                  </span>
                  <span className="font-extrabold text-gray-900 dark:text-white">
                    문<span className="text-gradient">파스</span>
                  </span>
                </div>
                <button
                  onClick={closeMenu}
                  className="grid h-11 w-11 place-items-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                  aria-label="메뉴 닫기"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* 드로어 본문 스크롤 영역 */}
              <div className="flex-1 overflow-y-auto">
                <nav className="flex flex-col pb-6">
                  {/* 홈 */}
                  <Link
                    href="/dashboard"
                    onClick={closeMenu}
                    className={cn(
                      "flex min-h-[52px] items-center px-5 text-sm font-semibold transition-colors",
                      pathname === "/dashboard"
                        ? "text-violet-600 dark:text-violet-400"
                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/[0.03]",
                    )}
                  >
                    홈
                  </Link>

                  {/* 메가 메뉴 그룹 */}
                  {MEGA_NAV.map((nav) => {
                    const isExpanded = expanded === nav.label;
                    return (
                      <div key={nav.label} className="border-t border-gray-100 dark:border-white/[0.05]">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((cur) =>
                              cur === nav.label ? null : nav.label,
                            )
                          }
                          className="flex min-h-[52px] w-full items-center justify-between px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                        >
                          {nav.label}
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-gray-400 transition-transform duration-200",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </button>

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeInOut" }}
                              className="overflow-hidden bg-gray-50 dark:bg-white/[0.02]"
                            >
                              <ul>
                                {nav.items.map((item) => (
                                  <li key={item.href}>
                                    <Link
                                      href={item.href}
                                      onClick={closeMenu}
                                      className={cn(
                                        "flex min-h-[48px] items-center justify-between px-7 py-2.5 text-sm transition-colors",
                                        pathname.startsWith(item.href)
                                          ? "text-violet-600 dark:text-violet-400"
                                          : "text-gray-600 hover:text-violet-600 dark:text-gray-300 dark:hover:text-violet-400",
                                      )}
                                    >
                                      <span className="font-medium">{item.label}</span>
                                      <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                                        {item.count.toLocaleString()}
                                      </span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {/* 단일 링크 (내 프로필 등) */}
                  <div className="border-t border-gray-100 dark:border-white/[0.05]">
                    {SINGLE_NAV.map((nav) => (
                      <Link
                        key={nav.href}
                        href={nav.href}
                        onClick={closeMenu}
                        className={cn(
                          "flex min-h-[52px] items-center px-5 text-sm font-semibold transition-colors",
                          pathname === nav.href
                            ? "text-violet-600 dark:text-violet-400"
                            : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/[0.03]",
                        )}
                      >
                        {nav.label}
                      </Link>
                    ))}
                  </div>
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 데스크톱 항상 펼쳐진 메가메뉴 카드 (lg 이상) ── */}
      <div className="hidden lg:block">
        <div className="mx-auto max-w-screen-xl px-4 pb-3 pt-4 md:px-6">
          <div className="grid grid-cols-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:border-white/[0.08] dark:bg-[#14142a] dark:shadow-none">
            {MEGA_NAV.map((nav, idx) => (
              <div
                key={nav.label}
                className={cn(
                  "px-5 py-5",
                  idx > 0 && "border-l border-gray-100 dark:border-white/[0.05]",
                )}
              >
                <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">
                  {nav.label}
                </h3>
                <ul className="space-y-1">
                  {nav.items.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "group flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-[13px] transition-colors",
                            isActive
                              ? "text-violet-600 dark:text-violet-400"
                              : "text-gray-600 hover:text-violet-600 dark:text-gray-300 dark:hover:text-violet-400",
                          )}
                        >
                          <span className="truncate">{item.label}</span>
                          <span
                            className={cn(
                              "shrink-0 text-[11px] tabular-nums transition-colors",
                              isActive
                                ? "text-violet-500/80 dark:text-violet-400/70"
                                : "text-gray-400 group-hover:text-violet-500 dark:text-gray-500 dark:group-hover:text-violet-400",
                            )}
                          >
                            {item.count.toLocaleString()}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
