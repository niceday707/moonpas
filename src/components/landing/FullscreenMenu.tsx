"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ExternalLink } from "lucide-react";

interface SubLink {
  label: string;
  href: string;
}
interface MenuItem {
  label: string;
  href?: string;
  sub?: SubLink[];
}

const MENU_ITEMS: MenuItem[] = [
  {
    label: "커뮤니티",
    sub: [
      { label: "자유게시판", href: "/feed" },
      { label: "공지사항", href: "/notices" },
      { label: "분실물센터", href: "/lost" },
      { label: "나눔장터", href: "/market" },
      { label: "이슈토론", href: "/debate" },
    ],
  },
  {
    label: "재학생",
    sub: [
      { label: "2028 대입 정보센터", href: "/admission" },
      { label: "교육과정 가이드", href: "/curriculum" },
      { label: "학생자치회", href: "/council" },
      { label: "학습 Q&A", href: "/qna" },
      { label: "진로진학 상담", href: "/career" },
    ],
  },
  {
    label: "문태생활",
    sub: [
      { label: "문튜브", href: "/youtube" },
      { label: "자료실", href: "/resources" },
      { label: "스터디", href: "/study" },
      { label: "문태뉴스", href: "/news" },
    ],
  },
  {
    label: "문태교우",
    sub: [
      { label: "졸업생 게시판", href: "/alumni" },
      { label: "선배 후기", href: "/reviews" },
    ],
  },
  { label: "내 프로필", href: "/profile" },
];

const LEFT_LINKS = [
  { label: "학부모", href: "/login?role=parent" },
  { label: "졸업생", href: "/login?role=alumni" },
  { label: "방문자", href: "/dashboard" },
];

const EXTERNAL_LINKS = [
  {
    label: "문태고 홈페이지",
    href: "https://moontae.hs.jne.kr/moontae_hs/main.do",
  },
  { label: "전남교육청", href: "https://www.jne.go.kr" },
  {
    label: "학생자치회 유튜브",
    href: "https://www.youtube.com/@moontae_official",
  },
];

const BOTTOM_LINKS = [
  { label: "자유게시판", href: "/feed" },
  { label: "공지사항", href: "/notices" },
  { label: "문튜브", href: "/youtube" },
  { label: "자료실", href: "/resources" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function FullscreenMenu({ isOpen, onClose }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // openIdx 초기화
  useEffect(() => {
    if (!isOpen) setOpenIdx(null);
  }, [isOpen]);

  // 스크롤 잠금 + ESC 닫기
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  const toggle = (idx: number) =>
    setOpenIdx((prev) => (prev === idx ? null : idx));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="fullscreen-menu"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed inset-0 z-[100] flex"
        >
          {/* ── 왼쪽 패널: 학교 전경 (데스크톱 전용) ── */}
          <div className="relative hidden w-1/3 overflow-hidden md:block">
            <img
              src="/school1.jpg"
              alt="문태고등학교 전경"
              className="h-full w-full object-cover"
              draggable={false}
            />
            {/* 반투명 어두운 오버레이 */}
            <div className="absolute inset-0 bg-black/55" />

            {/* 하단 링크 영역 */}
            <nav
              aria-label="역할별 진입"
              className="absolute bottom-12 left-8 z-10 flex flex-col gap-4"
            >
              {LEFT_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className="text-sm font-medium tracking-wider text-white/75 transition-colors duration-200 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}

              <div className="my-1 w-8 border-t border-white/25" />

              {EXTERNAL_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs tracking-wider text-white/55 transition-colors duration-200 hover:text-white/90"
                >
                  {link.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </nav>
          </div>

          {/* ── 오른쪽 패널 ── */}
          <div
            className="flex flex-1 flex-col overflow-y-auto"
            style={{ backgroundColor: "#160b33" }}
          >
            {/* 닫기 버튼 */}
            <div className="flex shrink-0 justify-end px-8 pt-7 md:px-12">
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 text-sm font-semibold tracking-[0.2em] text-white/80 transition-colors duration-200 hover:text-white"
              >
                ∧&nbsp;Close
              </button>
            </div>

            {/* 메인 메뉴 */}
            <nav
              aria-label="주요 메뉴"
              className="flex flex-1 flex-col justify-center px-8 py-4 md:px-14 md:py-6"
            >
              {MENU_ITEMS.map((item, idx) => {
                const isExpanded = openIdx === idx;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: 0.1 + idx * 0.08,
                      ease: "easeOut",
                    }}
                    className="border-b border-white/10 last:border-none"
                  >
                    {item.href ? (
                      // 직접 이동 메뉴 (내 프로필)
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className="group block py-4 text-4xl font-light text-white transition-all duration-200 hover:translate-x-2 hover:italic md:text-5xl"
                        style={{ fontFamily: 'Georgia, Batang, "Times New Roman", serif' }}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <>
                        {/* 아코디언 버튼 */}
                        <button
                          type="button"
                          onClick={() => toggle(idx)}
                          aria-expanded={isExpanded}
                          className={[
                            "flex w-full items-center justify-between py-4 text-4xl font-light text-white",
                            "transition-all duration-200 md:text-5xl",
                            isExpanded
                              ? "translate-x-2 italic"
                              : "hover:translate-x-2 hover:italic",
                          ].join(" ")}
                          style={{ fontFamily: 'Georgia, Batang, "Times New Roman", serif' }}
                        >
                          {item.label}
                          <ChevronDown
                            className={[
                              "mr-2 h-5 w-5 shrink-0 transition-transform duration-300",
                              isExpanded ? "rotate-180" : "",
                            ].join(" ")}
                          />
                        </button>

                        {/* 서브메뉴 */}
                        <AnimatePresence initial={false}>
                          {isExpanded && item.sub && (
                            <motion.ul
                              key="sub"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{
                                duration: 0.3,
                                ease: "easeInOut",
                              }}
                              className="overflow-hidden"
                            >
                              {item.sub.map((sub) => (
                                <li key={sub.href}>
                                  <Link
                                    href={sub.href}
                                    onClick={onClose}
                                    className="block py-2.5 pl-3 text-lg text-white/75 underline-offset-4 transition-all duration-150 hover:text-white hover:underline"
                                  >
                                    {sub.label}
                                  </Link>
                                </li>
                              ))}
                              <li className="pb-3" />
                            </motion.ul>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </nav>

            {/* 하단 빠른 링크 */}
            <div className="flex shrink-0 flex-wrap gap-x-8 gap-y-2 border-t border-white/10 px-8 py-5 md:px-14">
              {BOTTOM_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className="text-xs tracking-wider text-white/45 transition-colors duration-200 hover:text-white/75"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
