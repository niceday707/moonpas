"use client";

// 관리자 — 대시보드 배너 관리
//   · 목록: 활성/비활성 토글, 순서 ↑↓, 수정, 삭제
//   · 추가/수정 모달: 제목/설명/링크/이미지 업로드/배경색/순서 + 라이브 미리보기

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ImageIcon,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Loader2,
  X,
  Upload,
  Link as LinkIcon,
} from "lucide-react";
import { useSupabaseUser } from "@/lib/supabase-profile";
import {
  type Banner,
  type BannerInput,
  listAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerActive,
  swapBannerOrder,
  uploadBannerImage,
} from "@/lib/banners";
import { cn } from "@/lib/utils";

// ── 유틸 ──────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

const DEFAULT_COLORS = [
  "#6C63FF", "#7C3AED", "#3B82F6", "#06B6D4", "#10B981",
  "#F59E0B", "#EF4444", "#EC4899", "#0F0F1A", "#1E293B",
];

// ── 메인 페이지 ────────────────────────────────────────────
export default function AdminBannersPage() {
  const { user } = useSupabaseUser();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null); // id or "new"
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const list = await listAllBanners();
    setBanners(list);
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const editingBanner = useMemo(() => {
    if (editingId === null) return null;
    if (editingId === "new") return null; // new = empty form
    return banners.find((b) => b.id === editingId) ?? null;
  }, [editingId, banners]);

  async function handleToggle(b: Banner) {
    setBusy(true);
    const { error } = await toggleBannerActive(b.id, !b.is_active);
    if (error) alert(`활성 토글 실패: ${error}`);
    await reload();
    setBusy(false);
  }

  async function handleDelete(b: Banner) {
    if (!confirm(`"${b.title}" 배너를 삭제할까요?`)) return;
    setBusy(true);
    const { error } = await deleteBanner(b.id);
    if (error) alert(`삭제 실패: ${error}`);
    await reload();
    setBusy(false);
  }

  async function handleMove(index: number, dir: -1 | 1) {
    const target = banners[index];
    const swap = banners[index + dir];
    if (!target || !swap) return;
    setBusy(true);
    const { error } = await swapBannerOrder(target, swap);
    if (error) alert(`순서 변경 실패: ${error}`);
    await reload();
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <ImageIcon className="h-5 w-5 text-violet-400" />
            배너관리
          </h1>
          <p className="mt-1 text-xs text-white/50">
            대시보드 상단 슬라이더에 표시되는 배너를 관리합니다.
          </p>
        </div>
        <button
          onClick={() => setEditingId("new")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          새 배너
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : banners.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
          <ImageIcon className="mx-auto mb-3 h-8 w-8 text-white/30" />
          <p className="text-sm text-white/60">아직 등록된 배너가 없습니다.</p>
          <button
            onClick={() => setEditingId("new")}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
          >
            <Plus className="h-3.5 w-3.5" />
            첫 배너 만들기
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {banners.map((b, i) => (
            <BannerRow
              key={b.id}
              banner={b}
              isFirst={i === 0}
              isLast={i === banners.length - 1}
              busy={busy}
              onEdit={() => setEditingId(b.id)}
              onToggle={() => handleToggle(b)}
              onDelete={() => handleDelete(b)}
              onMoveUp={() => handleMove(i, -1)}
              onMoveDown={() => handleMove(i, 1)}
            />
          ))}
        </ul>
      )}

      {/* 추가/수정 모달 */}
      <AnimatePresence>
        {editingId !== null && user && (
          <BannerEditor
            initial={editingBanner}
            authorId={user.id}
            existingMaxOrder={banners.reduce(
              (m, b) => Math.max(m, b.order_index),
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
function BannerRow({
  banner,
  isFirst,
  isLast,
  busy,
  onEdit,
  onToggle,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  banner: Banner;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <li className="flex items-stretch gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
      {/* 미니 미리보기 */}
      <div
        className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg"
        style={{
          backgroundColor: banner.background_color,
          ...(banner.image_url
            ? {
                backgroundImage: `url(${banner.image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {}),
        }}
      >
        {banner.image_url && (
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent"
          />
        )}
        <div className="relative z-10 flex h-full items-end p-1.5">
          <span
            className="line-clamp-2 text-[9px] font-bold leading-tight text-white"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
          >
            {banner.title}
          </span>
        </div>
      </div>

      {/* 정보 */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-bold text-white">{banner.title}</h3>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                banner.is_active
                  ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
                  : "bg-gray-500/15 text-gray-400 ring-1 ring-gray-500/30",
              )}
            >
              {banner.is_active ? "활성" : "비활성"}
            </span>
            <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold text-white/60">
              #{banner.order_index}
            </span>
          </div>
          {banner.description && (
            <p className="mt-1 line-clamp-1 text-xs text-white/55">
              {banner.description}
            </p>
          )}
          {banner.link && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-white/40">
              <LinkIcon className="h-2.5 w-2.5" />
              {banner.link}
            </p>
          )}
        </div>
        <p className="text-[10px] text-white/30">{formatDate(banner.created_at)}</p>
      </div>

      {/* 액션 */}
      <div className="flex flex-col items-end justify-between gap-1.5">
        <div className="flex gap-1">
          <button
            onClick={onMoveUp}
            disabled={busy || isFirst}
            className="rounded-md p-1.5 text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            title="위로"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={busy || isLast}
            className="rounded-md p-1.5 text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            title="아래로"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onToggle}
            disabled={busy}
            className="rounded-md p-1.5 text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            title={banner.is_active ? "비활성화" : "활성화"}
          >
            {banner.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
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
function BannerEditor({
  initial,
  authorId,
  existingMaxOrder,
  onClose,
  onSaved,
}: {
  initial: Banner | null;
  authorId: string;
  existingMaxOrder: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isNew = !initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null);
  const [bgColor, setBgColor] = useState(initial?.background_color ?? "#6C63FF");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [orderIndex, setOrderIndex] = useState(
    initial?.order_index ?? existingMaxOrder + 1,
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const url = await uploadBannerImage(file, authorId);
    setUploading(false);
    if (!url) {
      setError(
        "이미지 업로드 실패 — Supabase storage 'banners' 버킷과 RLS 정책이 설정됐는지 확인해주세요.",
      );
      return;
    }
    setImageUrl(url);
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("제목은 필수입니다.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload: BannerInput = {
      title: title.trim(),
      description: description.trim() || null,
      link: link.trim() || null,
      image_url: imageUrl,
      background_color: bgColor,
      is_active: isActive,
      order_index: orderIndex,
    };

    if (isNew) {
      const { error: e } = await createBanner(payload, authorId);
      if (e) {
        setError(`생성 실패: ${e}`);
        setSaving(false);
        return;
      }
    } else {
      const { error: e } = await updateBanner(initial!.id, payload);
      if (e) {
        setError(`수정 실패: ${e}`);
        setSaving(false);
        return;
      }
    }
    await onSaved();
    setSaving(false);
  }

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
        className="fixed inset-x-2 top-1/2 z-50 mx-auto max-h-[92vh] w-auto max-w-3xl -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-[#13132a] p-5 shadow-2xl md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {isNew ? "새 배너 만들기" : "배너 수정"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 미리보기 */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-semibold text-white/60">
            미리보기
          </label>
          <div
            className="relative h-[160px] overflow-hidden rounded-xl"
            style={{
              backgroundColor: bgColor,
              ...(imageUrl
                ? {
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : {}),
            }}
          >
            {imageUrl && (
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 100%)",
                }}
              />
            )}
            <div className="relative z-10 flex h-full w-[78%] flex-col justify-center gap-1.5 px-5">
              <h3
                className="line-clamp-2 text-lg font-extrabold text-white"
                style={{ textShadow: "0 2px 8px rgba(0,0,0,0.35)" }}
              >
                {title || "(제목)"}
              </h3>
              {description && (
                <p
                  className="line-clamp-2 text-xs font-medium text-white/90"
                  style={{ textShadow: "0 1px 6px rgba(0,0,0,0.3)" }}
                >
                  {description}
                </p>
              )}
              {link && (
                <span className="mt-1 inline-flex w-fit items-center rounded-full bg-white px-3 py-1 text-[11px] font-bold text-gray-900">
                  자세히 보기 →
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="제목 (필수)">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="예: 2학기 중간고사 일정 발표"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500/50 focus:outline-none"
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

          <Field label="설명 (선택)" full>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="배너 부제 또는 짧은 설명"
              className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500/50 focus:outline-none"
            />
          </Field>

          <Field label="클릭 시 이동할 URL (선택)" full>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/board/notice/{게시글id}  또는  https://..."
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500/50 focus:outline-none"
            />
          </Field>

          <Field label="배너 이미지 (선택)" full>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.08]">
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "업로드 중…" : imageUrl ? "이미지 교체" : "이미지 선택"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              {imageUrl && (
                <button
                  onClick={() => setImageUrl(null)}
                  className="text-xs text-rose-300 hover:text-rose-200"
                >
                  이미지 제거
                </button>
              )}
              {uploading && <Loader2 className="h-4 w-4 animate-spin text-violet-300" />}
            </div>
            {imageUrl && (
              <p className="mt-1 truncate text-[10px] text-white/40">{imageUrl}</p>
            )}
          </Field>

          <Field label="배경색 (이미지 없을 때 사용)" full>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
              />
              <input
                type="text"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-32 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBgColor(c)}
                    aria-label={c}
                    className="h-7 w-7 rounded-md border border-white/10 transition hover:scale-110"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </Field>

          <Field label="활성 상태" full>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-violet-500"
              />
              <span className="text-sm text-white/80">
                {isActive ? "활성 — 대시보드에 표시됨" : "비활성 — 대시보드에서 숨김"}
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
            disabled={saving || uploading}
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
      <label className="mb-1.5 block text-xs font-semibold text-white/60">{label}</label>
      {children}
    </div>
  );
}
