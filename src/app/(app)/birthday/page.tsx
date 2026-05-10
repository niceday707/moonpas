"use client";

// 오늘의 생일 페이지 — 전날·당일·다음날 생일자에게 축하 메시지를 보낼 수 있다.
//   · 상단: 3일간 생일자 카드 + 받은 메시지 목록
//   · 하단: 이달의 생일 달력 리스트
//   · 본인 생일 미등록이면 상단에 안내 배너
//   · admin 이면 맨 아래 birthday_registry 일괄 등록/관리 섹션
//
// 생일자 출처:
//   · profiles  — 실제 가입한 유저 (축하 메시지 receiver_id 가능)
//   · birthday_registry — 관리자 등록 (학년/반/이름). 메시지 송신은 불가.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Cake, Loader2, Plus, Send, Trash2, X as XIcon } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { supabase } from "@/lib/supabase";
import { useSupabaseProfile } from "@/lib/supabase-profile";
import {
  fetchBirthdaysOfMonth,
  fetchBirthdaysOnDays,
  registryDisplayName,
  type BirthdayPerson,
  type BirthdayRegistryRow,
} from "@/lib/birthdays";
import type { Role } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type BirthdayMessage = {
  id: number;
  sender_id: string;
  message: string;
  created_at: string;
  sender: {
    nickname: string | null;
    role: Role | null;
    avatar_url: string | null;
  } | null;
};

// KST 기준 오늘 날짜
function getKstToday(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
}

function shiftDay(month: number, day: number, delta: number): { month: number; day: number } {
  // 현재 연도(KST) 기준으로 ±delta 일 계산. 월 경계만 고려하면 충분.
  const today = getKstToday();
  const d = new Date(today.getFullYear(), month - 1, day);
  d.setDate(d.getDate() + delta);
  return { month: d.getMonth() + 1, day: d.getDate() };
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = 60 * 1000;
  if (diff < 5 * min) return "방금 전";
  if (diff < 60 * min) return `${Math.floor(diff / min)}분 전`;
  if (diff < 24 * 60 * min) return `${Math.floor(diff / (60 * min))}시간 전`;
  if (diff < 7 * 24 * 60 * min)
    return `${Math.floor(diff / (24 * 60 * min))}일 전`;
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function BirthdayPage() {
  return (
    <AuthGate
      title="오늘의 생일에 로그인이 필요합니다"
      description="문태 친구들의 생일을 함께 축하해보세요!"
    >
      <BirthdayShell />
    </AuthGate>
  );
}

function BirthdayShell() {
  const { user, profile, loading: profileLoading } = useSupabaseProfile();
  const today = getKstToday();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const [todayPeople, setTodayPeople] = useState<BirthdayPerson[]>([]);
  const [yesterdayPeople, setYesterdayPeople] = useState<BirthdayPerson[]>([]);
  const [tomorrowPeople, setTomorrowPeople] = useState<BirthdayPerson[]>([]);
  const [monthPeople, setMonthPeople] = useState<BirthdayPerson[]>([]);
  const [messagesByReceiver, setMessagesByReceiver] = useState<Record<string, BirthdayMessage[]>>({});
  const [loading, setLoading] = useState(true);
  const [composeFor, setComposeFor] = useState<BirthdayPerson | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);

    const yesterday = shiftDay(month, day, -1);
    const tomorrow = shiftDay(month, day, 1);

    const days = [
      { month: yesterday.month, day: yesterday.day },
      { month, day },
      { month: tomorrow.month, day: tomorrow.day },
    ];

    // 3일치 통합 조회 — profiles + registry
    const [rangeRows, monthRows] = await Promise.all([
      fetchBirthdaysOnDays(days),
      fetchBirthdaysOfMonth(month),
    ]);

    const ofDay = (m: number, d: number) =>
      rangeRows
        .filter((r) => r.birth_month === m && r.birth_day === d)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

    setYesterdayPeople(ofDay(yesterday.month, yesterday.day));
    setTodayPeople(ofDay(month, day));
    setTomorrowPeople(ofDay(tomorrow.month, tomorrow.day));
    setMonthPeople(monthRows);

    // 받은 메시지 — profile-source 인 사람만 receiver_id 로 조회 가능
    const receiverIds = rangeRows
      .filter((r) => r.source === "profile")
      .map((r) => r.id);
    if (receiverIds.length > 0) {
      const { data: msgRows, error: msgErr } = await supabase
        .from("birthday_messages")
        .select(
          "id, sender_id, receiver_id, message, created_at, sender:profiles!sender_id ( nickname, role, avatar_url )",
        )
        .in("receiver_id", receiverIds)
        .order("created_at", { ascending: false })
        .limit(500);

      if (msgErr) {
        console.error("[birthday] 메시지 조회 실패", msgErr);
      }

      type RawMsg = {
        id: number;
        sender_id: string;
        receiver_id: string;
        message: string;
        created_at: string;
        sender:
          | { nickname: string | null; role: Role | null; avatar_url: string | null }
          | Array<{ nickname: string | null; role: Role | null; avatar_url: string | null }>
          | null;
      };

      const grouped: Record<string, BirthdayMessage[]> = {};
      for (const m of ((msgRows ?? []) as unknown as RawMsg[])) {
        const key = m.receiver_id;
        if (!grouped[key]) grouped[key] = [];
        if (grouped[key].length < 10) {
          const senderRaw = m.sender;
          const sender = Array.isArray(senderRaw)
            ? (senderRaw[0] ?? null)
            : senderRaw;
          grouped[key].push({
            id: m.id,
            sender_id: m.sender_id,
            message: m.message,
            created_at: m.created_at,
            sender,
          });
        }
      }
      setMessagesByReceiver(grouped);
    } else {
      setMessagesByReceiver({});
    }

    setLoading(false);
  }, [month, day]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const needsBirthdaySetup =
    !profileLoading &&
    !!profile &&
    (profile.birth_month === null || profile.birth_day === null);

  const isAdmin = profile?.role === "admin";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl bg-gradient-to-br from-pink-500 via-rose-400 to-yellow-400 p-6 text-white shadow-[0_8px_28px_rgba(244,114,182,0.35)] md:p-8"
      >
        <div className="flex items-center gap-2 text-sm font-bold opacity-90">
          <Cake className="h-4 w-4" />
          오늘의 생일
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">
          {month}월 {day}일, 함께 축하해요 🎉
        </h1>
        <p className="mt-1 text-sm opacity-90">
          전날·당일·다음날 생일자에게 따뜻한 한 줄을 남겨보세요.
        </p>
      </motion.header>

      {needsBirthdaySetup && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3 dark:border-pink-500/30 dark:bg-pink-500/10"
        >
          <p className="text-sm font-semibold text-pink-700 dark:text-pink-200">
            🎂 아직 생일이 등록되지 않았어요! 프로필에서 등록해보세요
          </p>
          <Link
            href="/profile/setup"
            className="shrink-0 rounded-full bg-pink-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-pink-700"
          >
            등록하러 가기
          </Link>
        </motion.div>
      )}

      {/* 3일치 섹션 */}
      <section className="mt-6 flex flex-col gap-4">
        <DayGroup
          label="어제"
          month={shiftDay(month, day, -1).month}
          day={shiftDay(month, day, -1).day}
          people={yesterdayPeople}
          loading={loading}
          messagesByReceiver={messagesByReceiver}
          currentUserId={user?.id ?? null}
          onCelebrate={(p) => setComposeFor(p)}
        />
        <DayGroup
          label="오늘"
          month={month}
          day={day}
          people={todayPeople}
          loading={loading}
          messagesByReceiver={messagesByReceiver}
          currentUserId={user?.id ?? null}
          highlight
          onCelebrate={(p) => setComposeFor(p)}
        />
        <DayGroup
          label="내일"
          month={shiftDay(month, day, 1).month}
          day={shiftDay(month, day, 1).day}
          people={tomorrowPeople}
          loading={loading}
          messagesByReceiver={messagesByReceiver}
          currentUserId={user?.id ?? null}
          onCelebrate={(p) => setComposeFor(p)}
        />
      </section>

      {/* 이달의 생일 */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-base font-extrabold tracking-tight md:text-lg">
            📅 이달의 생일
          </span>
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-foreground/70">
            {monthPeople.length}명
          </span>
        </div>
        <MonthList people={monthPeople} loading={loading} todayDay={day} />
      </section>

      {/* 관리자 — birthday_registry 일괄 등록/관리 */}
      {isAdmin && <AdminRegistrySection />}

      {/* 메시지 작성 모달 */}
      <AnimatePresence>
        {composeFor && (
          <ComposeModal
            target={composeFor}
            currentUserId={user?.id ?? null}
            onClose={() => setComposeFor(null)}
            onSent={async () => {
              setComposeFor(null);
              await loadAll();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
// 3일치 카드 그룹
// ─────────────────────────────────────────────

function DayGroup({
  label,
  month,
  day,
  people,
  loading,
  messagesByReceiver,
  currentUserId,
  onCelebrate,
  highlight = false,
}: {
  label: string;
  month: number;
  day: number;
  people: BirthdayPerson[];
  loading: boolean;
  messagesByReceiver: Record<string, BirthdayMessage[]>;
  currentUserId: string | null;
  onCelebrate: (p: BirthdayPerson) => void;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-4 dark:bg-[#16162a] md:p-5",
        highlight
          ? "border-pink-300 shadow-[0_8px_24px_rgba(244,114,182,0.2)] dark:border-pink-500/40"
          : "border-gray-200 dark:border-white/[0.07]",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-bold",
            highlight
              ? "bg-pink-500 text-white"
              : "bg-foreground/10 text-foreground/70",
          )}
        >
          {label}
        </span>
        <span className="text-xs text-foreground/55 tabular-nums">
          {month}월 {day}일
        </span>
      </div>

      {loading ? (
        <ul className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <li
              key={i}
              className="h-20 animate-pulse rounded-xl bg-foreground/5"
              aria-hidden
            />
          ))}
        </ul>
      ) : people.length === 0 ? (
        <p className="px-1 py-3 text-sm text-foreground/45">
          이 날 생일인 친구가 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {people.map((p) => (
            <PersonCard
              key={p.id}
              person={p}
              messages={messagesByReceiver[p.id] ?? []}
              isMe={p.source === "profile" && currentUserId === p.id}
              onCelebrate={() => onCelebrate(p)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonCard({
  person,
  messages,
  isMe,
  onCelebrate,
}: {
  person: BirthdayPerson;
  messages: BirthdayMessage[];
  isMe: boolean;
  onCelebrate: () => void;
}) {
  // registry 출처는 실제 user 가 아니므로 메시지 송신 불가 — 버튼 숨김.
  const canSendMessage = person.source === "profile" && !isMe;

  return (
    <li className="rounded-xl bg-pink-50/40 p-3 dark:bg-pink-500/5">
      <div className="flex items-center gap-3">
        <UserAvatar
          nickname={person.displayName}
          role={person.role}
          avatarUrl={person.avatar_url}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {person.displayName}
            {isMe && (
              <span className="ml-1.5 rounded-full bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-bold text-pink-600 dark:text-pink-300">
                나
              </span>
            )}
          </p>
          <p className="text-[11px] text-foreground/55">
            🎂 {person.birth_month}월 {person.birth_day}일 생일
          </p>
        </div>
        {canSendMessage && (
          <button
            type="button"
            onClick={onCelebrate}
            className="shrink-0 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_4px_14px_rgba(244,114,182,0.4)] transition-transform hover:scale-105"
          >
            축하 메시지 보내기
          </button>
        )}
      </div>

      {messages.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-pink-200/60 pt-3 dark:border-pink-500/20">
          {messages.map((m) => (
            <li key={m.id} className="flex items-start gap-2">
              <UserAvatar
                nickname={m.sender?.nickname ?? null}
                role={m.sender?.role ?? null}
                avatarUrl={m.sender?.avatar_url ?? null}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] text-foreground/60">
                  <span className="font-bold text-foreground/85">
                    {m.sender?.nickname ?? "익명"}
                  </span>
                  <span>·</span>
                  <span>{formatRelative(m.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                  {m.message}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────
// 이달의 생일 리스트
// ─────────────────────────────────────────────

function MonthList({
  people,
  loading,
  todayDay,
}: {
  people: BirthdayPerson[];
  loading: boolean;
  todayDay: number;
}) {
  if (loading) {
    return (
      <ul className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="h-12 animate-pulse rounded-xl bg-foreground/5"
            aria-hidden
          />
        ))}
      </ul>
    );
  }
  if (people.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-foreground/45 dark:border-white/[0.08]">
        이번 달 생일자가 없어요.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {people.map((p) => {
        const isToday = p.birth_day === todayDay;
        const isFuture = p.birth_day > todayDay;
        const ddayDiff = p.birth_day - todayDay;
        return (
          <li
            key={p.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
              isToday
                ? "border-pink-300 bg-pink-50 dark:border-pink-500/40 dark:bg-pink-500/10"
                : isFuture
                  ? "border-gray-200 bg-white dark:border-white/[0.07] dark:bg-[#16162a]"
                  : "border-gray-100 bg-gray-50/60 text-foreground/55 dark:border-white/[0.04] dark:bg-white/[0.02]",
            )}
          >
            <span
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-extrabold tabular-nums",
                isToday
                  ? "bg-pink-500 text-white"
                  : "bg-foreground/10 text-foreground/70",
              )}
            >
              {p.birth_day}일
            </span>
            <UserAvatar
              nickname={p.displayName}
              role={p.role}
              avatarUrl={p.avatar_url}
              size="sm"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {p.displayName}
            </span>
            {isToday && (
              <span className="shrink-0 rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-bold text-white">
                오늘 🎂
              </span>
            )}
            {isFuture && (
              <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-300">
                D-{ddayDiff}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ─────────────────────────────────────────────
// 메시지 작성 모달
// ─────────────────────────────────────────────

const MESSAGE_MAX = 200;

function ComposeModal({
  target,
  currentUserId,
  onClose,
  onSent,
}: {
  target: BirthdayPerson;
  currentUserId: string | null;
  onClose: () => void;
  onSent: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MESSAGE_MAX && !submitting;

  async function send() {
    if (!canSend) return;
    if (!currentUserId) {
      setError("로그인이 필요해요.");
      return;
    }
    if (target.source !== "profile") {
      setError("이 친구에게는 메시지를 보낼 수 없어요.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase
        .from("birthday_messages")
        .insert({
          sender_id: currentUserId,
          receiver_id: target.id,
          message: trimmed,
        });
      if (insertErr) {
        console.error("[birthday] 메시지 INSERT 실패", insertErr);
        setError("전송에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      await onSent();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-white/95 p-5 shadow-2xl backdrop-blur-md dark:bg-[#16162a]/95 sm:rounded-3xl"
      >
        <div className="flex items-start gap-3">
          <UserAvatar
            nickname={target.displayName}
            role={target.role}
            avatarUrl={target.avatar_url}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-pink-500">생일 축하 메시지</p>
            <p className="truncate text-base font-extrabold">
              {target.displayName}님께
            </p>
            <p className="text-[11px] text-foreground/55">
              🎂 {target.birth_month}월 {target.birth_day}일 생일
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-8 w-8 place-items-center rounded-full bg-foreground/5 text-foreground/55 transition-colors hover:bg-foreground/10"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          rows={3}
          autoFocus
          maxLength={MESSAGE_MAX + 20}
          placeholder="따뜻한 한 마디를 남겨주세요 🎉"
          className="mt-4 w-full resize-none rounded-2xl bg-foreground/5 px-4 py-3 text-sm outline-none ring-1 ring-inset ring-transparent transition-colors placeholder:text-foreground/35 focus:ring-pink-500/40"
        />
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className={error ? "text-rose-500" : "text-foreground/45"}>
            {error ?? "한 줄 메시지로 마음을 전해주세요"}
          </span>
          <span
            className={cn(
              "tabular-nums",
              trimmed.length > MESSAGE_MAX ? "text-rose-500" : "text-foreground/45",
            )}
          >
            {trimmed.length}/{MESSAGE_MAX}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-foreground/5 px-4 py-2.5 text-sm font-bold text-foreground/75 transition-colors hover:bg-foreground/10"
          >
            취소
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-bold text-white transition-opacity",
              "bg-gradient-to-br from-pink-500 to-rose-500 shadow-[0_6px_20px_rgba(244,114,182,0.4)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting ? "보내는 중…" : "보내기"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// 관리자 — birthday_registry 일괄 등록/관리
// ─────────────────────────────────────────────

const GRADE_OPTIONS = [
  { value: 0, label: "교사" },
  { value: 1, label: "1학년" },
  { value: 2, label: "2학년" },
  { value: 3, label: "3학년" },
];
const CLASS_OPTIONS = [
  { value: 0, label: "해당없음" },
  { value: 1, label: "1반" },
  { value: 2, label: "2반" },
  { value: 3, label: "3반" },
  { value: 4, label: "4반" },
  { value: 5, label: "5반" },
  { value: 6, label: "6반" },
  { value: 7, label: "7반" },
];
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

function AdminRegistrySection() {
  const [grade, setGrade] = useState<number>(1);
  const [classNum, setClassNum] = useState<number>(1);
  const [name, setName] = useState("");
  const [birthMonth, setBirthMonth] = useState<number>(1);
  const [birthDay, setBirthDay] = useState<number>(1);

  const [submitting, setSubmitting] = useState(false);
  const [registry, setRegistry] = useState<BirthdayRegistryRow[]>([]);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRegistry = useCallback(async () => {
    setRegistryLoading(true);
    const { data, error: e } = await supabase
      .from("birthday_registry")
      .select("*")
      .order("grade", { ascending: true })
      .order("class", { ascending: true })
      .order("name", { ascending: true });
    if (e) {
      console.error("[admin/registry] 목록 조회 실패", e);
    }
    setRegistry((data ?? []) as BirthdayRegistryRow[]);
    setRegistryLoading(false);
  }, []);

  useEffect(() => {
    void loadRegistry();
  }, [loadRegistry]);

  // 학년이 0(교사) 으로 바뀌면 반은 자동으로 0(해당없음).
  useEffect(() => {
    if (grade === 0 && classNum !== 0) setClassNum(0);
  }, [grade, classNum]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function submit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("이름을 입력해주세요.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: e } = await supabase.from("birthday_registry").insert({
      grade,
      class: classNum,
      name: trimmedName,
      birth_month: birthMonth,
      birth_day: birthDay,
    });
    setSubmitting(false);
    if (e) {
      console.error("[admin/registry] 등록 실패", e);
      setError(`등록에 실패했어요: ${e.message}`);
      return;
    }
    showToast(`✅ ${trimmedName} 등록 완료`);
    // 같은 반 연속 입력 편의 — 학년/반은 유지, 이름·월·일만 초기화
    setName("");
    setBirthMonth(1);
    setBirthDay(1);
    await loadRegistry();
  }

  async function remove(id: number) {
    if (!window.confirm("이 항목을 삭제할까요?")) return;
    const { error: e } = await supabase
      .from("birthday_registry")
      .delete()
      .eq("id", id);
    if (e) {
      console.error("[admin/registry] 삭제 실패", e);
      showToast("삭제에 실패했어요");
      return;
    }
    showToast("삭제되었어요");
    await loadRegistry();
  }

  return (
    <section className="mt-10 rounded-2xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-500/30 dark:bg-violet-500/[0.06] md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">
          ADMIN
        </span>
        <h2 className="text-base font-extrabold tracking-tight text-violet-700 dark:text-violet-200 md:text-lg">
          🎂 생일 등록
        </h2>
      </div>
      <p className="mb-4 text-xs text-foreground/55">
        학번 기반으로 학생·교사 생일을 일괄 등록합니다. 등록된 생일은 배너와
        목록에 자동 노출돼요.
      </p>

      {/* 입력 폼 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Select
          label="학년"
          value={grade}
          onChange={setGrade}
          options={GRADE_OPTIONS}
        />
        <Select
          label="반"
          value={classNum}
          onChange={setClassNum}
          options={CLASS_OPTIONS}
          disabled={grade === 0}
        />
        <label className="col-span-2 flex flex-col gap-1 text-[11px] font-bold text-foreground/65 sm:col-span-1">
          <span>이름</span>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="예: 아이유"
            maxLength={20}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-white/10 dark:bg-white/[0.04]"
          />
        </label>
        <Select
          label="생일 월"
          value={birthMonth}
          onChange={setBirthMonth}
          options={MONTH_OPTIONS.map((m) => ({ value: m, label: `${m}월` }))}
        />
        <Select
          label="생일 일"
          value={birthDay}
          onChange={setBirthDay}
          options={DAY_OPTIONS.map((d) => ({ value: d, label: `${d}일` }))}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className={cn("text-[11px]", error ? "text-rose-500" : "text-foreground/45")}>
          {error ?? "학년/반은 등록 후에도 유지됩니다."}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !name.trim()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white transition-opacity",
            "bg-violet-600 hover:bg-violet-700",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {submitting ? "등록 중…" : "등록"}
        </button>
      </div>

      {/* 토스트 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none fixed inset-x-0 bottom-10 z-50 flex justify-center px-4"
          >
            <div className="rounded-full border border-violet-400/30 bg-violet-600/95 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md">
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 등록된 목록 */}
      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-bold text-foreground/80">등록된 생일</span>
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-foreground/70">
            {registry.length}명
          </span>
        </div>
        {registryLoading ? (
          <ul className="flex flex-col gap-1.5">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-9 animate-pulse rounded-lg bg-foreground/5"
                aria-hidden
              />
            ))}
          </ul>
        ) : registry.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-xs text-foreground/45 dark:border-white/[0.08]">
            아직 등록된 항목이 없어요.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {registry.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-white/[0.07] dark:bg-[#16162a]"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {registryDisplayName(r)}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-foreground/60">
                  {r.birth_month}월 {r.birth_day}일
                </span>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  aria-label="삭제"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-foreground/45 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Select<T extends number>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-bold text-foreground/65">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as T)}
        disabled={disabled}
        className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm outline-none focus:border-violet-500 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
