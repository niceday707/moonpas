// 게시글 본문(content) 표시용 추출기.
//
//   여러 게시판이 content 컬럼에 JSON 문자열을 직렬화해 저장한다
//   ({"tag":"school","body":"..."}, {"condition":"...","description":"..."} 등).
//   상세 페이지에서는 boardType 별 parseXxxContent (in lib/board.ts) 로 구조화 렌더링하지만,
//   목록/프로필/검색 등 "한 줄 미리보기" 가 필요한 곳에서 raw JSON 이 그대로
//   노출되던 버그를 차단하기 위한 표시용 헬퍼.
//
//   원칙:
//     1) JSON 으로 보이지 않는 문자열은 그대로 반환 (성능 + 안전 폴백)
//     2) JSON 파싱 실패는 원본 반환
//     3) boardType 매칭에 실패해도 알려진 키(body / description / question / review)
//        를 우선 폴백, 최후엔 모든 string value 를 줄바꿈으로 합산
//     4) 새 글 작성/저장 로직과는 완전히 분리 — 표시 단계에서만 사용

import type { BoardType } from "@/lib/board";

/** content 가 JSON object 로 시작하는지 빠르게 판별 */
function looksLikeJsonObject(s: string): boolean {
  const t = s.trimStart();
  return t.length > 0 && t[0] === "{";
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/**
 * 본문 plain text 만 추출.
 *
 * - 상세 페이지의 일반 본문 영역 (구조화 렌더링이 없는 보드의 fallback) 에서 사용.
 * - 메타 정보(과목/일정/장소 등) 는 포함하지 않는다 — 호출 측에서 별도 카드로 렌더.
 */
export function extractPostBody(content: string, boardType?: BoardType): string {
  if (!content) return "";
  if (!looksLikeJsonObject(content)) return content;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content.trim());
  } catch {
    return content;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return content;
  }
  const o = parsed as Record<string, unknown>;

  // boardType 별 정확한 본문 필드
  switch (boardType) {
    case "anonymous": {
      const v = asString(o.body);
      if (v !== null) return v;
      break;
    }
    case "qa": {
      const v = asString(o.question);
      if (v !== null) return v;
      break;
    }
    case "senior": {
      // 상세에선 review 가 본문, summary 는 별도 인용 박스로 표시
      const v = asString(o.review);
      if (v !== null) return v;
      break;
    }
    case "market":
    case "lost":
    case "debate":
    case "youtube":
    case "resources":
    case "study":
    case "alumni": {
      const v = asString(o.description);
      if (v !== null) return v;
      break;
    }
    default:
      // free / notice / news / challenge / event_* 등은 보통 plain text.
      // 혹시 JSON 으로 저장돼 있으면 아래 폴백에서 처리.
      break;
  }

  // ── 알려진 키 우선순위 폴백 ───────────────────────────
  const fallback =
    asString(o.body) ??
    asString(o.description) ??
    asString(o.question) ??
    asString(o.review);
  if (fallback !== null) return fallback;

  // ── 최후의 수단: 모든 string value 를 줄바꿈으로 합산 ──
  const values: string[] = [];
  for (const v of Object.values(o)) {
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed) values.push(trimmed);
    }
  }
  return values.length > 0 ? values.join("\n") : content;
}

/**
 * 목록 카드 미리보기용 — 본문 + 보드별 메타 정보 합산 후 길이 제한 + "..." 말줄임.
 *
 *   - 스터디:   "{과목} · {일정} · {장소}" (description 없이 메타만 노출 — 한 눈에 정보 파악)
 *   - 선배후기: "{대학} · {학과} · {요약}"
 *   - 그 외:    extractPostBody 결과 그대로
 *
 *   기본 max=100, 모든 공백을 단일 스페이스로 정규화한다.
 */
export function extractPostPreview(
  content: string,
  options?: { boardType?: BoardType; max?: number },
): string {
  const max = options?.max ?? 100;
  const boardType = options?.boardType;

  let raw = "";

  // 메타 우선 보드 — JSON 이 정상 파싱되면 메타 합산을 먼저 시도
  if ((boardType === "study" || boardType === "senior") && looksLikeJsonObject(content)) {
    try {
      const parsed = JSON.parse(content.trim()) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const o = parsed as Record<string, unknown>;
        if (boardType === "study") {
          const parts = [
            asString(o.subject),
            asString(o.schedule),
            asString(o.location),
          ].filter((v): v is string => !!v && v.trim().length > 0);
          if (parts.length > 0) raw = parts.join(" · ");
        } else if (boardType === "senior") {
          const parts = [
            asString(o.university),
            asString(o.major),
            asString(o.summary),
          ].filter((v): v is string => !!v && v.trim().length > 0);
          if (parts.length > 0) raw = parts.join(" · ");
        }
      }
    } catch {
      /* 폴백으로 본문 추출 */
    }
  }

  if (!raw) raw = extractPostBody(content, boardType);

  const normalized = raw.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return normalized.slice(0, max).trimEnd() + "...";
}
