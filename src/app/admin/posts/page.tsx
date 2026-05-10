"use client";

// 게시글 관리 — 전체 게시글 목록, 게시판 필터, 삭제, 페이지네이션
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Loader2,
  Trash2,
  Eye,
  Heart,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BOARD_LABEL, postDetailHref, type BoardType } from "@/lib/board";
import { cn } from "@/lib/utils";

type AdminPost = {
  id: string;
  title: string;
  board_type: BoardType;
  created_at: string;
  view_count: number;
  like_count: number;
  author_nickname: string | null;
};

const PER_PAGE = 20;
const BOARD_FILTER_OPTIONS: Array<{ value: "" | BoardType; label: string }> = [
  { value: "", label: "전체 게시판" },
  ...(Object.entries(BOARD_LABEL) as Array<[BoardType, string]>).map(
    ([value, label]) => ({ value, label }),
  ),
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default function AdminPostsPage() {
  const [boardFilter, setBoardFilter] = useState<"" | BoardType>("");
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [boardFilter]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const from = (page - 1) * PER_PAGE;
      const to = from + PER_PAGE - 1;

      let query = supabase
        .from("posts")
        .select(
          "id, title, board_type, created_at, view_count, like_count, author:profiles!author_id(nickname)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (boardFilter) {
        query = query.eq("board_type", boardFilter);
      }

      const { data, count, error } = await query;
      if (!active) return;

      if (error) {
        console.error("[admin/posts] 조회 실패", error);
        setPosts([]);
        setTotal(0);
      } else {
        type RawPost = {
          id: string;
          title: string;
          board_type: BoardType;
          created_at: string;
          view_count: number;
          like_count: number;
          author: { nickname: string } | null;
        };
        const raw = (data ?? []) as unknown as RawPost[];
        setPosts(
          raw.map((p) => ({
            id: p.id,
            title: p.title,
            board_type: p.board_type,
            created_at: p.created_at,
            view_count: p.view_count ?? 0,
            like_count: p.like_count ?? 0,
            author_nickname: p.author?.nickname ?? null,
          })),
        );
        setTotal(count ?? 0);
      }
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [boardFilter, page]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PER_PAGE)),
    [total],
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      console.error("[admin/posts] 삭제 실패", error);
      window.alert("삭제에 실패했습니다.\n" + error.message);
    } else {
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
    }
    setDeleting(false);
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold md:text-2xl">
          <FileText className="h-5 w-5 text-cyan-400" />
          게시글 관리
        </h1>
        <p className="mt-1 text-xs text-white/50">
          전체 게시글을 확인하고 부적절한 글을 삭제할 수 있습니다.
        </p>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={boardFilter}
          onChange={(e) => setBoardFilter(e.target.value as "" | BoardType)}
          className="rounded-xl border border-white/10 bg-[#1a1a30] px-3 py-2 text-sm text-white outline-none focus:border-violet-400"
        >
          {BOARD_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-white/40">
          총 <strong className="text-white">{total.toLocaleString()}</strong>개
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
        ) : posts.length === 0 ? (
          <div className="py-20 text-center text-xs text-white/40">
            게시글이 없습니다.
          </div>
        ) : (
          <>
            {/* 데스크톱 테이블 */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.05] text-left text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    <th className="px-5 py-3">제목</th>
                    <th className="px-5 py-3">작성자</th>
                    <th className="px-5 py-3">게시판</th>
                    <th className="px-5 py-3">날짜</th>
                    <th className="px-5 py-3 text-right">조회</th>
                    <th className="px-5 py-3 text-right">좋아요</th>
                    <th className="px-5 py-3 text-right">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-white/[0.04] last:border-b-0"
                    >
                      <td className="max-w-md px-5 py-3">
                        <Link
                          href={postDetailHref(p.board_type, p.id)}
                          className="block truncate font-medium text-white transition hover:text-violet-300"
                        >
                          {p.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-xs text-white/70">
                        {p.author_nickname ?? "(알수없음)"}
                      </td>
                      <td className="px-5 py-3 text-xs text-white/60">
                        {BOARD_LABEL[p.board_type] ?? p.board_type}
                      </td>
                      <td className="px-5 py-3 text-xs tabular-nums text-white/50">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="px-5 py-3 text-right text-xs tabular-nums text-white/60">
                        {p.view_count.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-xs tabular-nums text-rose-300">
                        {p.like_count.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
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
              {posts.map((p) => (
                <li key={p.id} className="px-4 py-3">
                  <Link
                    href={postDetailHref(p.board_type, p.id)}
                    className="block text-sm font-semibold text-white transition hover:text-violet-300"
                  >
                    {p.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/50">
                    <span className="text-white/70">
                      {p.author_nickname ?? "(알수없음)"}
                    </span>
                    <span>·</span>
                    <span>{BOARD_LABEL[p.board_type] ?? p.board_type}</span>
                    <span>·</span>
                    <span className="tabular-nums">
                      {formatDate(p.created_at)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[11px] text-white/50">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {p.view_count.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1 text-rose-300">
                        <Heart className="h-3 w-3" />
                        {p.like_count.toLocaleString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
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
    </div>
  );
}

function ConfirmModal({
  target,
  deleting,
  onConfirm,
  onClose,
}: {
  target: AdminPost;
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
        <h2 className="text-lg font-bold">게시글 삭제</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/60">
          이 작업은 되돌릴 수 없습니다. 정말 삭제하시겠어요?
        </p>
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs">
          <p className="line-clamp-2 font-semibold text-white">{target.title}</p>
          <p className="mt-1 text-white/50">
            {target.author_nickname ?? "(알수없음)"} ·{" "}
            {BOARD_LABEL[target.board_type] ?? target.board_type}
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
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {deleting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
