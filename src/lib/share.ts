// 게시글 공유 — Web Share API 사용, 미지원 시 클립보드 복사 폴백.
// 호출자가 토스트 메시지를 띄울 수 있도록 결과 종류를 반환한다.

const PROD_ORIGIN = "https://moonpas.kr";

/** 절대 URL 빌드 — moonpas.kr 도메인 고정 (공유 링크는 프로덕션 도메인이어야 함) */
export function buildPostShareUrl(boardType: string, postId: string): string {
  return `${PROD_ORIGIN}/board/${boardType}/${postId}`;
}

export type ShareResult =
  | { kind: "shared" }
  | { kind: "copied" }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

/** 글 공유 — 가능한 경우 navigator.share, 아니면 클립보드 복사 */
export async function sharePost(input: {
  title: string;
  text?: string;
  url: string;
}): Promise<ShareResult> {
  if (typeof navigator === "undefined") {
    return { kind: "error", message: "공유할 수 없는 환경이에요." };
  }

  const data = {
    title: input.title,
    text: input.text ?? input.title,
    url: input.url,
  };

  // Web Share API
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return { kind: "shared" };
    } catch (e) {
      // 사용자가 취소한 경우 — 에러로 다루지 않음
      const err = e as { name?: string };
      if (err?.name === "AbortError") return { kind: "cancelled" };
      // 그 외에는 클립보드 폴백 시도
    }
  }

  // 클립보드 복사
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(input.url);
      return { kind: "copied" };
    }
    // 더 이전 환경 — execCommand 폴백
    const ta = document.createElement("textarea");
    ta.value = input.url;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok
      ? { kind: "copied" }
      : { kind: "error", message: "복사에 실패했어요." };
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : "복사에 실패했어요.",
    };
  }
}
