"use client";

// 챌린지 관리 — 전체 챌린지 목록, 삭제(연관 데이터 포함), 페이지네이션.
// admin/posts/page.tsx 구조를 그대로 따라가서 톤·디자인 일관성 유지.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flame,
  Loader2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { deleteChallenge } from "@/lib/challenge";
import { cn } from "@/lib/utils";

type AdminChallenge = {
  id: string;
  title: string;
  emoji: string | null;
  is_official: boolean;
  is_public: boolean;
  is_active: boolean;
  view_count: number;
  participant_count: number;
  created_at: string;
  creator_nickname: string | null;
};

const PER_PAGE = 20;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function statusLabel(c: AdminChallenge): string {
  const parts: string[] = [];
  if (!c.is_active) parts.push("비활성");
  if (!c.is_public) parts.push("비공개");
  if (c.is_official) parts.push("공식");
  return parts.length === 0 ? "공개" : parts.join(" · ");
}

export default function AdminChallengesPage() {
  const [page, setPage] = useState(1);
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminChallenge | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null,
  );

  function showToast(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 2400);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const from = (page - 1) * PER_PAGE;
      const to = from + PER_PAGE - 1;

      const { data, count, error } = await supabase
        .from("challenges")
        .select(
          "id, title, emoji, is_official, is_public, is_active, view_count, created_at, creator:profiles!creator_id(nickname)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (!active) return;

      if (error) {
        console.error("[admin/challenges] 조회 실패", error);
        setChallenges([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      type RawRow = {
        id: string;
        title: string;
        emoji: string | null;
        is_official: boolean;
        is_public: boolean;
        is_active: boolean;
        view_count: number | null;
        created_at: string;
        creator: { nickname: string | null } | null;
      };
      const raw = (data ?? []) as unknown as RawRow[];

      // 참여자 수 — 별도 head:true count 조회로 N+1 (작은 N=20 이라 OK)
      const counts = await Promise.all(
        raw.map(async (r) => {
          const { count: pc, error: pe } = await supabase
            .from("challenge_participants")
            .select("user_id", { count: "exact", head: true })
            .eq("challenge_id", r.id)
            .eq("is_active", true);
          if (pe) console.warn("[admin/challenges] participant count 실패", pe);
          return pc ?? 0;
        }),
      );

      if (!active) return;

      setChallenges(
        raw.map((r, i) => ({
          id: r.id,
          title: r.title,
          emoji: r.emoji,
          is_official: r.is_official,
          is_public: r.is_public,
          is_active: r.is_active,
          view_count: r.view_count ?? 0,
          participant_count: counts[i],
          created_at: r.created_at,
          creator_nickname: r.creator?.nickname ?? null,
        })),
      );
      setTotal(count ?? 0);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [page]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PER_PAGE)),
    [total],
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteChallenge(deleteTarget.id);
    setDeleting(false);
    if (error) {
      console.error("[admin/challenges] 삭제 실패", error);
      showToast("err", "삭제에 실패했습니다");
      return;
    }
    setChallenges((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setTotal((t) => Math.max(0, t - 1));
    setDeleteTarget(null);
    showToast("ok", "챌린지가 삭제되었습니다");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold md:text-2xl">
          <Flame className="h-5 w-5 text-orange-400" />
          챌린지 관리
        </h1>
        <p className="mt-1 text-xs text-white/50">
          전체 챌린지를 확인하고 부적절한 챌린지를 삭제할 수 있습니다. 삭제 시
          관련 인증글, 댓글, 참여 기록이 모두 깨끗이 정리됩니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-white/40">
          총 <strong className="text-white">{total.toLocaleString()}</strong>개
        </span>
      </div>

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
        ) : challenges.length === 0 ? (
          <div className="py-20 text-center text-xs text-white/40">
            등록된 챌린지가 없습니다.
          </div>
        ) : (
          <>
            {/* 데스크톱 테이블 */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.05] text-left text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    <th className="px-5 py-3">제목</th>
                    <th className="px-5 py-3">생성자</th>
                    <th className="px-5 py-3 text-right">참여자</th>
                    <th className="px-5 py-3 text-right">조회</th>
                    <th className="px-5 py-3">상태</th>
                    <th className="px-5 py-3">생성일</th>
                    <th className="px-5 py-3 text-right">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-white/[0.04] last:border-b-0"
                    >
                      <td className="max-w-md px-5 py-3">
                        <Link
                          href={`/board/challenge/${c.id}`}
                          className="block truncate font-medium text-white transition hover:text-violet-300"
                        >
                          <span className="mr-1.5">{c.emoji ?? "🔥"}</span>
                          {c.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-xs text-white/70">
                        {c.creator_nickname ?? "(탈퇴회원)"}
                      </td>
                      <td className="px-5 py-3 text-right text-xs tabular-nums text-white/70">
                        {c.participant_count.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-xs tabular-nums text-white/60">
                        {c.view_count.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-xs text-white/60">
                        {statusLabel(c)}
                      </td>
                      <td className="px-5 py-3 text-xs tabular-nums text-white/50">
                        {formatDate(c.created_at)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(c)}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 모바일 카드 */}
            <ul className="divide-y divide-white/[0.04] md:hidden">
              {challenges.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <Link
                    href={`/board/challenge/${c.id}`}
                    className="block text-sm font-semibold text-white transition hover:text-violet-300"
                  >
                    <span className="mr-1.5">{c.emoji ?? "🔥"}</span>
                    {c.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/50">
                    <span className="text-white/70">
                      {c.creator_nickname ?? "(탈퇴회원)"}
                    </span>
                    <span>·</span>
                    <span>{statusLabel(c)}</span>
                    <span>·</span>
                    <span className="tabular-nums">{formatDate(c.created_at)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[11px] text-white/50">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {c.participant_count.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {c.view_count.toLocaleString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(c)}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </motion.div>

      {/* 페이지네이션 */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>
            {((page - 1) * PER_PAGE + 1).toLocaleString()}–
            {Math.min(page * PER_PAGE, total).toLocaleString()} / 총{" "}
            {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
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
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-white/70 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      <AnimatePresence>
        {deleteTarget && (
          <ConfirmModal
            target={deleteTarget}
            deleting={deleting}
            onConfirm={confirmDelete}
            onClose={() => !deleting && setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* 토스트 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none fixed inset-x-0 bottom-10 z-[110] flex justify-center px-4"
          >
            <div
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-semibold shadow-xl backdrop-blur-md",
                toast.kind === "ok"
                  ? "border-emerald-400/30 bg-emerald-600/95 text-white"
                  : "border-rose-400/30 bg-rose-600/95 text-white",
              )}
            >
              {toast.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConfirmModal({
  target,
  deleting,
  onConfirm,
  onClose,
}: {
  target: AdminChallenge;
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
        <h2 className="text-lg font-bold">챌린지 삭제</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/60">
          이 챌린지를 삭제하면 관련 인증글, 댓글, 참여 기록이 모두 삭제됩니다.
          정말 삭제하시겠습니까?
        </p>
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs">
          <p className="line-clamp-2 font-semibold text-white">
            <span className="mr-1.5">{target.emoji ?? "🔥"}</span>
            {target.title}
          </p>
          <p className="mt-1 text-white/50">
            {target.creator_nickname ?? "(탈퇴회원)"} · 참여{" "}
            {target.participant_count.toLocaleString()}명
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
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
