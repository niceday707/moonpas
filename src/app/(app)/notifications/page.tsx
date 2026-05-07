"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  MessageCircle,
  MessageSquare,
  Heart,
  Megaphone,
  CheckCheck,
  Settings,
} from "lucide-react";
import Link from "next/link";
import {
  useNotifications,
  getNotificationHref,
  type AppNotification,
  type NotificationType,
} from "@/lib/notifications";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// ── 알림 타입별 아이콘 / 색상 / 문구 ─────────────────────────────────

const TYPE_META: Record<
  NotificationType,
  { icon: typeof Bell; color: string; bg: string; label: string }
> = {
  comment: {
    icon: MessageCircle,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/25",
    label: "댓글",
  },
  reply: {
    icon: MessageSquare,
    color: "text-cyan-500",
    bg: "bg-cyan-50 dark:bg-cyan-900/25",
    label: "대댓글",
  },
  like: {
    icon: Heart,
    color: "text-rose-500",
    bg: "bg-rose-50 dark:bg-rose-900/25",
    label: "좋아요",
  },
  notice: {
    icon: Megaphone,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/25",
    label: "공지",
  },
};

function notificationText(n: AppNotification): string {
  switch (n.type) {
    case "comment":
      return `${n.actorName}이(가) 내 글에 댓글을 달았어요`;
    case "reply":
      return `${n.actorName}이(가) 내 댓글에 대댓글을 달았어요`;
    case "like":
      return `${n.actorName}이(가) 내 글을 좋아해요`;
    case "notice":
      return "새 공지사항이 등록됐어요";
  }
}

// ── 단일 알림 아이템 ─────────────────────────────────────────────────

function NotificationItem({ notification }: { notification: AppNotification }) {
  const router = useRouter();
  const { markAsRead } = useNotifications();
  const meta = TYPE_META[notification.type];
  const Icon = meta.icon;

  const handleClick = () => {
    markAsRead(notification.id);
    router.push(getNotificationHref(notification));
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.22 }}
    >
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-4 text-left transition-colors",
          "hover:bg-gray-50 dark:hover:bg-white/[0.03]",
          !notification.read && "bg-violet-50/50 dark:bg-violet-900/10",
        )}
      >
        {/* 타입 아이콘 */}
        <span
          className={cn(
            "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            meta.bg,
          )}
        >
          <Icon className={cn("h-5 w-5", meta.color)} />
        </span>

        {/* 본문 */}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm leading-snug",
              notification.read
                ? "text-gray-500 dark:text-gray-400"
                : "font-semibold text-gray-900 dark:text-white",
            )}
          >
            {notificationText(notification)}
          </p>
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
            {notification.postTitle}
          </p>
          {notification.body && (
            <p className="mt-1 line-clamp-1 text-xs text-gray-400 dark:text-gray-500">
              &ldquo;{notification.body}&rdquo;
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
            {relativeTime(notification.createdAt)}
          </p>
        </div>

        {/* 읽지 않은 파란 점 */}
        {!notification.read && (
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-violet-500" />
        )}
      </button>
    </motion.li>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { notifications, unreadCount, markAllAsRead } = useNotifications();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-lg"
    >
      {/* 헤더 */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-white/[0.07] dark:bg-[#0f0f1a]/95">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-extrabold text-gray-900 dark:text-white">
            알림
          </h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* 모두 읽음 */}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-violet-600 transition-colors hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20"
            >
              <CheckCheck className="h-4 w-4" />
              모두 읽음
            </button>
          )}
          {/* 알림 설정 */}
          <Link
            href="/profile/settings"
            className="grid h-9 w-9 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
            aria-label="알림 설정"
          >
            <Settings className="h-4.5 w-4.5" />
          </Link>
        </div>
      </div>

      {/* 알림 목록 */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gray-100 dark:bg-white/[0.06]">
            <Bell className="h-7 w-7 text-gray-400" />
          </div>
          <p className="font-semibold text-gray-600 dark:text-gray-300">
            새 알림이 없어요
          </p>
          <p className="mt-1 text-sm text-gray-400">
            댓글·좋아요가 달리면 여기에 표시돼요
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-white/[0.04]">
          <AnimatePresence initial={false}>
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* 하단 안내 */}
      {notifications.length > 0 && (
        <p className="py-6 text-center text-xs text-gray-400 dark:text-gray-500">
          최근 30일 알림이 표시됩니다
        </p>
      )}
    </motion.div>
  );
}
