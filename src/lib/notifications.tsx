"use client";

// 알림 시스템 — Supabase notifications 테이블에서 fetch + Realtime INSERT 구독.
// - mount 시 본인 알림 목록 로드
// - markAsRead / markAllAsRead 는 is_read UPDATE
// - 멘션 클릭 시 /board/{board_type}/{post_id} 로 이동 (board_type 은 join 으로 함께 가져옴)
// - Realtime: notifications INSERT 이벤트(filter=user_id=eq.{본인})를 구독해
//   새 알림이 들어오면 페이지 새로고침 없이 목록 맨 앞에 끼워 넣고 배지 자동 증가.
//   013 마이그레이션이 supabase_realtime publication 에 notifications 를 추가한다.

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

  // ── Realtime 구독: 새 알림 INSERT → 목록 맨 앞에 추가 ────────
  // user_id 필터로 본인 행만 받음. RLS 정책상 어차피 본인 행만 노출되지만,
  // 서버에서 일찍 거르면 클라이언트 처리량을 줄일 수 있다.
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const raw = payload.new as {
            id: string;
            type: string;
            message: string;
            post_id: string | null;
            comment_id: string | null;
            is_read: boolean;
            created_at: string;
          };

          // payload 에는 임베딩(post.board_type) 이 따라오지 않으므로 별도 조회.
          // 클릭 시 라우팅에 board_type 이 필요.
          let boardType: string | null = null;
          if (raw.post_id) {
            const { data: postRow } = await supabase
              .from("posts")
              .select("board_type")
              .eq("id", raw.post_id)
              .maybeSingle();
            boardType = (postRow?.board_type as string | undefined) ?? null;
          }

          const incoming: AppNotification = {
            id: raw.id,
            type: (raw.type as NotificationType) ?? "mention",
            message: raw.message,
            postId: raw.post_id,
            commentId: raw.comment_id,
            boardType,
            isRead: raw.is_read,
            createdAt: raw.created_at,
          };

          setNotifications((prev) => {
            // 중복 방지 — 동일 id 가 이미 있으면 건너뜀 (자기 INSERT echo 또는 race)
            if (prev.some((n) => n.id === incoming.id)) return prev;
            // 최신 50개만 유지 — fetch 와 동일한 윈도우
            return [incoming, ...prev].slice(0, 50);
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
