"use client";

// 알림 시스템 — Supabase notifications 테이블에서 fetch.
// - mount 시 본인 알림 목록 로드
// - markAsRead / markAllAsRead 는 is_read UPDATE
// - 멘션 클릭 시 /board/{board_type}/{post_id} 로 이동 (board_type 은 join 으로 함께 가져옴)
//
// 실시간 구독은 추후 (Realtime) 도입 예정.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser } from "@/lib/supabase-profile";

// ── 타입 ─────────────────────────────────────────────────────────────
export type NotificationType =
  | "mention"
  | "comment"
  | "reply"
  | "like"
  | "notice";

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  postId: string | null;
  commentId: string | null;
  /** 클릭 시 라우팅용 — post_id 가 가리키는 글의 board_type */
  boardType: string | null;
  isRead: boolean;
  createdAt: string;
}

// notifications 테이블 row + posts(board_type) 임베딩
type RawNotification = {
  id: string;
  type: string;
  message: string;
  post_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
  post: { board_type: string } | null;
};

function normalize(raw: RawNotification): AppNotification {
  return {
    id: raw.id,
    type: (raw.type as NotificationType) ?? "mention",
    message: raw.message,
    postId: raw.post_id,
    commentId: raw.comment_id,
    boardType: raw.post?.board_type ?? null,
    isRead: raw.is_read,
    createdAt: raw.created_at,
  };
}

// ── Context ──────────────────────────────────────────────────────────
interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refetch: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useSupabaseUser();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, type, message, post_id, comment_id, is_read, created_at, post:posts(board_type)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[notifications] fetch 실패", error);
      setNotifications([]);
    } else {
      setNotifications(
        ((data ?? []) as unknown as RawNotification[]).map(normalize),
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = useCallback(
    async (id: string) => {
      // 낙관적 업데이트
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) {
        console.error("[notifications] markAsRead 실패", error);
      }
    },
    [],
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (error) {
      console.error("[notifications] markAllAsRead 실패", error);
    }
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refetch: fetchAll,
        markAsRead,
        markAllAsRead,
      }}
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
/** 알림 클릭 시 이동할 경로 — post_id + board_type 이 있으면 그 글 상세로, 없으면 대시보드 */
export function getNotificationHref(n: AppNotification): string {
  if (n.type === "notice") return "/notices";
  if (n.postId && n.boardType) {
    return `/board/${n.boardType}/${n.postId}`;
  }
  return "/dashboard";
}
