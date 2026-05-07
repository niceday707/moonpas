// 단순 게시판(이슈토론·QnA·졸업생·선배후기·문태뉴스) 시드 데이터.
// Supabase 연동 시 이 파일의 배열을 board_posts 테이블 쿼리로 교체하면 된다.
//
// 댓글은 mock-data.ts 의 통합 COMMENTS 배열에서 `${board}:${id}` 형태로 관리된다.

import type { Author } from "./mock-data";

export type BoardKey = "debate" | "qna" | "alumni" | "reviews" | "news";

export type BoardPost = {
  id: string;
  board: BoardKey;
  /** 글 제목 (선택) — 없으면 본문만 노출 */
  title?: string;
  content: string;
  author: Author;
  createdAt: string;
  /** 카드 우상단에 노출할 메타 텍스트 (예: "수학 · 미적분", "고려대 경영학과") */
  meta?: string;
  /** 익명 게시 여부. true 면 작성자 정보를 숨기고 "익명{anonymousId}" 로 표시 */
  anonymous?: boolean;
  anonymousId?: number;
};

// ─────────────────────────────────────────────
// 작성자 — mock-data 와 동일한 시드 사용
// ─────────────────────────────────────────────

const A: Record<string, Author> = {
  // ME — mock-data 의 AUTHORS.kimminsu 와 동일한 사용자(u-kimminsu).
  // 닉네임은 profile 스토어가 setMyNickname 으로 mock-data 쪽 ME 만 갱신하므로,
  // 여기서는 기본 닉네임을 동일한 값으로 시드한다. (학번/실명은 관리자 전용)
  kimminsu: { id: "u-kimminsu", name: "김민준", realName: "김민수", role: "student", className: "3-2" },
  jeongyeeun: { id: "u-jeongyeeun", name: "정예은", role: "student", className: "2-4" },
  leejunho: { id: "u-leejunho", name: "이준호", role: "student", className: "3-5" },
  kanghyerin: { id: "u-kanghyerin", name: "강혜린", role: "student", className: "1-3" },
  parkteacher: { id: "u-parkteacher", name: "박선생", role: "teacher", department: "교무부" },
  hanteacher: { id: "u-hanteacher", name: "한지훈", role: "teacher", department: "수학과" },
  choihaneul: { id: "u-choihaneul", name: "최하늘", role: "alumni", graduationYear: 2024 },
  yangjihoon: { id: "u-yangjihoon", name: "양지훈", role: "alumni", graduationYear: 2018 },
  leesujin: { id: "u-leesujin", name: "이수진", role: "parent" },
};

const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

// ─────────────────────────────────────────────
// 보드별 시드 글
// ─────────────────────────────────────────────

export const DEBATE_POSTS: BoardPost[] = [
  {
    id: "d-001",
    board: "debate",
    title: "야간자율학습 의무 vs 자율 — 어떻게 생각하세요?",
    content:
      "현재 우리 학교는 평일 야자가 사실상 의무인데요, 자율로 바꾸자는 의견이 학생회에서 나왔어요. 자기주도 학습 시간을 학생이 스스로 선택할 수 있어야 한다는 입장과, 의무가 있어야 학습 분위기가 유지된다는 입장이 갈리는 것 같아요. 여러분 생각은 어떠세요?",
    author: A.jeongyeeun,
    createdAt: hoursAgo(3),
    meta: "찬반토론",
  },
  {
    id: "d-002",
    board: "debate",
    title: "교복 자율화, 시범 운영 어떻게 할까요?",
    content:
      "다음 학기부터 한 달간 교복 자율화 시범 운영을 검토 중이라고 들었어요. 사복 등교가 가능해지면 학생 개성 표현이 좋아진다는 의견과, 빈부 격차가 드러난다는 우려가 함께 있는데요. 시범 기간 동안 어떤 룰을 두면 좋을까요?",
    author: A.leejunho,
    createdAt: hoursAgo(8),
    meta: "찬반토론",
  },
  {
    id: "d-003",
    board: "debate",
    title: "수능 정시 vs 학종 — 입시 비중 변화에 대해",
    content:
      "2028 대입 개편안 발표 이후 정시·학종 비중이 어떻게 갈지 관심이 많은데요. 우리 입장에서 어느 쪽이 더 공정하다고 느끼는지 의견이 궁금합니다. 단순 정답이 없는 문제이지만 함께 이야기해 봐요.",
    author: A.parkteacher,
    createdAt: daysAgo(1),
    meta: "사회이슈",
  },
];

export const QNA_POSTS: BoardPost[] = [
  {
    id: "q-001",
    board: "qna",
    title: "미적분 — y = x² + 3x + 2 미분 어떻게 하나요?",
    content:
      "기본 미분 공식만 외워두긴 했는데, 막상 풀려고 하니 막혀요. 풀이 과정을 step-by-step으로 알려주실 수 있는 분 계실까요?",
    author: A.kimminsu,
    createdAt: hoursAgo(3),
    meta: "수학 · 미적분",
  },
  {
    id: "q-002",
    board: "qna",
    title: "영어 비문학 지문, 시간 안에 푸는 팁 있나요?",
    content:
      "모의고사 영어에서 비문학에 너무 시간이 많이 걸려요. 글의 구조를 먼저 보는 게 좋다고 들었는데 잘 안 되네요. 선배님들 어떻게 푸셨나요?",
    author: A.kanghyerin,
    createdAt: hoursAgo(5),
    meta: "영어 · 독해",
  },
  {
    id: "q-003",
    board: "qna",
    title: "물리1 — 등가속도 운동 그래프 해석 헷갈려요",
    content:
      "v-t 그래프에서 면적이 이동거리라는 건 알겠는데, 가속도가 음수일 때 헷갈려요. 어느 부분에서 방향이 바뀌는지 판단하는 기준이 뭔가요?",
    author: A.leejunho,
    createdAt: hoursAgo(2),
    meta: "물리 · 역학",
  },
];

export const ALUMNI_POSTS: BoardPost[] = [
  {
    id: "a-001",
    board: "alumni",
    title: "후배들에게 — 고3 1년을 돌아보며",
    content:
      "졸업한 지 2년 정도 됐는데, 지금 와서 보니 고3 때 배운 건 공부보다 ‘끝까지 버티는 힘’이었어요. 점수에 일희일비하지 말고, 매일 할 분량을 꾸준히 채워나가는 습관이 결국 결과를 만듭니다. 후배들 모두 화이팅!",
    author: A.choihaneul,
    createdAt: hoursAgo(6),
    meta: "졸업생 응원 · 24기",
  },
  {
    id: "a-002",
    board: "alumni",
    title: "디자인·창업 진로 고민 있으면 편하게 물어보세요",
    content:
      "18기 양지훈입니다. 졸업 후 디자인 스튜디오 다니다가 작년에 작은 브랜드를 시작했어요. 진로가 헷갈리는 후배들 있으면 댓글이나 DM 환영합니다. 비전공자도 디자인 쪽 진입이 충분히 가능하다는 점, 꼭 알려주고 싶어요.",
    author: A.yangjihoon,
    createdAt: hoursAgo(10),
    meta: "진로 멘토링 · 18기",
  },
  {
    id: "a-003",
    board: "alumni",
    title: "동창회 모임 안내 (24기)",
    content:
      "24기 동창회 모임을 5월 마지막 주 토요일에 진행할 예정입니다. 학교 근처에서 진행되니 시간 되시는 분들은 참여 부탁드려요. 자세한 내용은 단톡방에서 안내합니다.",
    author: A.choihaneul,
    createdAt: daysAgo(2),
    meta: "동창회",
  },
];

export const REVIEWS_POSTS: BoardPost[] = [
  {
    id: "r-001",
    board: "reviews",
    title: "고려대 경영학과 합격 수기 (수시 학종)",
    content:
      "내신 1.4, 동아리 활동을 마케팅 쪽으로 몰아서 정리했어요. 자소서는 ‘본인이 만든 콘텐츠가 어떤 변화를 만들었는지’를 중심으로 썼고, 면접에서도 같은 흐름으로 답변을 준비했습니다. 궁금한 거 있으면 댓글 남겨주세요.",
    author: A.choihaneul,
    createdAt: hoursAgo(4),
    meta: "고려대 · 경영학과",
  },
  {
    id: "r-002",
    board: "reviews",
    title: "서울대 공대 정시 — 수능 점수 분석",
    content:
      "정시로 진학한 케이스인데, 국·수·영·과 비율과 본인 약점 분석이 중요했어요. 특히 N제 풀이 양보다 ‘틀린 문제 다시 풀이’가 점수 상승의 핵심이었던 것 같아요. 자세한 공부 루틴은 댓글에서 공유할게요.",
    author: A.yangjihoon,
    createdAt: hoursAgo(7),
    meta: "서울대 · 공과대학",
  },
  {
    id: "r-003",
    board: "reviews",
    title: "예체능(시각디자인) 입시 — 실기와 내신 동시에 챙긴 후기",
    content:
      "실기 비중이 큰 학과지만 내신을 일정 수준으로 유지해야 입시 폭이 넓어져요. 학원 시간을 어떻게 활용했고, 학교 시험 기간엔 실기를 어떻게 줄였는지 시간표 위주로 정리해 봤어요.",
    author: A.choihaneul,
    createdAt: daysAgo(2),
    meta: "예체능 · 시각디자인",
  },
];

export const NEWS_POSTS: BoardPost[] = [
  {
    id: "n-001",
    board: "news",
    title: "2026 봄 축제 ‘문태페스타’ 일정 공개",
    content:
      "5월 30일(토) 본관 운동장에서 문태페스타가 열립니다. 동아리 부스 30여 개와 무대 공연이 준비되고 있어요. 관람은 학생·학부모 누구나 무료입니다. 자세한 일정은 학생회 채널에서 안내합니다.",
    author: A.parkteacher,
    createdAt: hoursAgo(2),
    meta: "학교행사",
  },
  {
    id: "n-002",
    board: "news",
    title: "수학 올림피아드 도교육청 대회 — 본교 3명 입상",
    content:
      "지난 주 도교육청 주최 수학 올림피아드에서 우리 학교 학생 3명이 입상했습니다. 금상 1명, 은상 2명으로 다음 달 전국대회에 진출합니다. 모두 축하해 주세요!",
    author: A.hanteacher,
    createdAt: hoursAgo(8),
    meta: "수상소식",
  },
  {
    id: "n-003",
    board: "news",
    title: "동아리 ‘영상제작부’ 단편영화제 본선 진출",
    content:
      "영상제작부가 청소년 단편영화제 본선에 진출했습니다. 6월 둘째 주 시상식이 열릴 예정이며, 본선 진출작은 학교 홈페이지에서 곧 공개됩니다.",
    author: A.parkteacher,
    createdAt: daysAgo(1),
    meta: "동아리",
  },
];

export const BOARD_POSTS: Record<BoardKey, BoardPost[]> = {
  debate: DEBATE_POSTS,
  qna: QNA_POSTS,
  alumni: ALUMNI_POSTS,
  reviews: REVIEWS_POSTS,
  news: NEWS_POSTS,
};
