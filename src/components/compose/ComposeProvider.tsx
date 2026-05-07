"use client";

// 글쓰기 모달 컨텍스트 — FAB / BottomNav / 모달 사이를 잇는다
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth";

type ComposeCtx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const Ctx = createContext<ComposeCtx | null>(null);

export function useCompose(): ComposeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCompose 는 ComposeProvider 안에서만 사용할 수 있어요");
  return v;
}

export function ComposeProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { isLoggedIn } = useAuth();

  // 비로그인 상태에서 글쓰기 시도하면 안내만 띄운다.
  const open = useCallback(() => {
    if (!isLoggedIn) {
      if (typeof window !== "undefined") {
        window.alert("로그인이 필요합니다");
      }
      return;
    }
    setIsOpen(true);
  }, [isLoggedIn]);
  const close = useCallback(() => setIsOpen(false), []);

  // 모달이 열려 있는 동안 body 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  return <Ctx.Provider value={{ isOpen, open, close }}>{children}</Ctx.Provider>;
}
