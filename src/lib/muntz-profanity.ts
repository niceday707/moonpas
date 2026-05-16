// ============================================================================
// 문츠(Muntz) — 등록 시 제목/설명 기본 금지어 필터
// ----------------------------------------------------------------------------
// ⚠️ 이건 1차 안전망일 뿐, 절대로 완전한 보호 수단이 아니다.
//    실제 영상 내용은 사람이 최종 검수하는 것이 원칙. (DECISIONS.md 참고)
//
// 차단 정책:
//  · 성적 콘텐츠 / 욕설 / 도박 / 약물 / 자해 관련 키워드 부분 매칭.
//  · 대소문자 무시. 영/한 혼용.
//  · 한국어는 받침 변형이 적은 어근 위주로 등록 — false positive 줄이기 위해
//    너무 짧은 단어("씨" 등)는 단어 경계가 모호해 제외.
//  · 회피용 자모 분리("ㅅㅂ" 등)는 1차에서 다루지 않음 — 후속 작업으로 미룸.
// ============================================================================

const BANNED_WORDS_KO = [
  // 욕설/비속어
  "씨발",
  "씨바",
  "시발",
  "병신",
  "병1신",
  "ㅄ",
  "좆",
  "좇",
  "존나",
  "지랄",
  "꺼져",
  "꺼지",
  "개새끼",
  "개색기",
  "개색끼",
  "미친놈",
  "미친년",
  "엿먹",
  "엿이나",
  // 성적
  "야동",
  "포르노",
  "섹스",
  "음란",
  "성관계",
  "노출",
  "야짤",
  // 도박
  "도박",
  "토토사이트",
  "사다리게임",
  "온라인카지노",
  // 약물
  "마약",
  "필로폰",
  "대마초",
  "마리화나",
  // 자해/자살 — 유도/조장 문맥 차단 (정보성/예방 단어는 다른 통로로)
  "자살방법",
  "자해방법",
  "동반자살",
];

const BANNED_WORDS_EN = [
  "porn",
  "xxx",
  "sex video",
  "nude",
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "casino",
  "marijuana",
  "cocaine",
  "heroin",
];

const ALL_BANNED = [...BANNED_WORDS_KO, ...BANNED_WORDS_EN];

/** 입력 문자열에서 차단어 발견 시 첫 번째 단어를 반환, 없으면 null. */
export function findBannedWord(input: string | null | undefined): string | null {
  if (!input) return null;
  const lower = input.toLowerCase();
  for (const w of ALL_BANNED) {
    if (lower.includes(w.toLowerCase())) return w;
  }
  return null;
}

/** 여러 필드를 한 번에 검사. */
export function findBannedWordInFields(
  fields: ReadonlyArray<string | null | undefined>,
): string | null {
  for (const f of fields) {
    const hit = findBannedWord(f);
    if (hit) return hit;
  }
  return null;
}
