"use client";

// 알림 시스템 — 타입 정의, 더미 데이터, React Context
// Supabase 연동 시 INITIAL_NOTIFICATIONS를 실시간 구독으로 교체하면 됨

import { createContext, useContext, useState, type ReactNode } from "react";

// ── 타입 ─────────────────────────────────────────────────────────────
export type NotificationType = "comment" | "reply" | "like" | "notice";

export interface AppNotification {
  id: string;
  type: NotificationType;
  actorName: string;       // 행위자 이름
  postId: string;          // 관련 게시글 ID
  postTitle: string;       // 게시글 제목 (미리보기용)
  body: string;            // 알림 본문 요약
  createdAt: string;       // ISO 8601 timestamp
  read: boolean;
}

// ── 알림 데이터 ───────────────────────────────────────────────────────
// 실제 알림 시스템(댓글/좋아요 트리거 등)은 아직 구현되지 않았으므로 빈 배열로 시작.
// 추후 Supabase 트리거 + Realtime 으로 교체 예정.
export const INITIAL_NOTIFICATIONS: AppNotification[] = [];

// ── Context ──────────────────────────────────────────────────────────
interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(
    INITIAL_NOTIFICATIONS,
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) =>
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );

  const markAllAsRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAsRead, markAllAsRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      "useNotifications는 NotificationProvider 안에서 사용해야 합니다",
    );
  return ctx;
}

// ── 유틸 ─────────────────────────────────────────────────────────────
export function getNotificationHref(n: AppNotification): string {
  if (n.type === "notice") return "/notices";
  return `/feed/${n.postId}`;
}
