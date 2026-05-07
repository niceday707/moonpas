"use client";

// 분실물센터 페이지 — 잃어버린 물건 찾기 전용
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  Circle,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  X,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";
import { AuthGate } from "@/components/auth/AuthGate";
import { CommentSection } from "@/components/comments/CommentSection";
import { countCommentsForTarget, subscribe } from "@/lib/mock-data";

type LostStatus = "찾는중" | "찾았어요";
type LostItem = {
  id: number;
  name: string;
  location: string;
  date: string;
  status: LostStatus;
};

const INITIAL_LOST: LostItem[] = [
  { id: 1, name: "에어팟 케이스 (흰색)", location: "3층 복도", date: "오늘", status: "찾는중" },
  { id: 2, name: "체육복 상의 (L사이즈)", location: "체육관", date: "어제", status: "찾는중" },
  { id: 3, name: "USB (검정 삼성)", location: "컴퓨터실", date: "3일 전", status: "찾았어요" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 24 },
  },
};

export default function LostPage() {
  return (
    <AuthGate
      title="분실물센터는 로그인이 필요합니다"
      description="분실물 등록을 위해 학교 계정으로 로그인해 주세요."
    >
      <LostPageInner />
    </AuthGate>
  );
}

function LostPageInner() {
  const [lostItems, setLostItems] = useState<LostItem[]>(INITIAL_LOST);
  const [showForm, setShowForm] = useState(false);
  const [lostForm, setLostForm] = useState({ name: "", location: "", note: "", contact: "" });

  const toggleLostStatus = (id: number) => {
    setLostItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: item.status === "찾는중" ? "찾았어요" : "찾는중" }
          : item,
      ),
    );
  };

  const submitLost = () => {
    if (!lostForm.name.trim() || !lostForm.location.trim()) return;
    setLostItems((prev) => [
      { id: Date.now(), name: lostForm.name, location: lostForm.location, date: "방금", status: "찾는중" },
      ...prev,
    ]);
    setLostForm({ name: "", location: "", note: "", contact: "" });
    setShowForm(false);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* 헤더 */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-warning/15 text-warning">
              <Package className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              <span className="text-gradient">분실물센터</span>
            </h1>
          </div>
          <p className="text-sm text-foreground/60">
            잃어버린 물건을 등록하고, 발견된 물건을 찾아가요.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 inline-flex h-10 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] px-4 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124,58,237,0.4)] transition-opacity hover:opacity-90"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "닫기" : "분실물 등록"}
        </motion.button>
      </div>

      {/* 글쓰기 폼 */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="mb-4 overflow-hidden"
          >
            <GlassCard interactive={false} className="ring-1 ring-accent/20">
              <div className="flex flex-col gap-3">
                <p className="text-sm font-bold text-accent">분실물 등록</p>
                <input
                  value={lostForm.name}
                  onChange={(e) => setLostForm((v) => ({ ...v, name: e.target.value }))}
                  placeholder="물품명 (예: 에어팟 케이스)"
                  className="w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-accent/50"
                />
                <input
                  value={lostForm.location}
                  onChange={(e) => setLostForm((v) => ({ ...v, location: e.target.value }))}
                  placeholder="습득 / 분실 장소"
                  className="w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-accent/50"
                />
                <input
                  value={lostForm.note}
                  onChange={(e) => setLostForm((v) => ({ ...v, note: e.target.value }))}
                  placeholder="사진 설명 또는 특징"
                  className="w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-accent/50"
                />
                <input
                  value={lostForm.contact}
                  onChange={(e) => setLostForm((v) => ({ ...v, contact: e.target.value }))}
                  placeholder="연락처 (선택)"
                  className="w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-accent/50"
                />
                <button
                  onClick={submitLost}
                  className="mt-1 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  등록하기
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 목록 */}
      <motion.ul
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-3"
      >
        {lostItems.map((item) => (
          <motion.li key={item.id} variants={itemVariants}>
            <LostCard item={item} onToggleStatus={() => toggleLostStatus(item.id)} />
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}

// ─── 분실물 카드 ──────────────────────────────────────────────

function LostCard({
  item,
  onToggleStatus,
}: {
  item: LostItem;
  onToggleStatus: () => void;
}) {
  const targetId = `lost:${item.id}`;
  return (
    <GlassCard
      interactive={false}
      className={cn(
        "transition-opacity",
        item.status === "찾았어요" && "opacity-55",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-semibold",
              item.status === "찾았어요" && "line-through text-foreground/50",
            )}
          >
            {item.name}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/55">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {item.location}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {item.date}
            </span>
          </div>
        </div>
        <button
          onClick={onToggleStatus}
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
            item.status === "찾았어요"
              ? "bg-success/15 text-success ring-1 ring-success/30"
              : "bg-warning/10 text-warning ring-1 ring-warning/25 hover:bg-warning/20",
          )}
        >
          {item.status === "찾았어요" ? (
            <CheckCircle className="h-3.5 w-3.5" />
          ) : (
            <Circle className="h-3.5 w-3.5" />
          )}
          {item.status}
        </button>
      </div>
      <CardCommentToggle targetId={targetId} />
    </GlassCard>
  );
}

// ─── 댓글 토글 ─────────────────────────────────────────────

function CardCommentToggle({ targetId }: { targetId: string }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(() => countCommentsForTarget(targetId));

  useEffect(() => {
    const refresh = () => setCount(countCommentsForTarget(targetId));
    refresh();
    return subscribe(refresh);
  }, [targetId]);

  return (
    <div className="mt-3 border-t border-foreground/10 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-semibold text-foreground/55 transition-colors hover:bg-foreground/5 hover:text-foreground/80"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        댓글 {count}개
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <CommentSection targetId={targetId} bordered={false} showHeader={false} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
