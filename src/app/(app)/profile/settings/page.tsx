"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Globe,
  Mail,
  MessageCircle,
  MessageSquare,
  Heart,
  Megaphone,
  ChevronLeft,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
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
  badge,
}: {
  icon: typeof Bell;
  iconColor: string;
  iconBg: string;
  title: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
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
      <Toggle checked={checked} onChange={onChange} />
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

function Toast({ visible }: { visible: boolean }) {
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
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 dark:text-amber-600" />
          Supabase 연동 후 실제 작동합니다
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────

interface SettingState {
  siteNotification: boolean;
  browserPush: boolean;
  emailNotification: boolean;
  onComment: boolean;
  onReply: boolean;
  onLike: boolean;
  onNotice: boolean;
}

const DEFAULT_SETTINGS: SettingState = {
  siteNotification: true,
  browserPush: false,
  emailNotification: false,
  onComment: true,
  onReply: true,
  onLike: true,
  onNotice: true,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingState>(DEFAULT_SETTINGS);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTimer, setToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const toggle = useCallback(
    (key: keyof SettingState) => {
      setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

      // 기존 타이머 초기화 후 새로 시작
      if (toastTimer) clearTimeout(toastTimer);
      setToastVisible(true);
      const t = setTimeout(() => setToastVisible(false), 2500);
      setToastTimer(t);
    },
    [toastTimer],
  );

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
        </div>

        {/* ── 알림 채널 설정 ── */}
        <SectionHeader title="알림 채널" />
        <div className="divide-y divide-gray-50 bg-white dark:divide-white/[0.04] dark:bg-transparent">
          <SettingRow
            icon={Bell}
            iconColor="text-violet-600"
            iconBg="bg-violet-50 dark:bg-violet-900/20"
            title="사이트 내 알림"
            desc="문파스 안에서 알림을 받아요"
            checked={settings.siteNotification}
            onChange={() => toggle("siteNotification")}
          />
          <SettingRow
            icon={Globe}
            iconColor="text-blue-500"
            iconBg="bg-blue-50 dark:bg-blue-900/20"
            title="브라우저 푸시 알림"
            desc="사이트를 닫아도 브라우저 알림을 받아요"
            checked={settings.browserPush}
            onChange={() => toggle("browserPush")}
            badge="허용 필요"
          />
          <SettingRow
            icon={Mail}
            iconColor="text-green-600"
            iconBg="bg-green-50 dark:bg-green-900/20"
            title="이메일 알림"
            desc="학교 구글 계정으로 이메일을 받아요"
            checked={settings.emailNotification}
            onChange={() => toggle("emailNotification")}
            badge="구글 로그인 필요"
          />
        </div>

        {/* ── 세부 알림 설정 ── */}
        <SectionHeader title="세부 알림" />
        <div className="divide-y divide-gray-50 bg-white dark:divide-white/[0.04] dark:bg-transparent">
          <SettingRow
            icon={MessageCircle}
            iconColor="text-blue-500"
            iconBg="bg-blue-50 dark:bg-blue-900/20"
            title="내 글에 댓글"
            desc="내가 작성한 글에 댓글이 달리면 알려줘요"
            checked={settings.onComment}
            onChange={() => toggle("onComment")}
          />
          <SettingRow
            icon={MessageSquare}
            iconColor="text-cyan-500"
            iconBg="bg-cyan-50 dark:bg-cyan-900/20"
            title="내 댓글에 대댓글"
            desc="내가 쓴 댓글에 대댓글이 달리면 알려줘요"
            checked={settings.onReply}
            onChange={() => toggle("onReply")}
          />
          <SettingRow
            icon={Heart}
            iconColor="text-rose-500"
            iconBg="bg-rose-50 dark:bg-rose-900/20"
            title="내 글에 좋아요"
            desc="내가 작성한 글에 좋아요가 달리면 알려줘요"
            checked={settings.onLike}
            onChange={() => toggle("onLike")}
          />
          <SettingRow
            icon={Megaphone}
            iconColor="text-amber-500"
            iconBg="bg-amber-50 dark:bg-amber-900/20"
            title="공지사항 새 글"
            desc="새 공지사항이 올라오면 전체 알림을 받아요"
            checked={settings.onNotice}
            onChange={() => toggle("onNotice")}
          />
        </div>

        {/* 안내 */}
        <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-900/10">
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            <strong>개발 모드 안내</strong><br />
            현재는 UI만 동작하며, Supabase 연동 완료 후 실제 알림이 작동합니다.
          </p>
        </div>
      </motion.div>

      {/* 토스트 */}
      <Toast visible={toastVisible} />
    </>
  );
}
