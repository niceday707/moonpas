// 원형 아바타 — Supabase profiles 데이터 기반.
// avatar_url 이 있으면 이미지로, 없으면 역할 그라데이션 + 닉네임 첫 글자.
//
// 기존 components/feed/Avatar.tsx 는 mock-data Author 타입에 묶여 있어
// 이 컴포넌트는 실제 프로필 데이터(닉네임/역할/avatar_url)에 맞춰 분리.

import type { Role } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const SIZE = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-2xl",
};

const ROLE_GRADIENT: Record<Role, string> = {
  student: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
  teacher: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
  parent: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
  alumni: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
  admin: "linear-gradient(135deg, #f43f5e 0%, #7c3aed 100%)",
};

const ANON_GRADIENT = "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)";

type Props = {
  /** 닉네임 — 첫 글자가 폴백 아바타에 들어감 */
  nickname?: string | null;
  /** 사용자 역할 — 그라데이션 색상 결정 */
  role?: Role | null;
  /** 업로드된 아바타 URL */
  avatarUrl?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
};

export function UserAvatar({
  nickname,
  role,
  avatarUrl,
  size = "md",
  className,
}: Props) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        aria-hidden
        className={cn(
          "shrink-0 rounded-full object-cover shadow-[0_2px_8px_rgba(0,0,0,0.2)]",
          SIZE[size],
          className,
        )}
      />
    );
  }

  const initial = (nickname ?? "?").charAt(0) || "?";
  const bg = role ? ROLE_GRADIENT[role] : ANON_GRADIENT;

  return (
    <div
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]",
        SIZE[size],
        className,
      )}
      style={{ background: bg }}
    >
      {initial}
    </div>
  );
}
