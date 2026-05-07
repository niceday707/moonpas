"use client";

// 초대 코드 관리 — 목록, 새 코드 생성, 삭제
import { useEffect, useState } from "react";
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
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  created_at: string;
};

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
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InviteCodeRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchRows() {
    setLoading(true);
    const { data, error } = await supabase
      .from("invite_codes")
      .select("id, code, role, max_uses, used_count, expires_at, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[admin/invites] 조회 실패", error);
      setRows([]);
    } else {
      setRows((data ?? []) as InviteCodeRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchRows();
  }, []);

  async function confirmDelete() {
    if (!deleteTarget) return;
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
          "\n\n초대 코드 DELETE 정책이 설정되어 있는지 확인해주세요.",
      );
    } else {
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    }
    setDeleting(false);
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold md:text-2xl">
            <Ticket className="h-5 w-5 text-amber-400" />
            초대 코드 관리
          </h1>
          <p className="mt-1 text-xs text-white/50">
            학부모/졸업생용 초대 코드를 생성하고 관리합니다.
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
                    <th className="px-5 py-3 text-right">사용</th>
                    <th className="px-5 py-3">만료일</th>
                    <th className="px-5 py-3">생성일</th>
                    <th className="px-5 py-3 text-right">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const expired = isExpired(r.expires_at);
                    const exhausted =
                      r.max_uses != null && r.used_count >= r.max_uses;
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-white/[0.04] last:border-b-0"
                      >
                        <td className="px-5 py-3">
                          <CodeChip code={r.code} disabled={expired || exhausted} />
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
                        <td className="px-5 py-3 text-right text-xs tabular-nums text-white/70">
                          {r.used_count.toLocaleString()} /{" "}
                          {r.max_uses == null
                            ? "∞"
                            : r.max_uses.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-xs">
                          <span
                            className={
                              expired ? "text-rose-300" : "text-white/60"
                            }
                          >
                            {formatDate(r.expires_at)}
                            {expired && (
                              <span className="ml-1 text-[10px] font-bold">
                                (만료)
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs tabular-nums text-white/50">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25"
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
                const exhausted =
                  r.max_uses != null && r.used_count >= r.max_uses;
                return (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <CodeChip code={r.code} disabled={expired || exhausted} />
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
                      <span>
                        사용: {r.used_count}/
                        {r.max_uses == null ? "∞" : r.max_uses}
                      </span>
                      <span>·</span>
                      <span className={expired ? "text-rose-300" : ""}>
                        만료: {formatDate(r.expires_at)}
                        {expired && " (만료됨)"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-white/40">
                        생성: {formatDate(r.created_at)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(r)}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25"
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

      {/* SQL 안내 */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-[11px] leading-relaxed text-violet-200/80">
        <p className="flex items-center gap-1.5 font-semibold text-violet-200">
          <ShieldCheck className="h-3.5 w-3.5" />
          초대 코드 INSERT/DELETE 가 동작하지 않으면
        </p>
        <p className="mt-1">
          Supabase SQL Editor 에서 admin 전용 정책을 추가해주세요. 예시:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-[10px] text-violet-100/80">{`-- 관리자만 invite_codes 에 INSERT/DELETE 가능
create policy "admin can insert invite_codes" on invite_codes
for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "admin can delete invite_codes" on invite_codes
for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);`}</pre>
      </div>

      {/* 생성 모달 */}
      <AnimatePresence>
        {createOpen && (
          <CreateInviteModal
            onClose={() => setCreateOpen(false)}
            onCreated={(row) => {
              setRows((prev) => [row, ...prev]);
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
  onCreated: (row: InviteCodeRow) => void;
}) {
  const [role, setRole] = useState<InviteRole>("parent");
  const [maxUses, setMaxUses] = useState("9999");
  const [expiresAt, setExpiresAt] = useState(""); // yyyy-mm-dd
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedMax = Number(maxUses);
    if (!Number.isFinite(parsedMax) || parsedMax < 1) {
      setError("최대 사용 횟수는 1 이상이어야 합니다.");
      return;
    }

    setSubmitting(true);

    // 충돌 시 최대 5번까지 재시도
    let lastErr: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInviteCode();
      const payload: Record<string, unknown> = {
        code,
        role,
        max_uses: parsedMax,
        used_count: 0,
      };
      if (expiresAt) {
        payload.expires_at = new Date(expiresAt + "T23:59:59").toISOString();
      }
      const { data, error } = await supabase
        .from("invite_codes")
        .insert(payload)
        .select("id, code, role, max_uses, used_count, expires_at, created_at")
        .single();

      if (!error && data) {
        onCreated(data as InviteCodeRow);
        setCreatedCode(code);
        setSubmitting(false);
        return;
      }
      // 23505 = unique violation → 재시도
      const code23505 =
        (error as { code?: string } | null)?.code === "23505";
      if (!code23505) {
        lastErr = error?.message ?? "알 수 없는 오류";
        break;
      }
    }
    setError(
      lastErr ?? "코드 충돌이 반복됩니다. 잠시 후 다시 시도해주세요.",
    );
    setSubmitting(false);
  }

  async function copy() {
    if (!createdCode) return;
    try {
      await navigator.clipboard.writeText(createdCode);
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

        {!createdCode ? (
          <>
            <h2 className="text-lg font-bold">초대 코드 생성</h2>
            <p className="mt-1 text-xs text-white/50">
              생성 시 5자리 코드(영문 1자 + 숫자 4자)가 자동 발급됩니다.
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
                  최대 사용 횟수
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400"
                />
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
            <h2 className="text-lg font-bold">코드가 생성되었습니다</h2>
            <p className="mt-1 text-xs text-white/50">
              아래 코드를 복사해 사용자에게 전달하세요.
            </p>

            <div className="mt-5 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-6 text-center">
              <p className="font-mono text-3xl font-extrabold tracking-[0.4em] text-violet-100">
                {createdCode}
              </p>
            </div>

            <button
              type="button"
              onClick={copy}
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
                  복사
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
          삭제된 코드는 복구할 수 없습니다. 정말 삭제하시겠어요?
        </p>
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
          <p className="font-mono text-lg font-bold tracking-widest text-white">
            {target.code}
          </p>
          <p className="mt-1 text-[11px] text-white/50">
            {ROLE_LABEL[target.role]} · 사용 {target.used_count}/
            {target.max_uses == null ? "∞" : target.max_uses}
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
            disabled={deleting}
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
