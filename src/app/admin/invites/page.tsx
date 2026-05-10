"use client";

// 초대 코드 관리 — 일괄 생성, 목록 조회(사용여부/사용자/생성일), 미사용 코드 삭제
//
// 보안 모델
// · invite_codes 테이블은 RLS 로 admin 만 SELECT/INSERT/DELETE 가능
// · UPDATE 정책 없음 — 코드 소비는 consume_invite_code RPC 만 가능
// · DELETE 는 used = false 인 row 에 한해서만 정책이 허용
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  Plus,
  Loader2,
  Trash2,
  Check,
  Copy,
  X,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { generateInviteCode } from "@/lib/invite-code";
import { cn } from "@/lib/utils";

type InviteRole = "parent" | "alumni";

const ROLE_LABEL: Record<InviteRole, string> = {
  parent: "학부모",
  alumni: "졸업생",
};

const ROLE_STYLE: Record<InviteRole, string> = {
  parent: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  alumni: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
};

type InviteCodeRow = {
  id: string;
  code: string;
  role: InviteRole;
  used: boolean;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

// 사용자 닉네임 매핑 (used_by → nickname)
type ProfileMini = { id: string; nickname: string };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export default function AdminInvitesPage() {
  const [rows, setRows] = useState<InviteCodeRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InviteCodeRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchRows() {
    setLoading(true);
    const { data, error } = await supabase
      .from("invite_codes")
      .select(
        "id, code, role, used, used_by, used_at, expires_at, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[admin/invites] 조회 실패", error);
      setRows([]);
      setLoading(false);
      return;
    }

    const codeRows = (data ?? []) as InviteCodeRow[];
    setRows(codeRows);

    // 사용된 코드의 사용자 닉네임 lookup
    const userIds = Array.from(
      new Set(codeRows.map((r) => r.used_by).filter((v): v is string => !!v)),
    );
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", userIds);
      const map: Record<string, string> = {};
      ((profs ?? []) as ProfileMini[]).forEach((p) => {
        map[p.id] = p.nickname;
      });
      setProfiles(map);
    } else {
      setProfiles({});
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchRows();
  }, []);

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.used) {
      window.alert("이미 사용된 코드는 삭제할 수 없습니다 (이력 보존).");
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    const { error } = await supabase
      .from("invite_codes")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      console.error("[admin/invites] 삭제 실패", error);
      window.alert(
        "삭제에 실패했습니다.\n" +
          error.message +
          "\n\n사용된 코드는 정책상 삭제할 수 없습니다.",
      );
    } else {
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    }
    setDeleting(false);
    setDeleteTarget(null);
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const used = rows.filter((r) => r.used).length;
    const unused = total - used;
    return { total, used, unused };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold md:text-2xl">
            <Ticket className="h-5 w-5 text-amber-400" />
            초대 코드 관리
          </h1>
          <p className="mt-1 text-xs text-white/50">
            학부모/졸업생용 1회용 초대 코드를 생성하고 관리합니다.
          </p>
          <p className="mt-2 text-[11px] text-white/40">
            전체 {stats.total} · 미사용 {stats.unused} · 사용됨 {stats.used}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(124,58,237,0.35)] transition hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />새 초대 코드 생성
        </button>
      </div>

      {/* 목록 */}
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
            아직 생성된 초대 코드가 없습니다.
          </div>
        ) : (
          <>
            {/* 데스크톱 테이블 */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.05] text-left text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    <th className="px-5 py-3">코드</th>
                    <th className="px-5 py-3">역할</th>
                    <th className="px-5 py-3">사용 여부</th>
                    <th className="px-5 py-3">사용자</th>
                    <th className="px-5 py-3">만료일</th>
                    <th className="px-5 py-3">생성일</th>
                    <th className="px-5 py-3 text-right">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const expired = isExpired(r.expires_at);
                    const disabled = r.used || expired;
                    const nick = r.used_by
                      ? profiles[r.used_by] ?? "(알 수 없음)"
                      : "—";
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-white/[0.04] last:border-b-0"
                      >
                        <td className="px-5 py-3">
                          <CodeChip code={r.code} disabled={disabled} />
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                              ROLE_STYLE[r.role],
                            )}
                          >
                            {ROLE_LABEL[r.role]}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {r.used ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-inset ring-rose-400/30">
                              사용됨
                            </span>
                          ) : expired ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-inset ring-amber-400/30">
                              만료됨
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
                              미사용
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs">
                          <div className="flex flex-col">
                            <span className="text-white/80">{nick}</span>
                            {r.used_at && (
                              <span className="text-[10px] text-white/40">
                                {formatDate(r.used_at)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs">
                          <span
                            className={
                              expired ? "text-rose-300" : "text-white/60"
                            }
                          >
                            {formatDate(r.expires_at)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs tabular-nums text-white/50">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            disabled={r.used}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-30"
                            title={r.used ? "사용된 코드는 삭제할 수 없습니다" : "삭제"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 모바일 카드 */}
            <ul className="divide-y divide-white/[0.04] md:hidden">
              {rows.map((r) => {
                const expired = isExpired(r.expires_at);
                const disabled = r.used || expired;
                const nick = r.used_by
                  ? profiles[r.used_by] ?? "(알 수 없음)"
                  : null;
                return (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <CodeChip code={r.code} disabled={disabled} />
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                          ROLE_STYLE[r.role],
                        )}
                      >
                        {ROLE_LABEL[r.role]}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/50">
                      {r.used ? (
                        <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                          사용됨
                        </span>
                      ) : expired ? (
                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                          만료
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                          미사용
                        </span>
                      )}
                      {nick && (
                        <>
                          <span>·</span>
                          <span>{nick}</span>
                        </>
                      )}
                      {r.expires_at && (
                        <>
                          <span>·</span>
                          <span className={expired ? "text-rose-300" : ""}>
                            만료 {formatDate(r.expires_at)}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-white/40">
                        생성 {formatDate(r.created_at)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(r)}
                        disabled={r.used}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        삭제
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </motion.div>

      {/* 보안 안내 */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-[11px] leading-relaxed text-violet-200/80">
        <p className="flex items-center gap-1.5 font-semibold text-violet-200">
          <ShieldCheck className="h-3.5 w-3.5" />
          보안 모델
        </p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>각 코드는 1명만 사용 가능 (1회용). 사용되면 자동으로 used 처리.</li>
          <li>
            코드 검증·소비는 모두 서버 RPC(<code className="font-mono">validate_invite_code</code> /
            <code className="ml-1 font-mono">consume_invite_code</code>)에서만 처리됩니다.
          </li>
          <li>역할(parent/alumni)은 코드의 값을 서버가 강제 부여합니다.</li>
          <li>사용된 코드는 이력 보존을 위해 삭제할 수 없습니다.</li>
        </ul>
      </div>

      {/* 생성 모달 */}
      <AnimatePresence>
        {createOpen && (
          <CreateInviteModal
            onClose={() => setCreateOpen(false)}
            onCreated={(newRows) => {
              setRows((prev) => [...newRows, ...prev]);
            }}
          />
        )}
      </AnimatePresence>

      {/* 삭제 확인 모달 */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteInviteModal
            target={deleteTarget}
            deleting={deleting}
            onConfirm={confirmDelete}
            onClose={() => !deleting && setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CodeChip({ code, disabled }: { code: string; disabled: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-sm font-bold tracking-widest transition",
        disabled
          ? "border-white/[0.06] bg-white/[0.02] text-white/40 line-through"
          : "border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20",
      )}
      title="클릭하여 복사"
    >
      {code}
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 opacity-60" />
      )}
    </button>
  );
}

function CreateInviteModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (rows: InviteCodeRow[]) => void;
}) {
  const [role, setRole] = useState<InviteRole>("parent");
  const [count, setCount] = useState("1");
  const [expiresAt, setExpiresAt] = useState(""); // yyyy-mm-dd
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCodes, setCreatedCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedCount = Number(count);
    if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 100) {
      setError("생성 개수는 1~100 사이의 정수여야 합니다.");
      return;
    }

    setSubmitting(true);

    const expiresAtIso = expiresAt
      ? new Date(expiresAt + "T23:59:59").toISOString()
      : null;

    const inserted: InviteCodeRow[] = [];
    let lastErr: string | null = null;

    // 한 번에 N 개 생성 — 코드 충돌 시 개별 재시도
    for (let i = 0; i < parsedCount; i++) {
      let codeInserted: InviteCodeRow | null = null;

      for (let attempt = 0; attempt < 6; attempt++) {
        const code = generateInviteCode();
        const payload: Record<string, unknown> = { code, role };
        if (expiresAtIso) payload.expires_at = expiresAtIso;

        const { data, error } = await supabase
          .from("invite_codes")
          .insert(payload)
          .select(
            "id, code, role, used, used_by, used_at, expires_at, created_at",
          )
          .single();

        if (!error && data) {
          codeInserted = data as InviteCodeRow;
          break;
        }
        // 23505 = unique violation → 다른 코드로 재시도
        const code23505 = (error as { code?: string } | null)?.code === "23505";
        if (!code23505) {
          lastErr = error?.message ?? "알 수 없는 오류";
          break;
        }
      }

      if (!codeInserted) {
        lastErr =
          lastErr ?? "코드 충돌이 반복됩니다. 잠시 후 다시 시도해주세요.";
        break;
      }
      inserted.push(codeInserted);
    }

    if (inserted.length > 0) onCreated(inserted);

    if (lastErr && inserted.length < parsedCount) {
      setError(
        `${inserted.length}/${parsedCount} 개 생성 후 오류 발생: ${lastErr}`,
      );
    }
    setCreatedCodes(inserted.map((r) => r.code));
    setSubmitting(false);
  }

  async function copyAll() {
    if (!createdCodes || createdCodes.length === 0) return;
    try {
      await navigator.clipboard.writeText(createdCodes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#16162a] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute right-3 top-3 rounded-full p-1.5 text-white/50 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-1 flex items-center gap-2 text-violet-400">
          <Ticket className="h-4 w-4" />
          <span className="text-[11px] font-semibold uppercase tracking-widest">
            새 초대 코드
          </span>
        </div>

        {!createdCodes ? (
          <>
            <h2 className="text-lg font-bold">초대 코드 일괄 생성</h2>
            <p className="mt-1 text-xs text-white/50">
              지정한 개수만큼 5자리 코드(영문 1자 + 숫자 4자)가 발급됩니다. 각 코드는 1회용입니다.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  역할
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["parent", "alumni"] as InviteRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                        role === r
                          ? "border-violet-400 bg-violet-500/15 text-white"
                          : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]",
                      )}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  생성 개수 (1~100)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400"
                />
                <p className="mt-1 text-[10px] text-white/40">
                  1코드 = 1명만 사용 가능합니다.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  만료일 (선택)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400"
                />
                <p className="mt-1 text-[10px] text-white/40">
                  비워두면 무기한
                </p>
              </div>

              {error && (
                <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "생성 중..." : "코드 생성"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold">
              {createdCodes.length}개 코드가 생성되었습니다
            </h2>
            <p className="mt-1 text-xs text-white/50">
              아래 코드를 복사해 사용자에게 전달하세요.
            </p>

            <div className="mt-5 max-h-72 overflow-y-auto rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
              <ul className="grid grid-cols-2 gap-2">
                {createdCodes.map((c) => (
                  <li
                    key={c}
                    className="rounded-lg bg-black/30 px-3 py-2 text-center font-mono text-base font-extrabold tracking-[0.3em] text-violet-100"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            {error && (
              <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={copyAll}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  복사됨
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  전체 복사 (줄바꿈 구분)
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="mt-2 flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              완료
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function DeleteInviteModal({
  target,
  deleting,
  onConfirm,
  onClose,
}: {
  target: InviteCodeRow;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#16162a] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={deleting}
          className="absolute right-3 top-3 rounded-full p-1.5 text-white/50 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 text-rose-300">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-bold">초대 코드 삭제</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/60">
          미사용 코드만 삭제할 수 있습니다. 정말 삭제하시겠어요?
        </p>
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
          <p className="font-mono text-lg font-bold tracking-widest text-white">
            {target.code}
          </p>
          <p className="mt-1 text-[11px] text-white/50">
            {ROLE_LABEL[target.role]} · {target.used ? "사용됨" : "미사용"}
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06] disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting || target.used}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {deleting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
