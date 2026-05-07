"use client";

// 회원 관리 — 회원 목록, 역할 변경, 검색, 페이지네이션
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Users, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type AdminRole = "student" | "teacher" | "parent" | "alumni" | "admin";

const ROLE_OPTIONS: AdminRole[] = ["student", "teacher", "parent", "alumni", "admin"];
const ROLE_LABEL: Record<AdminRole, string> = {
  student: "학생",
  teacher: "교사",
  parent: "학부모",
  alumni: "졸업생",
  admin: "관리자",
};

const ROLE_STYLE: Record<AdminRole, string> = {
  student: "bg-blue-500/15 text-blue-300 ring-blue-400/30",
  teacher: "bg-violet-500/15 text-violet-300 ring-violet-400/30",
  parent: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  alumni: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  admin: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
};

type MemberRow = {
  id: string;
  nickname: string;
  role: AdminRole;
  created_at: string;
};

const PER_PAGE = 20;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // 검색어 디바운스
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const from = (page - 1) * PER_PAGE;
      const to = from + PER_PAGE - 1;

      let query = supabase
        .from("profiles")
        .select("id, nickname, role, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (debouncedSearch) {
        query = query.ilike("nickname", `%${debouncedSearch}%`);
      }

      const { data, count, error } = await query;
      if (!active) return;
      if (error) {
        console.error("[admin/users] 조회 실패", error);
        setRows([]);
        setTotal(0);
      } else {
        setRows((data ?? []) as MemberRow[]);
        setTotal(count ?? 0);
      }
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [debouncedSearch, page]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PER_PAGE)),
    [total],
  );

  async function handleRoleChange(userId: string, role: AdminRole) {
    setUpdating(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    if (error) {
      console.error("[admin/users] 역할 변경 실패", error);
      window.alert("역할 변경에 실패했습니다.\n" + error.message);
    } else {
      setRows((prev) =>
        prev.map((r) => (r.id === userId ? { ...r, role } : r)),
      );
    }
    setUpdating(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold md:text-2xl">
          <Users className="h-5 w-5 text-violet-400" />
          회원 관리
        </h1>
        <p className="mt-1 text-xs text-white/50">
          닉네임, 역할, 가입일을 확인하고 역할을 변경할 수 있습니다. (이메일은 Supabase
          대시보드에서 확인)
        </p>
      </div>

      {/* 검색 */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 flex-1 items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] focus-within:border-violet-400">
          <Search className="ml-3 h-4 w-4 shrink-0 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="닉네임으로 검색"
            className="w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/30"
          />
        </div>
        <span className="hidden text-xs text-white/40 md:block">
          총 <strong className="text-white">{total.toLocaleString()}</strong>명
        </span>
      </div>

      {/* 테이블 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl"
      >
        {loading ? (
          <div className="grid place-items-center py-20 text-xs text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-xs text-white/40">
            {debouncedSearch
              ? `"${debouncedSearch}" 검색 결과가 없습니다.`
              : "회원이 없습니다."}
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.05] text-left text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    <th className="px-5 py-3">닉네임</th>
                    <th className="px-5 py-3">역할</th>
                    <th className="px-5 py-3">가입일</th>
                    <th className="px-5 py-3 text-right">역할 변경</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-white/[0.04] last:border-b-0"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[linear-gradient(135deg,#7c3aed,#06b6d4)] text-xs font-bold text-white">
                            {m.nickname.charAt(0)}
                          </div>
                          <span className="font-semibold">{m.nickname}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                            ROLE_STYLE[m.role],
                          )}
                        >
                          {ROLE_LABEL[m.role]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-white/60">
                        {formatDate(m.created_at)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <select
                          value={m.role}
                          disabled={updating === m.id}
                          onChange={(e) =>
                            handleRoleChange(m.id, e.target.value as AdminRole)
                          }
                          className="rounded-lg border border-white/10 bg-[#1a1a30] px-2 py-1.5 text-xs text-white outline-none focus:border-violet-400 disabled:opacity-50"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 모바일 카드 뷰 */}
            <ul className="divide-y divide-white/[0.04] md:hidden">
              {rows.map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[linear-gradient(135deg,#7c3aed,#06b6d4)] text-xs font-bold text-white">
                      {m.nickname.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{m.nickname}</p>
                      <p className="text-[11px] text-white/40">
                        {formatDate(m.created_at)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                        ROLE_STYLE[m.role],
                      )}
                    >
                      {ROLE_LABEL[m.role]}
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <select
                      value={m.role}
                      disabled={updating === m.id}
                      onChange={(e) =>
                        handleRoleChange(m.id, e.target.value as AdminRole)
                      }
                      className="w-full rounded-lg border border-white/10 bg-[#1a1a30] px-3 py-2 text-xs text-white outline-none focus:border-violet-400 disabled:opacity-50"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          역할: {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </motion.div>

      {/* 페이지네이션 */}
      {!loading && total > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onChange={setPage}
        />
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const start = (page - 1) * PER_PAGE + 1;
  const end = Math.min(page * PER_PAGE, total);
  return (
    <div className="flex items-center justify-between text-xs text-white/50">
      <span>
        {start.toLocaleString()}–{end.toLocaleString()} / 총{" "}
        {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-white/70 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="tabular-nums text-white/70">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-white/70 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
