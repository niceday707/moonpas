"use client";

// 푸시 알림 권한 요청 배너
//
// - Notification.permission === 'granted' → 배너 숨김 + 토큰 자동 등록
// - Notification.permission === 'default' + 스누즈 기간 미만 → 배너 표시
// - Notification.permission === 'denied'  → 아무것도 하지 않음
// - "나중에" 클릭 시 7일간 배너를 숨긴다 (localStorage).

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { registerPushToken, requestPermissionAndRegister } from "@/lib/fcm";

const SNOOZE_KEY = "moonpas:push_snoozed_until";
const SNOOZE_DAYS = 7;

type Props = { userId: string };

export function PushNotificationBanner({ userId }: Props) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    const perm = Notification.permission;

    if (perm === "granted") {
      // 이미 허용 → 조용히 토큰 등록
      void registerPushToken(userId);
      return;
    }

    if (perm === "denied") return;

    // default — 스누즈 기간 체크
    const snoozedUntil = localStorage.getItem(SNOOZE_KEY);
    if (snoozedUntil && Date.now() < Number(snoozedUntil)) return;

    setVisible(true);
  }, [userId]);

  if (!visible) return null;

  const handleEnable = async () => {
    setLoading(true);
    const granted = await requestPermissionAndRegister(userId);
    setLoading(false);
    if (granted) setVisible(false);
  };

  const handleSnooze = () => {
    const until = Date.now() + SNOOZE_DAYS * 86_400_000;
    localStorage.setItem(SNOOZE_KEY, String(until));
    setVisible(false);
  };

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-500/30 dark:bg-violet-950/40">
      <Bell className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
      <p className="min-w-0 flex-1 text-sm text-violet-800 dark:text-violet-200">
        알림을 켜면 댓글, 좋아요를 바로 받을 수 있어요
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void handleEnable()}
          disabled={loading}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
        >
          {loading ? "처리 중…" : "알림 켜기"}
        </button>
        <button
          type="button"
          onClick={handleSnooze}
          className="rounded-lg px-2 py-1.5 text-xs text-violet-500 transition-colors hover:bg-violet-100 dark:hover:bg-violet-900/40"
        >
          나중에
        </button>
        <button
          type="button"
          onClick={handleSnooze}
          aria-label="닫기"
          className="rounded p-0.5 text-violet-400 transition-colors hover:text-violet-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
