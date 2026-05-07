// 사용자 역할 배지 — 학생/교사/학부모/졸업생/관리자
import { cn } from "@/lib/utils";

export type Role = "student" | "teacher" | "parent" | "alumni" | "admin";

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

type BadgeProps = {
  role: Role;
  /** 졸업생일 때만 노출되는 졸업연도 (예: 2018) */
  year?: number;
  className?: string;
};

export function Badge({ role, year, className }: BadgeProps) {
  const label =
    role === "alumni" && year ? `${ROLE_LABEL.alumni} · ${year}` : ROLE_LABEL[role];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        ROLE_STYLE[role],
        className,
      )}
    >
      {label}
    </span>
  );
}
