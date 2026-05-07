"use client";

// 나눔장터 페이지 — 책/물품 나눔 전용
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Gift,
  MessageCircle,
  Plus,
  X,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge, type Role } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { AuthGate } from "@/components/auth/AuthGate";
import { CommentSection } from "@/components/comments/CommentSection";
import { countCommentsForTarget, subscribe } from "@/lib/mock-data";

type ShareStatus = "나눔중" | "나눔완료";
type ShareItem = {
  id: number;
  name: string;
  description: string;
  quantity: string;
  status: ShareStatus;
  author: string;
  role: Role;
};

const INITIAL_SHARE: ShareItem[] = [
  { id: 1, name: "수학 문제집 (미적분)", description: "거의 새 책, 필기 없음", quantity: "1권", status: "나눔중", author: "김민수", role: "student" },
  { id: 2, name: "국어 프린트 모음", description: "3학년 1학기 전범위", quantity: "1세트", status: "나눔중", author: "박선생", role: "teacher" },
  { id: 3, name: "작년 모의고사 기출", description: "2025년 6·9월 모의고사", quantity: "2부", status: "나눔완료", author: "정예은", role: "student" },
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

export default function MarketPage() {
  return (
    <AuthGate
      title="나눔장터는 로그인이 필요합니다"
      description="나눔 등록·신청을 위해 학교 계정으로 로그인해 주세요."
    >
      <MarketPageInner />
    </AuthGate>
  );
}

function MarketPageInner() {
  const [shareItems, setShareItems] = useState<ShareItem[]>(INITIAL_SHARE);
  const [showForm, setShowForm] = useState(false);
  const [shareForm, setShareForm] = useState({ name: "", description: "", quantity: "" });

  const submitShare = () => {
    if (!shareForm.name.trim()) return;
    setShareItems((prev) => [
      {
        id: Date.now(),
        name: shareForm.name,
        description: shareForm.description,
        quantity: shareForm.quantity || "1개",
        status: "나눔중",
        author: "나",
        role: "student",
      },
      ...prev,
    ]);
    setShareForm({ name: "", description: "", quantity: "" });
    setShowForm(false);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* 헤더 */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-success/15 text-success">
              <Gift className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              <span className="text-gradient">나눔장터</span>
            </h1>
          </div>
          <p className="text-sm text-foreground/60">
            필요 없는 책·물품을 친구·후배와 나눠요.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 inline-flex h-10 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] px-4 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124,58,237,0.4)] transition-opacity hover:opacity-90"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "닫기" : "나눔 등록"}
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
                <p className="text-sm font-bold text-accent">나눔 등록</p>
                <input
                  value={shareForm.name}
                  onChange={(e) => setShareForm((v) => ({ ...v, name: e.target.value }))}
                  placeholder="물품명"
                  className="w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-accent/50"
                />
                <input
                  value={shareForm.description}
                  onChange={(e) => setShareForm((v) => ({ ...v, description: e.target.value }))}
                  placeholder="설명 (상태, 특징 등)"
                  className="w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-accent/50"
                />
                <input
                  value={shareForm.quantity}
                  onChange={(e) => setShareForm((v) => ({ ...v, quantity: e.target.value }))}
                  placeholder="수량 (예: 1권)"
                  className="w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-accent/50"
                />
                <button
                  onClick={submitShare}
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
        {shareItems.map((item) => (
          <motion.li key={item.id} variants={itemVariants}>
            <ShareCard item={item} />
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}

// ─── 나눔 카드 ─────────────────────────────────────────────

function ShareCard({ item }: { item: ShareItem }) {
  const targetId = `share:${item.id}`;
  return (
    <GlassCard
      interactive={false}
      className={cn(
        "transition-opacity",
        item.status === "나눔완료" && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                "font-semibold",
                item.status === "나눔완료" && "line-through text-foreground/50",
              )}
            >
              {item.name}
            </p>
            {item.status === "나눔완료" && (
              <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] text-foreground/50">
                나눔완료
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-foreground/60">{item.description}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge role={item.role} />
            <span className="text-xs text-foreground/50">
              {item.author} · {item.quantity}
            </span>
          </div>
        </div>
        {item.status === "나눔중" && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success ring-1 ring-success/30">
            나눔중
          </span>
        )}
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
