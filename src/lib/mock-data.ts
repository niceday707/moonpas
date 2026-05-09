// 더미 데이터 + 데이터 fetching 레이어
// Supabase 연동 시 이 파일의 함수들을 실제 API 호출로 교체하면 됩니다.
// 모든 fetch 함수는 Promise를 반환하도록 설계되어 있습니다.

import type { Role } from "@/components/ui/Badge";

export type { Role };

export type Channel = "free" | "curriculum" | "admissions" | "alumni" | "notice";

export const CHANNEL_LABEL: Record<Channel, string> = {
  free: "자유게시판",
  curriculum: "교육과정 가이드",
  admissions: "2028 대입 정보",
  alumni: "졸업생 방명록",
  notice: "공지사항",
};

export type Author = {
  id: string;
  /** 화면에 노출되는 닉네임 */
  name: string;
  role: Role;
  /** 졸업생: 졸업연도 */
  graduationYear?: number;
  /** 학생: 학반 (예: "3-2") — 관리자 페이지에서만 노출, 일반 UI 비공개 */
  className?: string;
  /** 교사: 담당 (예: "수학과") — 관리자 페이지에서만 노출 */
  department?: string;
  /** 실명 — 관리자 전용. 일반 UI에는 절대 표시하지 않음 */
  realName?: string;
  /** 학번 — 관리자 전용 */
  studentId?: string;
  /** 프로필 이미지(데이터 URL 또는 절대 URL). 없으면 이니셜 아바타 */
  imageUrl?: string | null;
};

export type Post = {
  id: string;
  author: Author;
  content: string;
  hashtags: string[];
  channel: Channel;
  /** ISO timestamp */
  createdAt: string;
  likes: number;
  liked: boolean;
  commentCount: number;
  /** 익명 게시 여부. true 면 작성자 정보를 숨기고 "익명{anonymousId}" 로 표시 */
  anonymous?: boolean;
  /** 익명 글에 부여되는 표시 번호 (예: 23 → "익명23") */
  anonymousId?: number;
};

/**
 * 댓글이 달리는 대상 식별자.
 *  - "feed:p-001"          (자유게시판 글)
 *  - "notice:notice-001"   (공지사항)
 *  - "lost:1" / "share:1"  (분실물 / 나눔)
 *  - "debate:d-001" 등     (이슈토론·QnA·졸업생·후기·뉴스 보드 글)
 * 보드별 prefix를 두면 한 테이블에서 전체 댓글을 관리할 수 있다.
 */
export type CommentTarget = string;

export type Comment = {
  id: string;
  /** 댓글이 달리는 대상 식별자 */
  targetId: CommentTarget;
  /** 대댓글이면 부모 댓글 id (없으면 최상위 댓글) */
  parentId?: string;
  author: Author;
  content: string;
  createdAt: string;
  likes: number;
  liked: boolean;
  /** 익명 댓글 여부 — 작성자 정보를 숨기고 "익명{anonymousId}" 로 표시 */
  anonymous?: boolean;
  anonymousId?: number;
};

export type Sort = "latest" | "likes" | "comments";

// ─────────────────────────────────────────────
// 작성자 시드
// ─────────────────────────────────────────────

// 작성자(=사용자) 시드.
// 일반 UI에는 author.name(닉네임)과 role 만 노출되며,
// realName/studentId/className/department 같은 식별 정보는 관리자 페이지 전용이다.
const AUTHORS: Record<string, Author> = {
  // 개발 모드의 "나" — 닉네임은 profile 스토어를 통해 변경되면 setMyNickname() 으로 동기화됨
  kimminsu: {
    id: "u-kimminsu",
    name: "",
    realName: "김민수",
    studentId: "10302",
    role: "student",
    className: "3-2",
    imageUrl: null,
  },
  jeongyeeun: { id: "u-jeongyeeun", name: "정예은", realName: "정예은", role: "student", className: "2-4" },
  leejunho: { id: "u-leejunho", name: "이준호", realName: "이준호", role: "student", className: "3-5" },
  kanghyerin: { id: "u-kanghyerin", name: "강혜린", realName: "강혜린", role: "student", className: "1-3" },
  parkteacher: { id: "u-parkteacher", name: "박선생", realName: "박선영", role: "teacher", department: "교무부" },
  hanteacher: { id: "u-hanteacher", name: "한지훈", realName: "한지훈", role: "teacher", department: "수학과" },
  leesujin: { id: "u-leesujin", name: "이수진", realName: "이수진", role: "parent" },
  kimsoyoung: { id: "u-kimsoyoung", name: "김소영", realName: "김소영", role: "parent" },
  choihaneul: { id: "u-choihaneul", name: "최하늘", realName: "최하늘", role: "alumni", graduationYear: 2024 },
  yangjihoon: { id: "u-yangjihoon", name: "양지훈", realName: "양지훈", role: "alumni", graduationYear: 2018 },
};

/** 현재 로그인 사용자 (글쓰기·댓글 작성자).
 *  객체 참조이므로 setMyNickname/setMyProfileImage 로 변경 시
 *  POSTS·COMMENTS 안에 박혀있는 작성자 표시도 함께 갱신된다. */
export const ME: Author = AUTHORS.kimminsu;

/** 프로필 스토어 → ME 닉네임 동기화. 호출 후 구독자에게 변경 알림. */
export function setMyNickname(nickname: string): void {
  ME.name = nickname;
  notify();
}

/** 프로필 스토어 → ME 프로필 이미지 동기화 */
export function setMyProfileImage(imageUrl: string | null): void {
  ME.imageUrl = imageUrl;
  notify();
}

// ─────────────────────────────────────────────
// 시간 헬퍼 — 모듈 로드 시점을 기준으로 상대 시간 ISO 생성
// ─────────────────────────────────────────────

const NOW = Date.now();
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

// ─────────────────────────────────────────────
// 게시글 시드 (10개) — 역할별로 골고루
// ─────────────────────────────────────────────

let POSTS: Post[] = [
  {
    id: "p-001",
    author: AUTHORS.kimminsu,
    content: "이번 중간고사 수학 범위 아시는 분? #시험정보",
    hashtags: ["시험정보"],
    channel: "free",
    createdAt: minutesAgo(4),
    likes: 14,
    liked: false,
    commentCount: 6,
  },
  {
    id: "p-002",
    author: AUTHORS.parkteacher,
    content:
      "2028 대입 설명회 다음 주 수요일 4시입니다. 강당에서 만나요! 학년·계열 상관없이 누구나 환영입니다. 자료는 미리 채널에 공유해 두었으니 한 번씩 훑어보고 와주세요. #공지 #2028대입",
    hashtags: ["공지", "2028대입"],
    channel: "notice",
    createdAt: minutesAgo(35),
    likes: 87,
    liked: true,
    commentCount: 22,
  },
  {
    id: "p-003",
    author: AUTHORS.leesujin,
    content: "학부모 상담 신청은 어디서 하나요? #학부모상담",
    hashtags: ["학부모상담"],
    channel: "free",
    createdAt: hoursAgo(1),
    likes: 5,
    liked: false,
    commentCount: 3,
  },
  {
    id: "p-004",
    author: AUTHORS.choihaneul,
    content:
      "후배들아 화이팅! 대학 와서 보니 고등학교 때 열심히 한 게 다 도움이 돼. 그때는 지겹기만 했던 자습 시간, 지금 돌아보면 그게 진짜 자산이더라. 너무 결과에만 매달리지 말고, 지금 곁에 있는 친구들이랑 보내는 시간도 챙겨. #졸업생응원",
    hashtags: ["졸업생응원"],
    channel: "alumni",
    createdAt: hoursAgo(2),
    likes: 142,
    liked: true,
    commentCount: 31,
  },
  {
    id: "p-005",
    author: AUTHORS.jeongyeeun,
    content: "동아리 축제 준비하는데 같이 할 사람? 영상 편집이나 무대 디자인 가능한 분 환영! #동아리 #축제",
    hashtags: ["동아리", "축제"],
    channel: "free",
    createdAt: hoursAgo(3),
    likes: 28,
    liked: false,
    commentCount: 12,
  },
  {
    id: "p-006",
    author: AUTHORS.hanteacher,
    content:
      "이번 주 수학 보충 시간에 미적분 II 단원 정리해 줄 거예요. 평소에 헷갈렸던 부분 댓글로 미리 남겨주면 자료에 반영할게요. #수업안내 #수학",
    hashtags: ["수업안내", "수학"],
    channel: "curriculum",
    createdAt: hoursAgo(5),
    likes: 46,
    liked: false,
    commentCount: 18,
  },
  {
    id: "p-007",
    // 익명 글 데모 — UI 에는 "익명23" 으로만 노출되고 작성자 정보는 숨겨진다.
    author: AUTHORS.leejunho,
    anonymous: true,
    anonymousId: 23,
    content: "오늘 야자 끝나고 학교 앞 분식집 같이 갈 사람 구해요 ㅠㅠ #야자 #같이가요",
    hashtags: ["야자", "같이가요"],
    channel: "free",
    createdAt: hoursAgo(7),
    likes: 19,
    liked: false,
    commentCount: 9,
  },
  {
    id: "p-008",
    author: AUTHORS.kimsoyoung,
    content:
      "다음 주 학부모 총회 안건 받습니다. 급식 메뉴, 학교 주변 안전, 야자 운영 등 의논하고 싶은 주제 있으면 댓글로 알려주세요. #학부모총회",
    hashtags: ["학부모총회"],
    channel: "free",
    createdAt: daysAgo(1),
    likes: 31,
    liked: false,
    commentCount: 14,
  },
  {
    id: "p-009",
    author: AUTHORS.yangjihoon,
    content:
      "방명록에 글 남기러 왔어요. 18기 양지훈입니다. 진로 고민 있는 후배들, 댓글이나 DM으로 편하게 물어봐도 좋아요. 디자인·창업 쪽 경험 공유해 줄 수 있어요. #졸업생응원 #진로",
    hashtags: ["졸업생응원", "진로"],
    channel: "alumni",
    createdAt: daysAgo(2),
    likes: 73,
    liked: false,
    commentCount: 27,
  },
  {
    id: "p-010",
    author: AUTHORS.kanghyerin,
    content: "도서관에서 같이 공부할 스터디원 모집해요. 평일 7-9시, 수학·영어 위주로! #스터디 #신청받음",
    hashtags: ["스터디", "신청받음"],
    channel: "free",
    createdAt: daysAgo(3),
    likes: 22,
    liked: false,
    commentCount: 8,
  },
];

// ─────────────────────────────────────────────
// 댓글 시드
// ─────────────────────────────────────────────

let COMMENTS: Comment[] = [
  // ─── 자유게시판 (feed) ───
  { id: "c-feed-001", targetId: "feed:p-001", author: AUTHORS.jeongyeeun, content: "수I 1~3단원이랑 수II 1단원 일부래!", createdAt: minutesAgo(3), likes: 8, liked: false },
  { id: "c-feed-002", targetId: "feed:p-001", author: AUTHORS.hanteacher, content: "정확히는 수II 함수의 극한 직전까지입니다 :)", createdAt: minutesAgo(2), likes: 14, liked: true },
  { id: "c-feed-003", targetId: "feed:p-001", parentId: "c-feed-002", author: AUTHORS.leejunho, content: "선생님 감사합니다 🙏", createdAt: minutesAgo(1), likes: 3, liked: false },
  { id: "c-feed-004", targetId: "feed:p-001", parentId: "c-feed-002", author: AUTHORS.kimminsu, content: "함수의 극한도 빼주세요 ㅎㅎ", createdAt: minutesAgo(1), likes: 5, liked: false },

  { id: "c-feed-005", targetId: "feed:p-002", author: AUTHORS.kimsoyoung, content: "학부모도 참석 가능한가요?", createdAt: minutesAgo(30), likes: 2, liked: false },
  { id: "c-feed-006", targetId: "feed:p-002", parentId: "c-feed-005", author: AUTHORS.parkteacher, content: "네 학부모님 환영합니다!", createdAt: minutesAgo(28), likes: 6, liked: false },
  { id: "c-feed-007", targetId: "feed:p-002", author: AUTHORS.kanghyerin, content: "1학년인데 가도 되나요?", createdAt: minutesAgo(20), likes: 1, liked: false },

  { id: "c-feed-008", targetId: "feed:p-003", author: AUTHORS.parkteacher, content: "상담은 학교 홈페이지 → 학부모상담 메뉴에서 신청하실 수 있어요.", createdAt: minutesAgo(50), likes: 4, liked: false },

  { id: "c-feed-009", targetId: "feed:p-004", author: AUTHORS.kimminsu, content: "선배님 말씀 새겨들을게요!", createdAt: hoursAgo(1), likes: 12, liked: false },
  { id: "c-feed-010", targetId: "feed:p-004", author: AUTHORS.jeongyeeun, content: "감동이에요 ㅜㅜ", createdAt: hoursAgo(1), likes: 9, liked: true },

  { id: "c-feed-011", targetId: "feed:p-005", author: AUTHORS.kanghyerin, content: "영상 편집 가능합니다!", createdAt: hoursAgo(2), likes: 4, liked: false },
  { id: "c-feed-012", targetId: "feed:p-005", parentId: "c-feed-011", author: AUTHORS.jeongyeeun, content: "와 너무 든든해요 ㅎㅎ DM 드릴게요!", createdAt: hoursAgo(2), likes: 2, liked: false },
  { id: "c-feed-013", targetId: "feed:p-005", author: AUTHORS.leejunho, content: "무대 디자인 도와드려요", createdAt: hoursAgo(2), likes: 3, liked: false },

  { id: "c-feed-014", targetId: "feed:p-006", author: AUTHORS.kimminsu, content: "삼각함수 적분이 헷갈려요", createdAt: hoursAgo(4), likes: 5, liked: false },

  { id: "c-feed-015", targetId: "feed:p-009", author: AUTHORS.kanghyerin, content: "디자인 진로 고민 중인데 한번 여쭤봐도 될까요?", createdAt: daysAgo(1), likes: 6, liked: false },

  // ─── 공지사항 (notice) ───
  { id: "c-notice-001", targetId: "notice:notice-001", author: AUTHORS.kimminsu, content: "1학년인데 시험 시간표 어디서 자세히 볼 수 있나요?", createdAt: minutesAgo(15), likes: 2, liked: false },
  { id: "c-notice-002", targetId: "notice:notice-001", parentId: "c-notice-001", author: AUTHORS.parkteacher, content: "첨부파일 PDF 확인하시면 됩니다 :)", createdAt: minutesAgo(10), likes: 5, liked: false },
  { id: "c-notice-003", targetId: "notice:notice-001", author: AUTHORS.leesujin, content: "수험표는 따로 발급되나요?", createdAt: minutesAgo(8), likes: 1, liked: false },
  { id: "c-notice-004", targetId: "notice:notice-002", author: AUTHORS.kimsoyoung, content: "5월 18일까지 신청 잊지 마세요!", createdAt: hoursAgo(2), likes: 8, liked: true },
  { id: "c-notice-005", targetId: "notice:notice-003", author: AUTHORS.jeongyeeun, content: "도서관 사서 보조 신청 완료했어요 ㅎㅎ", createdAt: hoursAgo(3), likes: 4, liked: false },
  { id: "c-notice-006", targetId: "notice:notice-006", author: AUTHORS.leejunho, content: "보충수업 신청했습니다! 자료 미리 받을 수 있을까요?", createdAt: daysAgo(1), likes: 3, liked: false },
  { id: "c-notice-007", targetId: "notice:notice-006", parentId: "c-notice-006", author: AUTHORS.hanteacher, content: "수업 당일 무료로 배부합니다 :)", createdAt: daysAgo(1), likes: 2, liked: false },

  // ─── 분실물·나눔장터 ───
  { id: "c-lost-001", targetId: "lost:1", author: AUTHORS.jeongyeeun, content: "혹시 케이스 색깔 자세한 사진 있으세요?", createdAt: minutesAgo(45), likes: 1, liked: false },
  { id: "c-lost-002", targetId: "lost:1", parentId: "c-lost-001", author: AUTHORS.kimminsu, content: "흰색 케이스에 보라색 스티커 붙어있어요!", createdAt: minutesAgo(40), likes: 2, liked: false },
  { id: "c-lost-003", targetId: "lost:2", author: AUTHORS.leejunho, content: "체육관 분실물함에 비슷한 거 있던데 한번 보세요", createdAt: hoursAgo(5), likes: 3, liked: false },
  { id: "c-share-001", targetId: "share:1", author: AUTHORS.kanghyerin, content: "혹시 아직 남았나요? 받고 싶어요!", createdAt: hoursAgo(1), likes: 0, liked: false },
  { id: "c-share-002", targetId: "share:2", author: AUTHORS.jeongyeeun, content: "프린트 어디서 받을 수 있나요?", createdAt: hoursAgo(2), likes: 1, liked: false },
  { id: "c-share-003", targetId: "share:2", parentId: "c-share-002", author: AUTHORS.parkteacher, content: "교무실로 점심 시간에 오세요 :)", createdAt: hoursAgo(2), likes: 4, liked: false },

  // ─── 이슈토론 (debate) ───
  { id: "c-debate-001", targetId: "debate:d-001", author: AUTHORS.kanghyerin, content: "찬성합니다. 자기주도 학습 시간이 더 필요해요.", createdAt: hoursAgo(1), likes: 12, liked: true },
  { id: "c-debate-002", targetId: "debate:d-001", parentId: "c-debate-001", author: AUTHORS.leejunho, content: "저는 반대예요. 야자가 없으면 집중이 안 돼요.", createdAt: minutesAgo(45), likes: 7, liked: false },
  { id: "c-debate-003", targetId: "debate:d-001", author: AUTHORS.parkteacher, content: "양쪽 의견 모두 일리 있어요. 학교 차원에서도 고민 중입니다.", createdAt: minutesAgo(20), likes: 18, liked: false },
  { id: "c-debate-004", targetId: "debate:d-002", author: AUTHORS.jeongyeeun, content: "전 교복 자유화 찬성!", createdAt: hoursAgo(3), likes: 9, liked: false },
  { id: "c-debate-005", targetId: "debate:d-003", author: AUTHORS.kimminsu, content: "좋은 토론 주제네요 👍", createdAt: hoursAgo(2), likes: 5, liked: false },

  // ─── 학습 Q&A ───
  { id: "c-qna-001", targetId: "qna:q-001", author: AUTHORS.hanteacher, content: "y' = 2x + 3 으로 풀면 됩니다. 한 번 해보세요!", createdAt: hoursAgo(2), likes: 8, liked: false },
  { id: "c-qna-002", targetId: "qna:q-001", parentId: "c-qna-001", author: AUTHORS.kimminsu, content: "감사합니다 선생님!", createdAt: minutesAgo(50), likes: 2, liked: false },
  { id: "c-qna-003", targetId: "qna:q-002", author: AUTHORS.choihaneul, content: "저도 같은 부분에서 막혔었는데 메가스터디 김기현 인강 추천해드려요!", createdAt: hoursAgo(4), likes: 5, liked: true },
  { id: "c-qna-004", targetId: "qna:q-003", author: AUTHORS.jeongyeeun, content: "이 문제 답이 3번이에요!", createdAt: hoursAgo(1), likes: 3, liked: false },

  // ─── 졸업생 게시판 ───
  { id: "c-alumni-001", targetId: "alumni:a-001", author: AUTHORS.kimminsu, content: "선배님 응원 감사합니다 🙇", createdAt: hoursAgo(3), likes: 7, liked: false },
  { id: "c-alumni-002", targetId: "alumni:a-001", parentId: "c-alumni-001", author: AUTHORS.choihaneul, content: "화이팅! 언제든 물어봐도 좋아요 :)", createdAt: hoursAgo(2), likes: 4, liked: true },
  { id: "c-alumni-003", targetId: "alumni:a-002", author: AUTHORS.kanghyerin, content: "디자인 진로 어떻게 시작하셨나요?", createdAt: hoursAgo(5), likes: 3, liked: false },
  { id: "c-alumni-004", targetId: "alumni:a-003", author: AUTHORS.leejunho, content: "감동적이에요 ㅠㅠ", createdAt: daysAgo(1), likes: 8, liked: false },

  // ─── 선배 후기 ───
  { id: "c-reviews-001", targetId: "reviews:r-001", author: AUTHORS.kimminsu, content: "면접 후기도 자세히 알려주실 수 있나요?", createdAt: hoursAgo(2), likes: 5, liked: false },
  { id: "c-reviews-002", targetId: "reviews:r-001", parentId: "c-reviews-001", author: AUTHORS.choihaneul, content: "물론이죠! DM으로 자세히 알려드릴게요", createdAt: hoursAgo(1), likes: 3, liked: false },
  { id: "c-reviews-003", targetId: "reviews:r-002", author: AUTHORS.jeongyeeun, content: "공대 진학 너무 멋있어요!", createdAt: hoursAgo(4), likes: 6, liked: true },
  { id: "c-reviews-004", targetId: "reviews:r-003", author: AUTHORS.kanghyerin, content: "예체능 입시 정보 더 있을까요?", createdAt: daysAgo(1), likes: 2, liked: false },

  // ─── 문태뉴스 ───
  { id: "c-news-001", targetId: "news:n-001", author: AUTHORS.kimminsu, content: "축제 너무 기대돼요!", createdAt: minutesAgo(30), likes: 14, liked: true },
  { id: "c-news-002", targetId: "news:n-001", parentId: "c-news-001", author: AUTHORS.jeongyeeun, content: "이번엔 어떤 부스가 있나요?", createdAt: minutesAgo(20), likes: 5, liked: false },
  { id: "c-news-003", targetId: "news:n-002", author: AUTHORS.parkteacher, content: "수상한 학생들 모두 축하합니다 🎉", createdAt: hoursAgo(1), likes: 22, liked: false },
  { id: "c-news-004", targetId: "news:n-003", author: AUTHORS.choihaneul, content: "동아리 활동이 활발해서 보기 좋네요!", createdAt: hoursAgo(3), likes: 8, liked: false },
];

// ─────────────────────────────────────────────
// 백그라운드 시뮬레이션용 샘플 (피드에 가끔 들어오는 새 글)
// ─────────────────────────────────────────────

const INCOMING_SAMPLES: Omit<Post, "id" | "createdAt">[] = [
  {
    author: AUTHORS.leejunho,
    content: "방금 급식 메뉴 봤는데 오늘 돈까스다! #급식",
    hashtags: ["급식"],
    channel: "free",
    likes: 0,
    liked: false,
    commentCount: 0,
  },
  {
    author: AUTHORS.parkteacher,
    content: "내일 1교시 변경됐어요. 시간표 다시 확인해 주세요. #공지",
    hashtags: ["공지"],
    channel: "notice",
    likes: 0,
    liked: false,
    commentCount: 0,
  },
  {
    author: AUTHORS.kanghyerin,
    content: "축제 부스 아이디어 추천 받아요 ㅎㅎ #축제 #아이디어",
    hashtags: ["축제", "아이디어"],
    channel: "free",
    likes: 0,
    liked: false,
    commentCount: 0,
  },
];

// ─────────────────────────────────────────────
// 구독 시스템 — 데이터 변경 시 화면 자동 갱신
// 추후 Supabase Realtime 으로 교체 가능
// ─────────────────────────────────────────────

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ─────────────────────────────────────────────
// 조회 함수 (READ)
// ─────────────────────────────────────────────

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type FeedQuery = {
  sort?: Sort;
  hashtag?: string;
  channel?: Channel;
  /** 페이지 인덱스 (0부터) */
  cursor?: number;
  limit?: number;
};

export type FeedPage = {
  posts: Post[];
  nextCursor: number | null;
};

export async function fetchPosts(q: FeedQuery = {}): Promise<FeedPage> {
  const { sort = "latest", hashtag, channel, cursor = 0, limit = 5 } = q;
  await delay(280);

  let arr = POSTS.slice();
  if (hashtag) arr = arr.filter((p) => p.hashtags.includes(hashtag));
  if (channel) arr = arr.filter((p) => p.channel === channel);

  if (sort === "latest") arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else if (sort === "likes") arr.sort((a, b) => b.likes - a.likes);
  else if (sort === "comments") arr.sort((a, b) => b.commentCount - a.commentCount);

  const start = cursor * limit;
  const slice = arr.slice(start, start + limit);
  const nextCursor = start + limit < arr.length ? cursor + 1 : null;

  return { posts: slice, nextCursor };
}

export async function fetchPostById(id: string): Promise<Post | null> {
  await delay(200);
  return POSTS.find((p) => p.id === id) ?? null;
}

/**
 * 특정 대상(targetId)의 모든 댓글을 시간 순으로 반환.
 * 대댓글까지 포함하므로, UI에서 parentId로 트리를 구성한다.
 */
export async function fetchCommentsByTarget(
  targetId: CommentTarget,
): Promise<Comment[]> {
  await delay(180);
  return COMMENTS.filter((c) => c.targetId === targetId).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

/** 동기적으로 댓글 개수 카운트 — 게시글 카드의 N개 표시용 */
export function countCommentsForTarget(targetId: CommentTarget): number {
  return COMMENTS.filter((c) => c.targetId === targetId).length;
}

/** 구버전 호환 — `feed:${postId}` 로 자동 변환 */
export async function fetchComments(postId: string): Promise<Comment[]> {
  return fetchCommentsByTarget(`feed:${postId}`);
}

export async function fetchTrendingHashtags(
  limit = 8,
): Promise<{ tag: string; count: number }[]> {
  await delay(120);
  const counts = new Map<string, number>();
  POSTS.forEach((p) =>
    p.hashtags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)),
  );
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** 특정 시점 이후 등록된 새 글 개수 — "새 글 N개" 알림용 */
export function countNewPostsSince(timestamp: number): number {
  return POSTS.filter((p) => new Date(p.createdAt).getTime() > timestamp).length;
}

// ─────────────────────────────────────────────
// 내 프로필 페이지 조회 헬퍼
// ─────────────────────────────────────────────

/** 내가 쓴 글 목록 (최신 순). 익명 글은 노출하지 않음 — 추적 방지를 위해. */
export async function fetchMyPosts(): Promise<Post[]> {
  await delay(180);
  return POSTS.filter((p) => p.author.id === ME.id && !p.anonymous).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

/** 내가 쓴 댓글 목록 (최신 순). 익명 댓글은 노출하지 않음. */
export async function fetchMyComments(): Promise<Comment[]> {
  await delay(180);
  return COMMENTS.filter((c) => c.author.id === ME.id && !c.anonymous).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

/** 내가 받은 좋아요 합계 (글 + 댓글) */
export function getReceivedLikes(): number {
  let total = 0;
  for (const p of POSTS) if (p.author.id === ME.id) total += p.likes;
  for (const c of COMMENTS) if (c.author.id === ME.id) total += c.likes;
  return total;
}

/** 글쓰기 자동완성용 — 게시글에 사용된 모든 해시태그 (사용 빈도 내림차순) */
export function getAllHashtags(): string[] {
  const counts = new Map<string, number>();
  POSTS.forEach((p) =>
    p.hashtags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)),
  );
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

// ─────────────────────────────────────────────
// 변경 함수 (WRITE)
// ─────────────────────────────────────────────

export async function toggleLike(postId: string): Promise<Post> {
  await delay(80);
  const p = POSTS.find((x) => x.id === postId);
  if (!p) throw new Error("post not found");
  p.liked = !p.liked;
  p.likes += p.liked ? 1 : -1;
  notify();
  return { ...p };
}

export type CreatePostInput = {
  content: string;
  channel: Channel;
};

export async function createPost(input: CreatePostInput): Promise<Post> {
  await delay(380);
  const newPost: Post = {
    id: `p-${Date.now()}`,
    author: ME,
    content: input.content.trim(),
    hashtags: extractHashtags(input.content),
    channel: input.channel,
    createdAt: new Date().toISOString(),
    likes: 0,
    liked: false,
    commentCount: 0,
  };
  POSTS = [newPost, ...POSTS];
  notify();
  return newPost;
}

/**
 * 임의의 대상(targetId)에 댓글 또는 대댓글을 추가.
 * parentId 가 있으면 대댓글로 처리되며, UI에서는 부모 아래 들여쓰기되어 표시된다.
 * 대상이 자유게시판 글이면 Post.commentCount 도 자동 증가시켜 목록 카드와 동기화한다.
 */
export async function addCommentToTarget(
  targetId: CommentTarget,
  content: string,
  parentId?: string,
): Promise<Comment> {
  await delay(180);
  const c: Comment = {
    id: `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    targetId,
    parentId,
    author: ME,
    content: content.trim(),
    createdAt: new Date().toISOString(),
    likes: 0,
    liked: false,
  };
  COMMENTS = [...COMMENTS, c];
  syncFeedPostCount(targetId);
  notify();
  return c;
}

/** 댓글 좋아요 토글 — 낙관적 업데이트 후 결과 동기화 용도 */
export async function toggleCommentLike(commentId: string): Promise<Comment> {
  await delay(60);
  const c = COMMENTS.find((x) => x.id === commentId);
  if (!c) throw new Error("comment not found");
  c.liked = !c.liked;
  c.likes = Math.max(0, c.likes + (c.liked ? 1 : -1));
  notify();
  return { ...c };
}

/**
 * 댓글 삭제. 최상위 댓글이면 자식 대댓글도 함께 제거.
 * 개발 모드에서는 누구나 삭제 가능 — 권한 검사는 호출부에서 결정.
 */
export async function deleteComment(commentId: string): Promise<void> {
  await delay(120);
  const target = COMMENTS.find((x) => x.id === commentId);
  if (!target) return;
  COMMENTS = COMMENTS.filter(
    (x) => x.id !== commentId && x.parentId !== commentId,
  );
  syncFeedPostCount(target.targetId);
  notify();
}

/** 자유게시판 댓글 수와 Post.commentCount 동기화 */
function syncFeedPostCount(targetId: CommentTarget) {
  if (!targetId.startsWith("feed:")) return;
  const postId = targetId.slice("feed:".length);
  const post = POSTS.find((p) => p.id === postId);
  if (!post) return;
  post.commentCount = COMMENTS.filter((c) => c.targetId === targetId).length;
}

// 모듈 초기화 시 시드 데이터 기준으로 자유게시판 댓글 수 정합성 보정
POSTS.forEach((p) => {
  p.commentCount = COMMENTS.filter((c) => c.targetId === `feed:${p.id}`).length;
});

/** 구버전 호환 — `feed:${postId}` 로 자동 변환 */
export async function addComment(
  postId: string,
  content: string,
): Promise<Comment> {
  return addCommentToTarget(`feed:${postId}`, content);
}

// ─────────────────────────────────────────────
// 해시태그 파서
// ─────────────────────────────────────────────

const HASHTAG_REGEX = /#([\p{L}\p{N}_]+)/gu;

export function extractHashtags(text: string): string[] {
  const tags = new Set<string>();
  for (const m of text.matchAll(HASHTAG_REGEX)) tags.add(m[1]);
  return Array.from(tags);
}

/** 본문을 텍스트/해시태그 토큰으로 분리 — 인라인 렌더링용 */
export type ContentToken =
  | { type: "text"; value: string }
  | { type: "hashtag"; value: string };

export function tokenizeContent(text: string): ContentToken[] {
  const tokens: ContentToken[] = [];
  let last = 0;
  for (const m of text.matchAll(HASHTAG_REGEX)) {
    if (m.index! > last) tokens.push({ type: "text", value: text.slice(last, m.index) });
    tokens.push({ type: "hashtag", value: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
}

// ─────────────────────────────────────────────
// 백그라운드 시뮬레이션 — 데모용
// 클라이언트에서 한 번만 시작; 일정 간격으로 새 글 주입
// ─────────────────────────────────────────────

let simStarted = false;
let simIndex = 0;

export function startBackgroundSim(): void {
  if (simStarted || typeof window === "undefined") return;
  simStarted = true;

  const injectOne = () => {
    const sample = INCOMING_SAMPLES[simIndex % INCOMING_SAMPLES.length];
    simIndex += 1;
    POSTS = [
      {
        ...sample,
        id: `sim-${Date.now()}-${simIndex}`,
        createdAt: new Date().toISOString(),
      },
      ...POSTS,
    ];
    notify();
  };

  // 첫 시뮬 글은 약 12초 후, 이후 18초 간격
  setTimeout(injectOne, 12_000);
  setInterval(injectOne, 18_000);
}
