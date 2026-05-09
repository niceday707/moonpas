"use client";

// VisitorTracker — (app) 셸이 처음 마운트될 때 /api/visit 를 1회 호출.
//   - 라우트 전환이 일어나도 (app)/layout.tsx 는 리마운트되지 않으므로 세션당 1회.
//   - 로그인 유저는 Authorization Bearer 헤더로 user_id 식별, 비로그인은 visitor_hash 만.
//   - fire-and-forget — 실패해도 사용자에게 노출하지 않음.

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function VisitorTracker() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let token: string | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token ?? null;
      } catch {
        // 세션 조회 실패는 무시 — 비로그인으로 진행
      }
      if (cancelled) return;

      try {
        await fetch("/api/visit", {
          method: "POST",
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : undefined,
          // Vercel Edge 와 통신 시 keepalive 로 페이지 이탈에도 견고하게
          keepalive: true,
        });
      } catch {
        // 네트워크 오류는 무시
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
