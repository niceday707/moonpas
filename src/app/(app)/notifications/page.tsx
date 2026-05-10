"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AtSign,
  Bell,
  Loader2,
  MessageCircle,
  MessageSquare,
  Heart,
  Megaphone,
  CheckCheck,
  Settings,
  Target,
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
import { supabase } from "@/lib/supabase";
import { useSupabaseUser } from "@/lib/supabase-profile";
import { respondToInvite } from "@/lib/challenge";

// ── 알림 타입별 아이콘 / 색상 / 문구 ─────────────────────────────────

const TYPE_META: Record<
  NotificationType,
  { icon: typeof Bell; color: string; bg: string; label: string }
> = {
  mention: {
    icon: AtSign,
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-900/25",
    label: "멘션",
  },
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
  challenge_invite: {
    icon: Target,
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-900/25",
    label: "챌린지 초대",
  },
};

// ── 단일 알림 아이템 ─────────────────────────────────────────────────

function NotificationItem({ notification }: { notification: AppNotification }) {
  const router = useRouter();
  const { markAsRead } = useNotifications();
  const meta = TYPE_META[notification.type] ?? TYPE_META.mention;
  const Icon = meta.icon;
  const isInvite = notification.type === "challenge_invite";

  const handleClick = async () => {
    await markAsRead(notification.id);
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
      <div
        className={cn(
          "flex items-start gap-3 px-4 py-4 transition-colors",
          isInvite && "border-l-4 border-violet-500",
          !notification.isRead && "bg-violet-50/50 dark:bg-violet-900/10",
        )}
      >
        {/* 타입 아이콘 — 클릭 시 상세 이동 */}
        <button
          type="button"
          onClick={handleClick}
          aria-label="알림 보기"
          className={cn(
            "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl transition hover:opacity-80",
            meta.bg,
          )}
        >
          {isInvite ? (
            <span className="text-xl">🎯</span>
          ) : (
            <Icon className={cn("h-5 w-5", meta.color)} />
          )}
        </button>

        {/* 본문 */}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={handleClick}
            className="block w-full text-left"
          >
            <p
              className={cn(
                "text-sm leading-snug",
                notification.isRead
                  ? "text-gray-500 dark:text-gray-400"
                  : "font-semibold text-gray-900 dark:text-white",
              )}
            >
              {notification.message}
            </p>
            <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
              {relativeTime(notification.createdAt)}
            </p>
          </button>

          {/* 챌린지 초대 — 수락/거절 버튼 */}
          {isInvite && notification.postId && (
            <ChallengeInviteActions
              notificationId={notification.id}
              challengeId={notification.postId}
            />
          )}
        </div>

        {/* 읽지 않은 파란 점 */}
        {!notification.isRead && (
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-violet-500" />
        )}
      </div>
    </motion.li>
  );
}

// ── 챌린지 초대 — 수락/거절 인라인 버튼 ─────────────────────────
// post_id(=challenge_id) + 현재 사용자로 challenge_invites 한 행을 찾아
// respondToInvite 호출. 응답 후 상태별로 UI 비활성.
function ChallengeInviteActions({
  notificationId,
  challengeId,
}: {
  notificationId: string;
  challengeId: string;
}) {
  const { user } = useSupabaseUser();
  const { markAsRead } = useNotifications();
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "accepted" | "declined" | "missing" | null>(
    null,
  );
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("challenge_invites")
        .select("id, status")
        .eq("challenge_id", challengeId)
        .eq("invitee_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (error || !data) {
        setStatus("missing");
        return;
      }
      const row = data as { id: string; status: "pending" | "accepted" | "declined" };
      setInviteId(row.id);
      setStatus(row.status);
    })();
    return () => {
      active = false;
    };
  }, [user, challengeId]);

  async function respond(accept: boolean) {
    if (!inviteId) return;
    setBusy(accept ? "accept" : "decline");
    const { error } = await respondToInvite(inviteId, accept);
    setBusy(null);
    if (error) {
      alert(`처리 실패: ${error}`);
      return;
    }
    setStatus(accept ? "accepted" : "declined");
    await markAsRead(notificationId);
  }

  if (status === null) {
    return (
      <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        확인 중…
      </div>
    );
  }

  if (status === "missing") {
    // 초대 row 가 없으면 본인이 아니거나 초대자가 받은 "참여 완료" 알림 — 버튼 비표시
    return null;
  }

  if (status === "accepted") {
    return (
      <span className="mt-2 inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
        ✓ 참여 완료
      </span>
    );
  }
  if (status === "declined") {
    return (
      <span className="mt-2 inline-flex rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold text-gray-500 dark:bg-white/[0.06]">
        거절됨
      </span>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <button
        type="button"
        disabled={!!busy}
        onClick={() => respond(true)}
        className="inline-flex items-center gap-1 rounded-full bg-violet-500 px-4 py-1 text-xs font-bold text-white transition hover:bg-violet-600 disabled:opacity-50"
      >
        {busy === "accept" && <Loader2 className="h-3 w-3 animate-spin" />}
        수락
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => respond(false)}
        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-4 py-1 text-xs font-bold text-gray-600 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-white/[0.08] dark:text-gray-200 dark:hover:bg-white/[0.14]"
      >
        {busy === "decline" && <Loader2 className="h-3 w-3 animate-spin" />}
        거절
      </button>
    </div>
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
