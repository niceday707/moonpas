"use client";

// ComposeProvider + FAB + Modal 을 한 번에 묶어 layout 에서 children 만 감싸면 되도록
import type { ReactNode } from "react";
import { FloatingActionButton } from "@/components/ui/FloatingActionButton";
import { ComposeProvider, useCompose } from "./ComposeProvider";
import { ComposeModal } from "./ComposeModal";

function ComposeFab() {
  const { open } = useCompose();
  return <FloatingActionButton onClick={open} />;
}

export function ComposeShell({ children }: { children: ReactNode }) {
  return (
    <ComposeProvider>
      {children}
      <ComposeFab />
      <ComposeModal />
    </ComposeProvider>
  );
}
