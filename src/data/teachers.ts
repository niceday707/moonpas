// 문태고 교사 데이터 — 쌤 어디계세요? 페이지 데이터 소스.
// isSchoolHead: 교장/교감처럼 상단 고정 카드에만 노출하고 검색/그룹에서는 제외할 대상.

export interface Teacher {
  name: string;
  subject: string;
  office: string;
  officeRoom: string;
  officeLocation: string;
  role?: string;
  isSchoolHead?: boolean;
}

export const teachers: Teacher[] = [
  // ========== 학교 대표 ==========
  { name: "유일한", subject: "", office: "교장실", officeRoom: "A동 1층", officeLocation: "A동 1F", role: "교장", isSchoolHead: true },
  { name: "전인범", subject: "", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F", role: "교감", isSchoolHead: true },

  // ========== 교무실 (B104) B동 1F - 15명 ==========
  { name: "문환욱", subject: "사회", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F" },
  { name: "김규리", subject: "영어", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F" },
  { name: "박호림", subject: "정보", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F" },
  { name: "정종학", subject: "화학", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F" },
  { name: "나기태", subject: "수학", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F" },
  { name: "배성철", subject: "수학", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F" },
  { name: "배선애", subject: "국어", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F" },
  { name: "장은주", subject: "국어", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F" },
  { name: "박미애", subject: "영어", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F" },
  { name: "장윤희", subject: "미술", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F" },
  { name: "박성화", subject: "수학", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F" },
  { name: "김연희", subject: "교무행정", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F", role: "교무행정사" },
  { name: "신화숙", subject: "영어", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F" },
  { name: "홍수린", subject: "미술", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F" },
  { name: "조봉근", subject: "물리", office: "교무실", officeRoom: "B104", officeLocation: "B동 1F" },

  // ========== 3학년실 (별관 2층) - 7명 ==========
  { name: "유배수", subject: "수학", office: "3학년실", officeRoom: "별관 2층", officeLocation: "별관동 2F" },
  { name: "권순범", subject: "국어", office: "3학년실", officeRoom: "별관 2층", officeLocation: "별관동 2F" },
  { name: "박희", subject: "일반사회", office: "3학년실", officeRoom: "별관 2층", officeLocation: "별관동 2F" },
  { name: "박혜연", subject: "생명과학", office: "3학년실", officeRoom: "별관 2층", officeLocation: "별관동 2F" },
  { name: "박채린", subject: "수학", office: "3학년실", officeRoom: "별관 2층", officeLocation: "별관동 2F" },
  { name: "정승훈", subject: "화학", office: "3학년실", officeRoom: "별관 2층", officeLocation: "별관동 2F" },
  { name: "김선명", subject: "정보", office: "3학년실", officeRoom: "별관 2층", officeLocation: "별관동 2F" },

  // ========== 2학년실 (B304) B동 3F - 7명 ==========
  { name: "정수형", subject: "영어", office: "2학년실", officeRoom: "B304", officeLocation: "B동 3F" },
  { name: "이지범", subject: "체육", office: "2학년실", officeRoom: "B304", officeLocation: "B동 3F" },
  { name: "박동근", subject: "영어", office: "2학년실", officeRoom: "B304", officeLocation: "B동 3F" },
  { name: "정우석", subject: "윤리", office: "2학년실", officeRoom: "B304", officeLocation: "B동 3F" },
  { name: "정유정", subject: "국어", office: "2학년실", officeRoom: "B304", officeLocation: "B동 3F" },
  { name: "김난영", subject: "국어", office: "2학년실", officeRoom: "B304", officeLocation: "B동 3F" },
  { name: "조금섭", subject: "생명과학", office: "2학년실", officeRoom: "B304", officeLocation: "B동 3F" },

  // ========== 1학년실 (B504) B동 5F - 7명 ==========
  { name: "김현수", subject: "한문", office: "1학년실", officeRoom: "B504", officeLocation: "B동 5F" },
  { name: "정인영", subject: "국어", office: "1학년실", officeRoom: "B504", officeLocation: "B동 5F" },
  { name: "노가영", subject: "일반사회", office: "1학년실", officeRoom: "B504", officeLocation: "B동 5F" },
  { name: "이한나", subject: "역사", office: "1학년실", officeRoom: "B504", officeLocation: "B동 5F" },
  { name: "김영환", subject: "체육", office: "1학년실", officeRoom: "B504", officeLocation: "B동 5F" },
  { name: "하은정", subject: "영어", office: "1학년실", officeRoom: "B504", officeLocation: "B동 5F" },
  { name: "김나라", subject: "지구과학", office: "1학년실", officeRoom: "B504", officeLocation: "B동 5F" },

  // ========== 학생인성부실 (도서관 1층) - 4명 ==========
  { name: "심훈식", subject: "사회", office: "학생인성부실", officeRoom: "도서관 1층", officeLocation: "도서관 1F" },
  { name: "이혁", subject: "음악", office: "학생인성부실", officeRoom: "도서관 1층", officeLocation: "도서관 1F" },
  { name: "장은", subject: "역사", office: "학생인성부실", officeRoom: "도서관 1층", officeLocation: "도서관 1F" },
  { name: "곽찬영", subject: "음악", office: "학생인성부실", officeRoom: "도서관 1층", officeLocation: "도서관 1F" },

  // ========== 성적처리실 (B102) B동 1F - 2명 ==========
  { name: "박주엘", subject: "수학", office: "성적처리실", officeRoom: "B102", officeLocation: "B동 1F" },
  { name: "정동민", subject: "수학", office: "성적처리실", officeRoom: "B102", officeLocation: "B동 1F" },

  // ========== 상담실 (A동 1층) - 1명 ==========
  { name: "박세은", subject: "상담", office: "상담실", officeRoom: "A동 1층", officeLocation: "A동 1F", role: "전문상담교사" },

  // ========== 도서관 (도서관 2층) - 1명 ==========
  { name: "김종률", subject: "사서", office: "도서관", officeRoom: "도서관 2층", officeLocation: "도서관 2F", role: "사서교사" },

  // ========== 보건실 (B101) B동 1F - 1명 ==========
  { name: "민혜정", subject: "보건", office: "보건실", officeRoom: "B101", officeLocation: "B동 1F", role: "보건교사" },
];
