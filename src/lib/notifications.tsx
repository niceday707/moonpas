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

// ── 더미 데이터 ───────────────────────────────────────────────────────
// TODO: Supabase 연동 후 실시간 구독으로 교체
const now = Date.now();

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    type: "comment",
    actorName: "익명3",
    postId: "p-003",
    postTitle: "이번 모의고사 수학 30번 풀이 같이 봐요",
    body: "저도 너무 어려웠어요 ㅠㅠ 같이 풀어봐요!",
    createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
    read: false,
  },
  {
    id: "n2",
    type: "like",
    actorName: "익명5 외 4명",
    postId: "p-001",
    postTitle: "2028 수능 개편안 요약 정리 (개인 공부 자료 공유)",
    body: "5명이 내 글을 좋아합니다",
    createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
    read: false,
  },
  {
    id: "n3",
    type: "reply",
    actorName: "익명7",
    postId: "p-005",
    postTitle: "고2 물리학 선택한 분들 공부법 어떻게 해요?",
    body: "저도 같은 고민인데 ㅎㅎ 같이 얘기해요",
    createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    read: false,
  },
  {
    id: "n4",
    type: "notice",
    actorName: "교무부",
    postId: "notice-001",
    postTitle: "[공지] 2학기 중간고사 일정 안내",
    body: "시험 기간: 5월 20일(화) ~ 5월 23일(금)",
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    read: true,
  },
  {
    id: "n5",
    type: "comment",
    actorName: "학부모A",
    postId: "p-013",
    postTitle: "학부모 입장에서 본 학교 생활 이야기",
    body: "공감되는 내용이에요. 저도 비슷한 생각을 했어요.",
    createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    read: true,
  },
];

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
