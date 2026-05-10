"use client";

// Google OAuth 콜백 페이지
// - signInWithOAuth({ redirectTo: "${origin}/auth/callback" }) 의 착륙지
// - URL hash(#access_token=...) 또는 query(?code=...) 둘 다 supabase-js 가 자동 처리(detectSessionInUrl=true)
// - SIGNED_IN 이벤트 또는 getSession() 결과를 보고 invite/도메인 분기 후 /dashboard 로 라우팅
// - hash 는 서버로 전송되지 않으므로 반드시 클라이언트 컴포넌트(page.tsx)여야 함 — route.ts 로는 동작 불가

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  ALLOWED_DOMAIN,
  ALLOWED_STUDENT_PREFIXES,
  SS_INVITE_CODE,
} from "@/lib/auth-const";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    // 세션 확보 후 분기/라우팅 실행 — 한 번만
    async function finish(userEmail: string) {
      if (handledRef.current) return;
      handledRef.current = true;

      const inviteCode =
        typeof window !== "undefined"
          ? sessionStorage.getItem(SS_INVITE_CODE)?.toLowerCase() ?? null
          : null;

      // 초대 코드 사용자: 도메인 체크 건너뜀.
      // 실제 코드 소비(used 마킹) + 역할 부여는 dashboard 의 닉네임 모달 제출 시점에
      // consume_invite_code RPC 가 원자적으로 처리한다 — 여기서 코드를 소진하면
      // 닉네임 모달 미완료 시 "코드만 소진" 사고가 발생함.
      if (inviteCode) {
        router.replace("/dashboard");
        return;
      }

      // 일반 사용자: 학교 도메인만 허용
      if (!userEmail.endsWith(`@${ALLOWED_DOMAIN}`)) {
        await supabase.auth.signOut();
        setError(
          `@${ALLOWED_DOMAIN} 학교 이메일만 로그인할 수 있습니다.\n(입력된 이메일: ${userEmail})\n학부모/졸업생은 초대 코드가 필요합니다.\n잠시 후 로그인 페이지로 이동합니다…`
        );
        setTimeout(() => router.replace("/login"), 2500);
        return;
      }

      // 학교 도메인 사용자: 학생(mt~)은 재학생 학번만 허용, 그 외는 교사로 간주
      const localPart = userEmail.slice(0, userEmail.indexOf("@")).toLowerCase();
      if (localPart.startsWith("mt")) {
        const isCurrentStudent = ALLOWED_STUDENT_PREFIXES.some((p) =>
          localPart.startsWith(p)
        );
        if (!isCurrentStudent) {
          await supabase.auth.signOut();
          setError(
            "졸업생은 초대 코드가 필요합니다.\n담당 선생님께 초대 코드를 요청하세요.\n잠시 후 로그인 페이지로 이동합니다…"
          );
          setTimeout(() => router.replace("/login"), 2500);
          return;
        }
      }

      router.replace("/dashboard");
    }

    // (1) 초기 마운트 시점에 supabase-js 가 이미 hash/code 를 처리했을 수 있으므로 즉시 세션 확인
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email;
      if (email) finish(email);
    });

    // (2) 처리 타이밍이 늦어 SIGNED_IN 이 마운트 후 도착하는 경우 대비
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.email) {
        finish(session.user.email);
      }
    });

    // (3) 안전망 — 5초 안에 세션이 안 잡히면 로그인 페이지로
    const timeout = setTimeout(() => {
      if (!handledRef.current) {
        setError("세션을 확인하지 못했습니다. 로그인 페이지로 이동합니다…");
        setTimeout(() => router.replace("/login"), 1500);
      }
    }, 5000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f0f1a]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.18) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10 w-full max-w-sm px-6 text-center">
        {error ? (
          <p className="whitespace-pre-line text-sm text-red-300">{error}</p>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            <p className="text-sm text-white/70">로그인 처리 중…</p>
          </div>
        )}
      </div>
    </div>
  );
}
