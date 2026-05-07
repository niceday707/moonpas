// 원형 아바타.
// - 일반: 역할별 그라데이션 위에 닉네임 첫 글자.
// - 프로필 이미지가 있으면 그 이미지를 우선 표시.
// - 익명 글/댓글에는 author 정보를 노출하지 않고 회색 익명 아바타를 그린다.
import { cn } from "@/lib/utils";
import type { Author } from "@/lib/mock-data";

const SIZE = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-2xl",
};

const ROLE_GRADIENT: Record<Author["role"], string> = {
  student: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
  teacher: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
  parent: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
  alumni: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
};

const ANON_GRADIENT =
  "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)";

type Props = {
  /** 익명일 때는 생략 가능 */
  author?: Author;
  size?: keyof typeof SIZE;
  /** true 면 author 와 무관하게 익명 아바타로 그림 */
  anonymous?: boolean;
  className?: string;
};

export function Avatar({ author, size = "md", anonymous, className }: Props) {
  // 익명: 회색 그라데이션 + "익" 글자
  if (anonymous || !author) {
    return (
      <div
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center rounded-full font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]",
          SIZE[size],
          className,
        )}
        style={{ background: ANON_GRADIENT }}
      >
        익
      </div>
    );
  }

  // 프로필 이미지가 있으면 우선 사용
  if (author.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={author.imageUrl}
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

  // 기본: 역할 그라데이션 + 닉네임 첫 글자
  const initial = author.name.charAt(0);
  return (
    <div
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]",
        SIZE[size],
        className,
      )}
      style={{ background: ROLE_GRADIENT[author.role] }}
    >
      {initial}
    </div>
  );
}
