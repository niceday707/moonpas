"use client";

// 알림 설정 — profiles.notification_settings (JSONB) 와 동기화.
//   - 마운트 시: 본인 row 의 notification_settings 를 읽어서 토글 상태 hydrate
//   - 토글 변경 시: 낙관적 업데이트 후 supabase UPDATE
//   - 키는 lib/notify.ts 의 채널과 정확히 일치 (onComment / onReply / onLike / onNotice)
//
//   사이트 내 알림 / 브라우저 푸시 / 이메일 알림 3개 채널은 이번 단계에서는
//   토글 UI 만 두고 저장하지 않는다 (인프라 미구현 — UI 만 동작).
//   세부 알림 4개는 실제로 알림 생성 게이트 역할을 한다.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Globe,
  MessageCircle,
  MessageSquare,
  Heart,
  Users,
  PartyPopper,
  BookOpen,
  GraduationCap,
  ChevronLeft,
  Check,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser } from "@/lib/supabase-profile";
import { cn } from "@/lib/utils";

// ── 토글 스위치 컴포넌트 ─────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
        checked ? "bg-violet-600" : "bg-gray-300 dark:bg-gray-600",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "pointer-events-none mt-0.5 inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

// ── 설정 행 컴포넌트 ─────────────────────────────────────────────────

function SettingRow({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  desc,
  checked,
  onChange,
  disabled = false,
  badge,
}: {
  icon: typeof Bell;
  iconColor: string;
  iconBg: string;
  title: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", iconBg)}>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </span>
          {badge && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {desc}
        </p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ── 섹션 헤더 ────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5 dark:border-white/[0.05] dark:bg-white/[0.02]">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {title}
      </p>
    </div>
  );
}

// ── 토스트 ────────────────────────────────────────────────────────────

function Toast({ visible, message }: { visible: boolean; message: string }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.22 }}
          className="fixed bottom-28 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-gray-800 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-gray-100 dark:text-gray-900 md:bottom-8"
        >
          <Check className="h-4 w-4 shrink-0 text-emerald-400 dark:text-emerald-600" />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────

/** DB 와 1:1 매핑되는 키. notify.ts 의 channel 키와 동일. */
type DbSettings = {
  onComment: boolean;
  onReply: boolean;
  onLike: boolean;
  onNotice: boolean; // 레거시 유지 — UI 노출 없음
  // 게시판 새 글 알림 — 카테고리 4개
  onCommunity: boolean;
  onEvent: boolean;
  onStudent: boolean;
  onAlumni: boolean;
};

const DEFAULT_DB_SETTINGS: DbSettings = {
  onComment: true,
  onReply: true,
  onLike: true,
  onNotice: true,
  onCommunity: true,
  onEvent: true,
  onStudent: true,
  onAlumni: true,
};

/** UI 만 동작하는 채널 — 인프라 미구현이라 DB 에 저장하지 않음. */
type UiOnlySettings = {
  siteNotification: boolean;
  browserPush: boolean;
};

const DEFAULT_UI_SETTINGS: UiOnlySettings = {
  siteNotification: true,
  browserPush: false,
};

export default function SettingsPage() {
  const { user, loading: userLoading } = useSupabaseUser();

  const [dbSettings, setDbSettings] = useState<DbSettings>(DEFAULT_DB_SETTINGS);
  const [uiSettings, setUiSettings] = useState<UiOnlySettings>(DEFAULT_UI_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("저장되었어요");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 마운트 시 DB 에서 설정 로드 ─────────────────────────
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("notification_settings")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error("[settings] notification_settings 조회 실패", error);
        setHydrated(true);
        return;
      }
      const raw = (data?.notification_settings ?? null) as Partial<DbSettings> | null;
      setDbSettings({
        onComment: raw?.onComment ?? DEFAULT_DB_SETTINGS.onComment,
        onReply: raw?.onReply ?? DEFAULT_DB_SETTINGS.onReply,
        onLike: raw?.onLike ?? DEFAULT_DB_SETTINGS.onLike,
        onNotice: raw?.onNotice ?? DEFAULT_DB_SETTINGS.onNotice,
        onCommunity: raw?.onCommunity ?? DEFAULT_DB_SETTINGS.onCommunity,
        onEvent: raw?.onEvent ?? DEFAULT_DB_SETTINGS.onEvent,
        onStudent: raw?.onStudent ?? DEFAULT_DB_SETTINGS.onStudent,
        onAlumni: raw?.onAlumni ?? DEFAULT_DB_SETTINGS.onAlumni,
      });
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  function showToast(message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 1800);
  }

  // ── DB 저장 토글 (세부 알림 4개) ─────────────────────────
  async function toggleDb(key: keyof DbSettings) {
    if (!user) return;
    const prev = dbSettings;
    const next: DbSettings = { ...prev, [key]: !prev[key] };
    setDbSettings(next); // 낙관적

    const { error } = await supabase
      .from("profiles")
      .update({ notification_settings: next })
      .eq("id", user.id);

    if (error) {
      console.error("[settings] notification_settings 저장 실패", error);
      setDbSettings(prev); // 롤백
      showToast("저장에 실패했어요");
      return;
    }
    showToast("저장되었어요");
  }

  // ── UI-only 토글 (사이트/푸시) ───────────────────────────
  function toggleUi(key: keyof UiOnlySettings) {
    setUiSettings((p) => ({ ...p, [key]: !p[key] }));
    showToast("브라우저 푸시 알림은 곧 지원됩니다");
  }

  const disabled = !user || !hydrated;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-lg"
      >
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-white/[0.07]">
          <Link
            href="/notifications"
            className="grid h-9 w-9 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
            aria-label="뒤로 가기"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-extrabold text-gray-900 dark:text-white">
            알림 설정
          </h1>
          {(userLoading || !hydrated) && user && (
            <Loader2 className="ml-auto h-4 w-4 animate-spin text-gray-400" />
          )}
        </div>

        {/* 비로그인 안내 */}
        {!userLoading && !user && (
          <div className="m-4 rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600 dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-gray-300">
            로그인 후 알림 설정을 변경할 수 있어요.
          </div>
        )}

        {/* ── 알림 채널 설정 ── */}
        <SectionHeader title="알림 채널" />
        <div className="divide-y divide-gray-50 bg-white dark:divide-white/[0.04] dark:bg-transparent">
          <SettingRow
            icon={Bell}
            iconColor="text-violet-600"
            iconBg="bg-violet-50 dark:bg-violet-900/20"
            title="사이트 내 알림"
            desc="문파스 안에서 알림을 받아요"
            checked={uiSettings.siteNotification}
            onChange={() => toggleUi("siteNotification")}
          />
          <SettingRow
            icon={Globe}
            iconColor="text-blue-500"
            iconBg="bg-blue-50 dark:bg-blue-900/20"
            title="브라우저 푸시 알림"
            desc="사이트를 닫아도 브라우저 알림을 받아요"
            checked={uiSettings.browserPush}
            onChange={() => toggleUi("browserPush")}
          />
        </div>

        {/* ── 세부 알림 설정 — DB 저장 ── */}
        <SectionHeader title="세부 알림" />
        <div className="divide-y divide-gray-50 bg-white dark:divide-white/[0.04] dark:bg-transparent">
          <SettingRow
            icon={MessageCircle}
            iconColor="text-blue-500"
            iconBg="bg-blue-50 dark:bg-blue-900/20"
            title="내 글에 댓글"
            desc="내가 작성한 글에 댓글이 달리면 알려줘요"
            checked={dbSettings.onComment}
            onChange={() => toggleDb("onComment")}
            disabled={disabled}
          />
          <SettingRow
            icon={MessageSquare}
            iconColor="text-cyan-500"
            iconBg="bg-cyan-50 dark:bg-cyan-900/20"
            title="내 댓글에 대댓글"
            desc="내가 쓴 댓글에 대댓글이 달리면 알려줘요"
            checked={dbSettings.onReply}
            onChange={() => toggleDb("onReply")}
            disabled={disabled}
          />
          <SettingRow
            icon={Heart}
            iconColor="text-rose-500"
            iconBg="bg-rose-50 dark:bg-rose-900/20"
            title="내 글에 좋아요"
            desc="내가 작성한 글에 좋아요가 달리면 알려줘요"
            checked={dbSettings.onLike}
            onChange={() => toggleDb("onLike")}
            disabled={disabled}
          />
        </div>

        {/* ── 게시판 새 글 알림 — DB 저장 ── */}
        <SectionHeader title="게시판 새 글 알림" />
        <div className="divide-y divide-gray-50 bg-white dark:divide-white/[0.04] dark:bg-transparent">
          <SettingRow
            icon={Users}
            iconColor="text-violet-500"
            iconBg="bg-violet-50 dark:bg-violet-900/20"
            title="커뮤니티 새 글"
            desc="챌린지, 에타, 자유게시판, 학습게시판, 나눔장터, 분실물센터, 학생자치회 새 글 알림"
            checked={dbSettings.onCommunity}
            onChange={() => toggleDb("onCommunity")}
            disabled={disabled}
          />
          <SettingRow
            icon={PartyPopper}
            iconColor="text-pink-500"
            iconBg="bg-pink-50 dark:bg-pink-900/20"
            title="문태 이벤트 새 글"
            desc="오늘의 퀴즈, 누구일까요, 칭찬합시다, 회원 참여방 새 글 알림"
            checked={dbSettings.onEvent}
            onChange={() => toggleDb("onEvent")}
            disabled={disabled}
          />
          <SettingRow
            icon={BookOpen}
            iconColor="text-emerald-500"
            iconBg="bg-emerald-50 dark:bg-emerald-900/20"
            title="재학생 새 글"
            desc="대입정보, 교육과정, 문튜브, 자료실 새 글 알림"
            checked={dbSettings.onStudent}
            onChange={() => toggleDb("onStudent")}
            disabled={disabled}
          />
          <SettingRow
            icon={GraduationCap}
            iconColor="text-yellow-600"
            iconBg="bg-yellow-50 dark:bg-yellow-900/20"
            title="문태 교우 새 글"
            desc="졸업생, 동문 뉴스, 선배의 한마디 새 글 알림"
            checked={dbSettings.onAlumni}
            onChange={() => toggleDb("onAlumni")}
            disabled={disabled}
          />
        </div>
      </motion.div>

      {/* 토스트 */}
      <Toast visible={toastVisible} message={toastMessage} />
    </>
  );
}
