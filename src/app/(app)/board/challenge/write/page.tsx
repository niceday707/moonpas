"use client";

// 챌린지 인증 작성 — /board/challenge/write?challengeId=xxx
//
// Next.js App Router 가 literal `challenge/` 디렉토리를 동적 `[boardType]/` 보다 우선 매칭하기 때문에
// 이 URL 이 /board/[boardType]/write 로 풀리지 않고 /board/challenge/[challengeId] 로 풀려서
// challengeId="write" 가 되어 "챌린지를 찾을 수 없습니다" 가 떴다.
// 그래서 literal path 로 별도 라우트를 만들어 boardType="challenge" 를 prop 으로 강제 주입한다.

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BoardWriteShell } from "@/app/(app)/board/[boardType]/write/WriteShell";
import { supabase } from "@/lib/supabase";

export default function ChallengeWritePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-violet-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <DebugWrapper />
    </Suspense>
  );
}

// 디버그 로그 — challengeId 와 challenges 조회 결과를 콘솔에 출력.
// 운영 안정화 후 제거 가능.
function DebugWrapper() {
  const search = useSearchParams();
  const challengeId = search.get("challengeId");

  useEffect(() => {
    console.log("[challenge/write] challengeId =", challengeId);
    if (!challengeId) return;
    supabase
      .from("challenges")
      .select("id, title, category, emoji, status")
      .eq("id", challengeId)
      .maybeSingle()
      .then(({ data, error }) => {
        console.log("[challenge/write] challenges 조회", { data, error });
      });
  }, [challengeId]);

  return <BoardWriteShell boardTypeOverride="challenge" />;
}
