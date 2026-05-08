"use client";

// 관리자 — D-Day 이벤트 관리
//   · 목록: 활성/비활성 토글, 수정, 삭제
//   · 추가/수정 모달: 제목, 날짜(달력), 설명, 활성 여부, 순서

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  X,
} from "lucide-react";
import { useSupabaseUser } from "@/lib/supabase-profile";
import {
  type DdayEvent,
  type DdayEventInput,
  listAllDdayEvents,
  createDdayEvent,
  updateDdayEvent,
  deleteDdayEvent,
  toggleDdayEventActive,
} from "@/lib/dday-events";
import { cn } from "@/lib/utils";

// ── 유틸 ──────────────────────────────────────────────────
function formatLongDate(yyyymmdd: string): string {
  // target_date 는 'YYYY-MM-DD' 형태의 DATE 문자열
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  if (!y || !m || !d) return yyyymmdd;
  const date = new Date(y, m - 1, d);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${y}년 ${m}월 ${d}일 (${weekday})`;
}

function diffInDays(targetYmd: string): number {
  const [y, m, d] = targetYmd.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const ms = 1000 * 60 * 60 * 24;
  const t = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((t - b) / ms);
}

function ddayLabel(yyyymmdd: string): string {
  const n = diffInDays(yyyymmdd);
  if (n > 0) return `D-${n}`;
  if (n === 0) return "D-DAY";
  return `D+${Math.abs(n)}`;
}

// ── 메인 페이지 ────────────────────────────────────────────
export default function AdminDdayPage() {
  const { user } = useSupabaseUser();
  const [events, setEvents] = useState<DdayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null); // id or "new"
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const list = await listAllDdayEvents();
    setEvents(list);
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const editingEvent = useMemo(() => {
    if (editingId === null) return null;
    if (editingId === "new") return null;
    return events.find((e) => e.id === editingId) ?? null;
  }, [editingId, events]);

  async function handleToggle(e: DdayEvent) {
    setBusy(true);
    const { error } = await toggleDdayEventActive(e.id, !e.is_active);
    if (error) alert(`활성 토글 실패: ${error}`);
    await reload();
    setBusy(false);
  }

  async function handleDelete(e: DdayEvent) {
    if (!confirm(`"${e.title}" 이벤트를 삭제할까요?`)) return;
    setBusy(true);
    const { error } = await deleteDdayEvent(e.id);
    if (error) alert(`삭제 실패: ${error}`);
    await reload();
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <CalendarDays className="h-5 w-5 text-violet-400" />
            D-Day관리
          </h1>
          <p className="mt-1 text-xs text-white/50">
            대시보드 D-Day 카드에 표시될 이벤트를 관리합니다.
          </p>
        </div>
        <button
          onClick={() => setEditingId("new")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          새 이벤트
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
          <CalendarDays className="mx-auto mb-3 h-8 w-8 text-white/30" />
          <p className="text-sm text-white/60">아직 등록된 D-Day 이벤트가 없습니다.</p>
          <button
            onClick={() => setEditingId("new")}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
          >
            <Plus className="h-3.5 w-3.5" />첫 이벤트 만들기
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <DdayRow
              key={e.id}
              event={e}
              busy={busy}
              onEdit={() => setEditingId(e.id)}
              onToggle={() => handleToggle(e)}
              onDelete={() => handleDelete(e)}
            />
          ))}
        </ul>
      )}

      {/* 추가/수정 모달 */}
      <AnimatePresence>
        {editingId !== null && user && (
          <DdayEditor
            initial={editingEvent}
            authorId={user.id}
            existingMaxOrder={events.reduce(
              (m, e) => Math.max(m, e.order_index),
              -1,
            )}
            onClose={() => setEditingId(null)}
            onSaved={async () => {
              await reload();
              setEditingId(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 목록 행 ────────────────────────────────────────────────
function DdayRow({
  event,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  event: DdayEvent;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const dday = ddayLabel(event.target_date);
  const n = diffInDays(event.target_date);
  const past = n < 0;

  return (
    <li className="flex items-stretch gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
      {/* D-Day 뱃지 */}
      <div
        className={cn(
          "grid h-20 w-24 shrink-0 place-items-center rounded-xl text-center",
          past
            ? "bg-white/[0.04] text-white/50"
            : "bg-gradient-to-br from-violet-600/30 to-cyan-500/20 text-white ring-1 ring-violet-400/30",
        )}
      >
        <div className="text-xl font-extrabold tabular-nums tracking-tight">
          {dday}
        </div>
      </div>

      {/* 정보 */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold text-white">{event.title}</h3>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                event.is_active
                  ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
                  : "bg-gray-500/15 text-gray-400 ring-1 ring-gray-500/30",
              )}
            >
              {event.is_active ? "활성" : "비활성"}
            </span>
            <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold text-white/60">
              #{event.order_index}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-white/55">
            {formatLongDate(event.target_date)}
          </p>
          {event.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-white/45">
              {event.description}
            </p>
          )}
        </div>
      </div>

      {/* 액션 */}
      <div className="flex shrink-0 flex-col items-end justify-center gap-1">
        <div className="flex gap-1">
          <button
            onClick={onToggle}
            disabled={busy}
            className="rounded-md p-1.5 text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            title={event.is_active ? "비활성화" : "활성화"}
          >
            {event.is_active ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={onEdit}
            disabled={busy}
            className="rounded-md p-1.5 text-violet-300 transition hover:bg-violet-500/15 disabled:opacity-50"
            title="수정"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="rounded-md p-1.5 text-rose-300 transition hover:bg-rose-500/15 disabled:opacity-50"
            title="삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

// ── 추가/수정 모달 ─────────────────────────────────────────
function DdayEditor({
  initial,
  authorId,
  existingMaxOrder,
  onClose,
  onSaved,
}: {
  initial: DdayEvent | null;
  authorId: string;
  existingMaxOrder: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isNew = !initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [targetDate, setTargetDate] = useState(initial?.target_date ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [orderIndex, setOrderIndex] = useState(
    initial?.order_index ?? existingMaxOrder + 1,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) {
      setError("제목은 필수입니다.");
      return;
    }
    if (!targetDate) {
      setError("날짜는 필수입니다.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload: DdayEventInput = {
      title: title.trim(),
      target_date: targetDate,
      description: description.trim() || null,
      is_active: isActive,
      order_index: orderIndex,
    };

    if (isNew) {
      const { error: e } = await createDdayEvent(payload, authorId);
      if (e) {
        setError(`생성 실패: ${e}`);
        setSaving(false);
        return;
      }
    } else {
      const { error: e } = await updateDdayEvent(initial!.id, payload);
      if (e) {
        setError(`수정 실패: ${e}`);
        setSaving(false);
        return;
      }
    }
    await onSaved();
    setSaving(false);
  }

  const previewDday = targetDate ? ddayLabel(targetDate) : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-x-2 top-1/2 z-50 mx-auto max-h-[92vh] w-auto max-w-xl -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-[#13132a] p-5 shadow-2xl md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {isNew ? "새 D-Day 이벤트" : "D-Day 이벤트 수정"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 미리보기 */}
        {previewDday && (
          <div className="mb-5 rounded-xl border border-white/10 bg-gradient-to-br from-violet-600/20 to-cyan-500/15 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
              미리보기
            </div>
            <div className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-white">
              {previewDday}
            </div>
            <div className="mt-1 text-sm font-semibold text-white/85">
              {title || "(제목)"}
            </div>
            <div className="text-[11px] text-white/50">
              {formatLongDate(targetDate)}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="제목 (필수)">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="예: 기말고사"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500/50 focus:outline-none"
            />
          </Field>

          <Field label="날짜 (필수)">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
            />
          </Field>

          <Field label="설명 (선택)" full>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="이벤트에 대한 간단한 설명"
              className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500/50 focus:outline-none"
            />
          </Field>

          <Field label="순서 (낮을수록 먼저)">
            <input
              type="number"
              value={orderIndex}
              onChange={(e) => setOrderIndex(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
            />
          </Field>

          <Field label="활성 상태">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-violet-500"
              />
              <span className="text-sm text-white/80">
                {isActive ? "활성 — 대시보드에 표시됨" : "비활성 — 숨김"}
              </span>
            </label>
          </Field>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isNew ? "만들기" : "저장"}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-semibold text-white/60">
        {label}
      </label>
      {children}
    </div>
  );
}
