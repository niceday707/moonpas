"use client";

// 글쓰기 모달 — 모바일: 바텀시트, 데스크톱: 센터 카드
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useCompose } from "./ComposeProvider";
import { Composer } from "./Composer";

export function ComposeModal() {
  const { isOpen, close } = useCompose();
  const router = useRouter();

  // ESC 로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // SSR 가드 — portal 은 클라이언트에서만
  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="compose-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm md:items-center"
          onClick={close}
          aria-modal
          role="dialog"
          aria-label="새 글 작성"
        >
          <motion.div
            key="compose-panel"
            initial={{ y: 80, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass relative w-full max-w-xl rounded-t-3xl px-5 pb-6 pt-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] md:mx-4 md:rounded-3xl md:px-6 md:pb-7 md:pt-6"
            style={{
              paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* 모바일 그랩 핸들 */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-foreground/15 md:hidden" />

            {/* 헤더 */}
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold tracking-tight md:text-lg">
                새 글 작성
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="닫기"
                className="grid h-9 w-9 place-items-center rounded-full text-foreground/55 transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <Composer
              onSubmitted={() => {
                close();
                // 작성 직후 메인 피드 최신순으로 이동 — 새 글이 맨 위에 노출됨
                router.push("/feed");
              }}
              onCancel={close}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
