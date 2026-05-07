// 문파스 샘플 게시글 시드 SQL 생성기 (일회성 스크립트)
//
// 사용법:
//   npx tsx scripts/seed-posts.ts > scripts/seed-posts.sql
//   → 생성된 SQL 파일 또는 stdout 출력 내용을 Supabase SQL Editor 에 붙여넣어 Run.
//
// 한 번만 실행하세요. 동일 글이 중복 생성될 수 있습니다.
// author_id 는 profiles 테이블에서 role='admin' 인 첫 번째 유저로 자동 매핑됩니다.

type Status = "active" | "resolved";
type Board = "free" | "notice" | "lost" | "market";

type SeedPost = {
  board: Board;
  title: string;
  /** 분실물/나눔장터는 JSON 문자열, 그 외는 일반 텍스트 (개행 허용) */
  content: string;
  isPinned?: boolean;
  status?: Status;
  /** ISO 8601 with timezone offset (KST = +09:00) */
  createdAt: string;
};

// 분실물 글 본문 — { location, lostDate, description } JSON 으로 구조화 저장
function lost(location: string, lostDate: string, description: string): string {
  return JSON.stringify({ location, lostDate, description });
}

// 나눔장터 글 본문 — { condition, description } JSON
function market(condition: string, description: string): string {
  return JSON.stringify({ condition, description });
}

const POSTS: SeedPost[] = [
  // ── 자유게시판 (5) ──────────────────────────────────────
  {
    board: "free",
    title: "급식 랭킹 TOP 5 (이견 받습니다)",
    content:
      "1위: 치킨까스 + 우동국물 조합\n" +
      "2위: 불닭볶음면 나오는 날\n" +
      "3위: 돈까스 (소스 넉넉할 때)\n" +
      "4위: 떡볶이 + 주먹밥\n" +
      "5위: 제육볶음\n\n" +
      "이견 있으신 분 댓글로 ㄱㄱ 급식실 아주머니 감사합니다 항상 🙏",
    createdAt: "2026-05-07T12:45:00+09:00",
  },
  {
    board: "free",
    title: "시험 기간 공부 장소 추천",
    content:
      "도서관은 너무 조용해서 졸리고, 교실은 시끄럽고...\n" +
      "제가 찾은 최고의 장소: 4층 빈 교실 (오후 5시 이후)\n" +
      "조용하면서도 적당히 사람 있어서 긴장감 유지됨\n\n" +
      "다른 꿀자리 있으면 공유해주세요 (제발 너무 많이 알려지진 말고...)",
    createdAt: "2026-05-06T19:20:00+09:00",
  },
  {
    board: "free",
    title: "자습시간에 졸지 않는 법 공유",
    content:
      "1. 찬물로 세수하기 (화장실 다녀온다고 하면 됨)\n" +
      "2. 손목 안쪽에 딱풀 바르기 (시원함)\n" +
      "3. 서서 공부하기 (진짜 효과 있음)\n" +
      "4. 옆자리 친구랑 서로 깨워주기 약속\n" +
      "5. 포기하고 10분만 자기 (솔직)\n\n" +
      "여러분의 꿀팁도 알려주세요 ㅋㅋㅋ",
    createdAt: "2026-05-04T22:10:00+09:00",
  },
  {
    board: "free",
    title: "우리 학교 벚꽃 명당 어디임?",
    content:
      "봄에 학교 벚꽃 진짜 예쁜데 사진 찍기 좋은 스팟 어디예요?\n" +
      "작년에 후문 쪽에서 찍었는데 올해는 다른 데서 찍고 싶어요\n" +
      "인스타 감성으로 찍을 수 있는 곳 추천 부탁!",
    createdAt: "2026-05-03T16:00:00+09:00",
  },
  {
    board: "free",
    title: "문태고 3년 생존 가이드 (선배가 알려줌)",
    content:
      "이제 곧 졸업이라 후배들한테 남기는 꿀팁:\n\n" +
      "📚 공부: 내신은 벼락치기 절대 안 됨. 2주 전부터 시작해야 3등급 이상 가능\n" +
      "🍚 급식: 4교시 끝나자마자 뛰어가면 줄 안 섬\n" +
      "👥 친구: 1학년 때 동아리 열심히 하면 타반 친구 많이 생김\n" +
      "🏫 시설: 3층 자판기가 제일 쌈\n\n" +
      "궁금한 거 있으면 댓글로 물어봐요!",
    createdAt: "2026-05-02T10:30:00+09:00",
  },

  // ── 공지사항 (4) ────────────────────────────────────────
  {
    board: "notice",
    title: "📢 2026학년도 1학기 중간고사 시간표 안내",
    content:
      "안녕하세요, 문태고등학교입니다.\n\n" +
      "2026학년도 1학기 중간고사 일정을 안내드립니다.\n\n" +
      "📅 시험 기간: 5월 19일(월) ~ 5월 22일(목)\n\n" +
      "[1학년]\n" +
      "5/19(월): 국어, 수학\n" +
      "5/20(화): 영어, 한국사\n" +
      "5/21(수): 통합과학, 통합사회\n" +
      "5/22(목): 체육(실기), 기술가정\n\n" +
      "[2학년]\n" +
      "5/19(월): 국어, 수학\n" +
      "5/20(화): 영어, 탐구선택1\n" +
      "5/21(수): 탐구선택2, 제2외국어\n" +
      "5/22(목): 진로선택, 체육(실기)\n\n" +
      "※ 시험 중 휴대폰 소지 적발 시 0점 처리됩니다.\n" +
      "※ 시험 시작 10분 전까지 착석해주세요.",
    isPinned: true,
    createdAt: "2026-05-07T09:00:00+09:00",
  },
  {
    board: "notice",
    title: "📢 급식실 이용 시간 변경 안내",
    content:
      "5월부터 급식실 이용 시간이 변경됩니다.\n\n" +
      "🕐 점심시간\n" +
      "- 1학년: 12:10 ~ 12:40\n" +
      "- 2학년: 12:20 ~ 12:50\n" +
      "- 3학년: 12:00 ~ 12:30 (우선 배식)\n\n" +
      "🕐 석식 (야자 신청자)\n" +
      "- 전학년: 17:30 ~ 18:10\n\n" +
      "급식실 내 음식물 반입 금지, 잔반 줄이기 캠페인 진행 중입니다.\n" +
      "맛있게 먹고 깨끗이 정리해주세요! 🍽️",
    isPinned: true,
    createdAt: "2026-05-06T11:00:00+09:00",
  },
  {
    board: "notice",
    title: "동아리 박람회 개최 안내 (5/26)",
    content:
      "2026학년도 동아리 박람회가 열립니다!\n\n" +
      "📅 일시: 5월 26일(월) 5~6교시\n" +
      "📍 장소: 체육관\n\n" +
      "총 32개 동아리가 부스를 운영하며, 각 동아리 체험과 설명을 들을 수 있습니다.\n\n" +
      "🎯 인기 동아리 미리보기:\n" +
      "- 코딩동아리 'BYTE' - AI 체험\n" +
      "- 밴드부 'Resonance' - 미니 공연\n" +
      "- 봉사동아리 '나눔' - 활동 사진전\n" +
      "- 독서토론 '책벌레' - 북퀴즈 이벤트\n\n" +
      "신입부원 모집도 동시 진행! 많은 참여 바랍니다.",
    createdAt: "2026-05-05T14:00:00+09:00",
  },
  {
    board: "notice",
    title: "도서관 이용 안내 및 희망도서 신청",
    content:
      "학교 도서관 이용 안내입니다.\n\n" +
      "📚 운영시간\n" +
      "- 평일: 08:00 ~ 18:00\n" +
      "- 야자시간: 19:00 ~ 21:00 (사서 선생님 부재, 자율이용)\n\n" +
      "📖 대출 규정\n" +
      "- 1인 3권, 14일간\n" +
      "- 연체 시 연체일수만큼 대출 정지\n\n" +
      "💡 희망도서 신청\n" +
      "도서관 앞 신청함 또는 사서 선생님께 직접 신청 가능합니다.\n" +
      "이번 달 인기 신청 도서: '역행자', '트렌드 코리아 2026', '아몬드'\n\n" +
      "많이 이용해주세요! 📖",
    createdAt: "2026-05-02T13:30:00+09:00",
  },

  // ── 분실물센터 (4) ──────────────────────────────────────
  {
    board: "lost",
    title: "에어팟 프로 분실 ㅠㅠ",
    content: lost(
      "3층 과학실 부근",
      "2026-05-05",
      "검정색 에어팟 프로 케이스입니다. 뒤에 곰돌이 스티커 붙어있어요. 3층 과학실에서 수업 듣고 나서 없어진 것 같아요. 찾으시면 제발 연락주세요 ㅠㅠ 이름 새겨져 있습니다.",
    ),
    status: "active",
    createdAt: "2026-05-05T16:30:00+09:00",
  },
  {
    board: "lost",
    title: "체육복 상의 분실",
    content: lost(
      "운동장 벤치",
      "2026-05-06",
      "문태고 체육복 상의 (L사이즈)입니다. 이름표에 2학년 3반으로 되어있어요. 체육시간 끝나고 벤치에 놓고 갔는데 돌아와보니 없어졌어요. 혹시 실수로 가져가신 분 있으면 알려주세요!",
    ),
    status: "active",
    createdAt: "2026-05-06T17:00:00+09:00",
  },
  {
    board: "lost",
    title: "텀블러 찾았어요! (1층 로비)",
    content: lost(
      "1층 로비 벤치",
      "2026-05-04",
      "초록색 스타벅스 텀블러 1층 로비에서 발견했습니다. 교무실에 맡겨놨어요. 주인 찾습니다!",
    ),
    status: "resolved",
    createdAt: "2026-05-04T12:30:00+09:00",
  },
  {
    board: "lost",
    title: "우산 분실 (접이식 자동우산)",
    content: lost(
      "2층 교실 우산꽂이",
      "2026-05-03",
      "네이비 접이식 자동우산이에요. 비오는 날 2층 우산꽂이에 꽂아놨는데 하교할 때 없어졌어요. 혹시 비슷한 거 잘못 가져가신 분 계시면 댓글 남겨주세요~",
    ),
    status: "active",
    createdAt: "2026-05-03T15:00:00+09:00",
  },

  // ── 나눔장터 (4) ────────────────────────────────────────
  {
    board: "market",
    title: "수학 문제집 나눔합니다 (쎈 수학 상)",
    content: market(
      "사용감 있음",
      "작년에 썼던 쎈 수학 상입니다. 연필 풀이 있지만 깨끗한 편이에요. 답지도 있습니다. 1학년 수학 준비하는 후배한테 도움 되면 좋겠어요! 교실 앞에서 직접 전달 가능합니다.",
    ),
    status: "active",
    createdAt: "2026-05-07T18:00:00+09:00",
  },
  {
    board: "market",
    title: "실내화 나눔 (250mm, 거의 새거)",
    content: market(
      "새상품",
      "사이즈 안 맞아서 한 번 신고 나눔합니다. 250mm 흰색 실내화예요. 거의 새 거랑 다름없어요. 필요하신 분 댓글 남겨주세요!",
    ),
    status: "active",
    createdAt: "2026-05-06T14:30:00+09:00",
  },
  {
    board: "market",
    title: "국어 자습서 나눔완료",
    content: market(
      "사용감 있음",
      "비상 국어 자습서 나눔 완료되었습니다. 관심 가져주신 분들 감사해요! 🙏",
    ),
    status: "resolved",
    createdAt: "2026-05-04T11:00:00+09:00",
  },
  {
    board: "market",
    title: "USB 8GB 나눔 (3개)",
    content: market(
      "사용감 많음",
      "서랍 정리하다가 나온 USB 8GB 3개입니다. 오래됐지만 작동은 잘 돼요. 과제 제출용으로 쓰기 좋습니다. 필요하신 분 선착순! 1층 매점 앞에서 드려요.",
    ),
    status: "active",
    createdAt: "2026-05-03T13:00:00+09:00",
  },
];

// E'...' literal 용 이스케이프: 백슬래시, 작은따옴표, 개행 처리
function escEStr(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

function literal(s: string): string {
  return `E'${escEStr(s)}'`;
}

function rowSql(p: SeedPost): string {
  const pinned = p.isPinned ?? false;
  const status: Status = p.status ?? "active";
  return [
    "  ((SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)",
    `'${p.board}'`,
    literal(p.title),
    literal(p.content),
    String(pinned),
    `'${status}'`,
    `'${p.createdAt}'::timestamptz)`,
  ].join(", ");
}

function main(): void {
  const lines = [
    "-- 문파스 샘플 게시글 시드 (총 " + POSTS.length + "개)",
    "-- 사전 준비: posts 테이블에 is_pinned (boolean), status (text) 컬럼이 있어야 합니다.",
    "-- 한 번만 실행하세요. 재실행 시 동일 글이 중복 삽입됩니다.",
    "",
    "INSERT INTO public.posts (author_id, board_type, title, content, is_pinned, status, created_at)",
    "VALUES",
    POSTS.map(rowSql).join(",\n"),
    ";",
  ];
  process.stdout.write(lines.join("\n") + "\n");
}

main();
