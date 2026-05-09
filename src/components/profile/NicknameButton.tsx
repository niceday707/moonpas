"use client";

// 닉네임 텍스트를 클릭하면 ProfileCardModal 을 열어주는 얇은 래퍼.
// 기존 displayAuthorNameFor 결과를 children 으로 감싸서 사용하는 방식.
// userId 가 없거나(익명 게시판) 빈 문자열이면 클릭 동작 없이 평범한 span 으로 폴백.
import { useState, type ReactNode, type MouseEvent } from "react";
import { ProfileCardModal } from "./ProfileCardModal";
import { cn } from "@/lib/utils";

type Props = {
  userId: string | null | undefined;
  /** 평소 화면에 표시되는 닉네임 텍스트 */
  children: ReactNode;
  className?: string;
};

export function NicknameButton({ userId, children, className }: Props) {
  const [open, setOpen] = useState(false);

  // 익명/마스킹 케이스 — 클릭 비활성화 (Link 등 부모 동작도 막지 않게 그냥 span 노출)
  if (!userId) {
    return <span className={className}>{children}</span>;
  }

  const handleClick = (e: MouseEvent) => {
    // 부모가 <Link> 인 경우 — 닉네임 클릭은 라우팅 대신 모달 오픈으로 가로챈다.
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "cursor-pointer text-left underline-offset-2 hover:underline",
          className,
        )}
      >
        {children}
      </button>
      <ProfileCardModal
        open={open}
        userId={userId}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
