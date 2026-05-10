// 사용자 역할 배지 — 학생/교사/학부모/졸업생/관리자
import { cn } from "@/lib/utils";

export type Role = "student" | "teacher" | "parent" | "alumni" | "admin";

/**
 * 역할 라벨이 노출되는 맥락.
 *  · "public": 일반 사용자에게 보이는 화면(게시판 목록·댓글·타인 프로필 등). admin 은 "교사"로 위장.
 *  · "admin":  본인 프로필·관리자 전용 화면. admin 은 그대로 "관리자"로 노출.
 */
export type RoleDisplayContext = "public" | "admin";

const ROLE_LABEL: Record<Role, string> = {
  student: "학생",
  teacher: "교사",
  parent: "학부모",
  alumni: "졸업생",
  admin: "관리자",
};

const ROLE_STYLE: Record<Role, string> = {
  student: "bg-role-student/15 text-role-student ring-role-student/30",
  teacher: "bg-role-teacher/15 text-role-teacher ring-role-teacher/30",
  parent: "bg-role-parent/15 text-role-parent ring-role-parent/30",
  alumni: "bg-role-alumni/15 text-role-alumni ring-role-alumni/30",
  admin: "bg-rose-500/15 text-rose-500 ring-rose-500/30 dark:text-rose-300",
};

/**
 * 역할에 노출할 한국어 라벨을 맥락에 맞춰 반환한다.
 *  · admin + public  → "교사"  (다른 유저에게는 일반 교사처럼 보이도록)
 *  · admin + admin   → "관리자" (본인 프로필·관리자 전용 페이지)
 *  · 그 외 역할은 맥락과 무관하게 기본 라벨.
 */
export function getDisplayRole(
  role: Role,
  context: RoleDisplayContext = "public",
): string {
  if (role === "admin" && context === "public") return ROLE_LABEL.teacher;
  return ROLE_LABEL[role];
}

type BadgeProps = {
  role: Role;
  /** 졸업생일 때만 노출되는 졸업연도 (예: 2018) */
  year?: number;
  className?: string;
  /**
   * 표시 맥락. 기본 "public" — 즉 admin 은 "교사"로 표시.
   * 본인 프로필/관리자 페이지에서는 "admin" 으로 넘겨 "관리자" 표기를 유지한다.
   */
  context?: RoleDisplayContext;
};

export function Badge({ role, year, className, context = "public" }: BadgeProps) {
  // admin 을 public 맥락에서 가릴 때는 색상도 교사 톤으로 함께 위장. 그렇지 않으면
  // 라벨만 "교사"인데 색은 admin(rose) 으로 남아 다른 유저가 admin 임을 추측 가능.
  const isMaskedAdmin = role === "admin" && context === "public";
  const styleKey: Role = isMaskedAdmin ? "teacher" : role;

  const baseLabel = getDisplayRole(role, context);
  const label =
    role === "alumni" && year ? `${baseLabel} · ${year}` : baseLabel;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        ROLE_STYLE[styleKey],
        className,
      )}
    >
      {label}
    </span>
  );
}
