"use client";

// (app) 라우트 그룹 전체를 감싸는 인증 가드.
// AuthGate(개별 페이지에서 LoginRequired 안내 화면을 보여주는 용도)와 달리,
// 미로그인 사용자를 즉시 /login 으로 리다이렉트한다.
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useSupabaseUser } from "@/lib/supabase-profile";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useSupabaseUser();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // 세션 확인 중 또는 미로그인 상태(리다이렉트 대기 중) — 빈 화면 대신 스피너 표시
  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0f0f1a] text-white">
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loading ? "세션 확인 중..." : "로그인 페이지로 이동 중..."}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
