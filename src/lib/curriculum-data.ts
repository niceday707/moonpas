// 교육과정 선택과목 데이터 레이어
// Supabase 연동 전 mock 데이터로 동작.
// 환경변수(NEXT_PUBLIC_SUPABASE_URL)가 설정되면 아래 fetch 함수들을 Supabase 쿼리로 교체하세요.

export type CourseCategory = "일반선택" | "진로선택" | "융합선택";
export type CourseStream = "인문" | "자연" | "예체능" | "의약" | "공통";

export type Course = {
  id: string;
  name: string;
  category: CourseCategory;
  area: string;
  streams: CourseStream[];
  description: string;
  detail: string;
  recommended_for: string;
  related_majors: string[];
};

export type CourseReview = {
  id: string;
  course_id: string;
  author_id: string;
  author_name: string;
  author_role: "student" | "teacher" | "parent" | "alumni";
  content: string;
  rating: 1 | 2 | 3 | 4 | 5;
  difficulty: "쉬움" | "보통" | "어려움";
  recommended: boolean;
  created_at: string;
};

export type CourseQna = {
  id: string;
  course_id: string | null;
  author_id: string;
  author_name: string;
  question: string;
  answer?: string;
  answered_by?: string;
  answered_at?: string;
  created_at: string;
};

// ─── 과목 seed ─────────────────────────────────────────────────────────────────

export const COURSES: Course[] = [
  // ── 일반선택 ─────────────────────────────────────────────────────────────────
  {
    id: "c-001", name: "화법과 작문", category: "일반선택", area: "국어",
    streams: ["인문", "공통"],
    description: "말하기·쓰기의 실전 능력을 키우는 과목",
    detail: "토론, 발표, 논술 등 다양한 말하기·쓰기 상황을 직접 경험하며 의사소통 능력을 기릅니다. 논리적 글쓰기와 효과적인 발표 전략을 체계적으로 학습합니다.",
    recommended_for: "논술 전형을 준비하거나 발표·토론 능력을 키우고 싶은 학생. 인문·사회 계열 진학 희망자에게 필수적으로 권장합니다.",
    related_majors: ["국어국문학", "신문방송학", "법학", "경영학", "교육학"],
  },
  {
    id: "c-002", name: "독서와 작문", category: "일반선택", area: "국어",
    streams: ["인문", "공통"],
    description: "다양한 텍스트를 읽고 비판적으로 사고하는 능력을 기르는 과목",
    detail: "인문·사회·과학 분야의 다양한 글을 읽고 분석·비판하며, 자신의 생각을 논리적으로 정리하는 글쓰기를 연습합니다.",
    recommended_for: "독서량을 늘리고 싶거나 생각을 글로 표현하는 능력을 키우고 싶은 학생.",
    related_majors: ["인문학", "사회과학", "사범대"],
  },
  {
    id: "c-003", name: "문학과 영상", category: "일반선택", area: "국어",
    streams: ["인문", "예체능"],
    description: "문학 작품과 영상 매체의 관계를 탐구하는 과목",
    detail: "소설·시·희곡 등 문학 장르가 영화·드라마·웹툰 등 영상 매체로 변환되는 과정을 분석하고, 영상 언어의 문법을 이해합니다.",
    recommended_for: "문학과 영상 매체 모두에 관심 있는 학생. 영화학·미디어 계열 진학 희망자에게 특히 추천합니다.",
    related_majors: ["국어국문학", "영화영상학", "미디어커뮤니케이션"],
  },
  {
    id: "c-004", name: "대수", category: "일반선택", area: "수학",
    streams: ["자연", "인문", "공통"],
    description: "함수·방정식·부등식을 체계적으로 학습하는 수학 기초 과목",
    detail: "다항함수, 지수·로그함수, 삼각함수의 그래프와 성질을 깊이 이해하고, 방정식·부등식을 활용한 문제 해결 능력을 기릅니다.",
    recommended_for: "이공계·의약계 진학을 목표로 하는 학생은 물론, 수학적 사고력을 키우고 싶은 인문계 학생에게도 권장합니다.",
    related_majors: ["수학", "공학", "자연과학", "경제학"],
  },
  {
    id: "c-005", name: "미적분Ⅰ", category: "일반선택", area: "수학",
    streams: ["자연", "의약"],
    description: "극한·미분·적분의 기초를 다루는 수학의 핵심 과목",
    detail: "수열의 극한, 함수의 연속, 미분의 개념과 활용, 적분의 기본 정리를 학습합니다. 이공계 전 분야의 필수 기반 과목입니다.",
    recommended_for: "이공계·의약계 진학을 목표로 하는 학생에게 필수. 미적분Ⅱ 수강 전 반드시 이수해야 합니다.",
    related_majors: ["수학", "물리학", "화학", "생명과학", "공학계열", "의학", "약학"],
  },
  {
    id: "c-006", name: "확률과 통계", category: "일반선택", area: "수학",
    streams: ["인문", "자연", "공통"],
    description: "데이터 분석의 기초, 확률 이론과 통계적 사고를 배우는 과목",
    detail: "순열·조합, 확률의 기본 법칙, 정규분포, 통계적 추정의 원리를 학습합니다. 수능 수학 영역의 핵심 단원이기도 합니다.",
    recommended_for: "수능 수학을 준비하는 모든 학생. 특히 사회과학·경영·경제 계열 진학 희망자에게 중요합니다.",
    related_majors: ["통계학", "경영학", "경제학", "심리학", "사회학"],
  },
  {
    id: "c-007", name: "물리학Ⅰ", category: "일반선택", area: "과학",
    streams: ["자연", "의약"],
    description: "힘·운동·에너지·파동의 기본 원리를 탐구하는 과목",
    detail: "뉴턴의 법칙, 에너지 보존, 전자기 현상, 파동과 빛의 성질을 실험과 함께 학습합니다.",
    recommended_for: "공학·물리학·의학 계열 진학 희망자. 물리학Ⅱ 수강을 위한 선수 과목입니다.",
    related_majors: ["물리학", "기계공학", "전기전자공학", "의학"],
  },
  {
    id: "c-008", name: "화학Ⅰ", category: "일반선택", area: "과학",
    streams: ["자연", "의약"],
    description: "물질의 구조와 변화를 탐구하는 화학의 기초 과목",
    detail: "원자 구조, 화학 결합, 산·염기, 산화·환원 등 핵심 화학 개념을 학습합니다. 생활 속 화학 현상과 연결해 이해를 심화합니다.",
    recommended_for: "화학·생명과학·의약 계열 진학 희망자. 화학Ⅱ 이수를 위한 기초 과목입니다.",
    related_majors: ["화학", "화학공학", "약학", "의학", "생명과학"],
  },
  {
    id: "c-009", name: "생명과학Ⅰ", category: "일반선택", area: "과학",
    streams: ["자연", "의약"],
    description: "생물의 특성과 생명 현상의 원리를 탐구하는 과목",
    detail: "세포, 유전, 진화, 생태계를 중심으로 생명 현상의 다양성과 통일성을 이해합니다.",
    recommended_for: "생명과학·의학·약학·환경 계열 진학 희망자에게 필수적으로 권장합니다.",
    related_majors: ["생명과학", "의학", "약학", "간호학", "수의학"],
  },
  {
    id: "c-010", name: "사회·문화", category: "일반선택", area: "사회",
    streams: ["인문", "공통"],
    description: "현대 사회의 구조와 문화 현상을 사회과학적으로 분석하는 과목",
    detail: "사회화, 사회 불평등, 문화 변동, 사회 집단, 사회 문제 등을 사회학·문화인류학적 관점에서 탐구합니다.",
    recommended_for: "인문·사회 계열 진학 희망자. 수능 사회탐구 선택 학생에게도 중요한 기반 과목입니다.",
    related_majors: ["사회학", "행정학", "경영학", "교육학", "사범대"],
  },
  {
    id: "c-011", name: "경제", category: "일반선택", area: "사회",
    streams: ["인문", "공통"],
    description: "시장의 원리와 경제 주체의 의사결정을 분석하는 과목",
    detail: "수요·공급, 시장 균형, GDP, 금리, 환율, 국제 무역의 기초 원리를 학습하고 현실 경제 현상에 적용합니다.",
    recommended_for: "경영·경제·금융 계열 진학 희망자. 경제 뉴스를 더 깊이 이해하고 싶은 학생에게도 추천합니다.",
    related_majors: ["경제학", "경영학", "무역학", "금융학"],
  },
  {
    id: "c-012", name: "정보", category: "일반선택", area: "정보",
    streams: ["자연", "공통"],
    description: "컴퓨팅 사고력과 프로그래밍 기초를 배우는 과목",
    detail: "알고리즘 설계, Python 기반 프로그래밍, 데이터 분석 기초, 인공지능 개념을 학습합니다.",
    recommended_for: "SW·AI 계열 진학 희망자는 물론, 디지털 역량을 키우고 싶은 모든 학생에게 추천합니다.",
    related_majors: ["컴퓨터공학", "소프트웨어공학", "AI·데이터사이언스"],
  },
  {
    id: "c-013", name: "음악", category: "일반선택", area: "예술",
    streams: ["예체능", "공통"],
    description: "음악의 표현·감상·창작 능력을 통합적으로 기르는 과목",
    detail: "다양한 장르의 음악을 감상하고 분석하며, 기악·성악·창작 활동을 통해 음악적 소양을 쌓습니다.",
    recommended_for: "음악 계열 진학 희망자 및 음악적 교양을 쌓고 싶은 모든 학생.",
    related_majors: ["음악학", "음악교육학", "실용음악"],
  },
  {
    id: "c-014", name: "미술", category: "일반선택", area: "예술",
    streams: ["예체능", "공통"],
    description: "시각적 표현과 조형 감각을 키우는 과목",
    detail: "드로잉, 색채, 입체, 디지털 매체를 활용한 조형 활동을 통해 창의적 표현 능력과 미적 감수성을 기릅니다.",
    recommended_for: "미술·디자인 계열 진학 희망자 및 창의적 표현 능력을 키우고 싶은 학생.",
    related_majors: ["미술학", "시각디자인", "산업디자인", "건축학"],
  },

  // ── 진로선택 ─────────────────────────────────────────────────────────────────
  {
    id: "c-101", name: "미적분Ⅱ", category: "진로선택", area: "수학",
    streams: ["자연", "의약"],
    description: "극한·미분·적분을 심화하여 이공계·의약계 진학의 핵심 역량을 다지는 과목",
    detail: "여러 가지 함수의 미분·적분(삼각함수, 지수·로그함수), 부정적분과 정적분의 심화, 넓이와 부피 계산까지 폭넓게 다룹니다. 서울대·연세대·고려대 이공계 및 의약계 학과에서 필수로 요구합니다.",
    recommended_for: "이공계·의약계 상위권 대학 진학을 목표로 하는 학생에게 사실상 필수 과목. 미적분Ⅰ 이수 후 수강을 권장합니다.",
    related_majors: ["수학", "물리학", "화학", "공학계열", "의학", "약학", "경제학"],
  },
  {
    id: "c-102", name: "기하", category: "진로선택", area: "수학",
    streams: ["자연", "의약"],
    description: "이차곡선·평면벡터·공간도형을 다루는 수학 심화 과목",
    detail: "포물선·타원·쌍곡선 등 이차곡선의 성질, 평면 위의 벡터, 공간 좌표와 직선·평면의 방정식을 학습합니다. 물리학·공학에서 필수적으로 활용됩니다.",
    recommended_for: "물리학·기계공학·항공우주공학 등 공간 기하 개념이 중요한 분야 진학 희망자. 서울대 등 최상위 이공계에서 권장합니다.",
    related_majors: ["수학", "물리학", "기계공학", "항공우주공학", "건축학"],
  },
  {
    id: "c-103", name: "인공지능 수학", category: "진로선택", area: "수학",
    streams: ["자연", "공통"],
    description: "머신러닝과 AI 알고리즘을 이해하기 위한 수학 기초",
    detail: "행렬, 확률 모델, 최적화, 통계 추론 등 AI·데이터사이언스에 필요한 수학 개념을 실제 AI 적용 사례와 함께 학습합니다.",
    recommended_for: "AI·소프트웨어·데이터사이언스 분야에 관심 있는 학생. 프로그래밍 경험이 있다면 더욱 효과적으로 학습할 수 있습니다.",
    related_majors: ["AI·데이터사이언스", "컴퓨터공학", "통계학", "경영정보학"],
  },
  {
    id: "c-104", name: "물리학Ⅱ", category: "진로선택", area: "과학",
    streams: ["자연", "의약"],
    description: "역학·전자기학·현대물리를 심화 탐구하는 과목",
    detail: "뉴턴 역학의 심화, 전기장·자기장, 파동의 중첩과 회절, 특수상대성이론, 양자역학의 기초를 다룹니다.",
    recommended_for: "물리학·기계공학·전기전자공학·의학물리 계열 진학 희망자. 물리학Ⅰ 이수 후 수강 권장합니다.",
    related_majors: ["물리학", "기계공학", "전기전자공학", "의학", "항공우주공학"],
  },
  {
    id: "c-105", name: "화학Ⅱ", category: "진로선택", area: "과학",
    streams: ["자연", "의약"],
    description: "원자 구조·화학 결합·반응속도를 심화하여 탐구하는 과목",
    detail: "오비탈 이론, 분자간 힘, 용액의 성질, 반응속도와 평형, 전기화학을 학습합니다. 화학·생명·의약 계열의 대학 수업과 직결됩니다.",
    recommended_for: "화학·화학공학·약학·의학 계열 진학 희망자에게 사실상 필수입니다.",
    related_majors: ["화학", "화학공학", "약학", "의학", "재료공학"],
  },
  {
    id: "c-106", name: "생명과학Ⅱ", category: "진로선택", area: "과학",
    streams: ["자연", "의약"],
    description: "세포·유전·진화를 심화하여 생명 현상의 본질을 탐구하는 과목",
    detail: "세포 호흡과 광합성의 심화, DNA 복제와 단백질 합성, 유전자 발현 조절, 생태계 동적 평형을 학습합니다.",
    recommended_for: "생명과학·의학·약학·간호학·수의학 계열 진학 희망자에게 필수적으로 권장합니다.",
    related_majors: ["생명과학", "의학", "약학", "간호학", "수의학", "식품영양학"],
  },
  {
    id: "c-107", name: "지구과학Ⅱ", category: "진로선택", area: "과학",
    streams: ["자연"],
    description: "지구 내부·대기·해양·우주를 심화 탐구하는 과목",
    detail: "판구조론 심화, 기후변화의 과학적 원리, 해양의 물리·화학적 특성, 별의 진화와 우주론을 학습합니다.",
    recommended_for: "지구과학·지질학·기상학·천문학·해양학 계열 진학 희망자. 환경 분야에도 연관성이 높습니다.",
    related_majors: ["지구과학", "지질학", "기상학", "천문학", "해양학", "환경공학"],
  },
  {
    id: "c-108", name: "세계사", category: "진로선택", area: "사회",
    streams: ["인문"],
    description: "고대부터 현대까지 세계 역사의 흐름을 탐구하는 과목",
    detail: "문명의 발생, 중세 사회, 근대 혁명, 제국주의와 세계대전, 현대 국제질서까지 세계사의 큰 흐름을 인과적으로 이해합니다.",
    recommended_for: "역사학·국제관계·외교 계열 진학 희망자. 한국사와 연계해 세계 속 한국의 위치를 이해하고 싶은 학생에게도 추천합니다.",
    related_majors: ["역사학", "국제관계학", "정치외교학", "사학과"],
  },
  {
    id: "c-109", name: "정치와 법", category: "진로선택", area: "사회",
    streams: ["인문"],
    description: "민주주의 정치 원리와 법의 기능을 탐구하는 과목",
    detail: "민주주의의 역사와 원리, 선거제도, 헌법의 구조, 민법·형법의 기초, 국제법을 학습하고 실생활 사례에 적용합니다.",
    recommended_for: "법학·행정학·정치외교학·공무원 준비 학생에게 적극 추천합니다.",
    related_majors: ["법학", "행정학", "정치외교학", "경찰행정학"],
  },
  {
    id: "c-110", name: "윤리와 사상", category: "진로선택", area: "사회",
    streams: ["인문"],
    description: "동서양의 윤리 사상을 탐구하고 삶의 가치를 성찰하는 과목",
    detail: "공자·맹자, 플라톤·아리스토텔레스, 칸트, 공리주의 등 동서양 윤리 사상을 비교·분석하고 현대 사회 문제에 적용합니다.",
    recommended_for: "철학·윤리학·사범대 계열 진학 희망자. 삶의 가치와 도덕적 판단 능력을 키우고 싶은 학생에게 추천합니다.",
    related_majors: ["철학", "윤리교육학", "종교학", "사범대"],
  },
  {
    id: "c-111", name: "정보과학", category: "진로선택", area: "정보",
    streams: ["자연"],
    description: "자료구조·알고리즘·컴퓨터 시스템을 심화 학습하는 과목",
    detail: "정렬·탐색 알고리즘, 스택·큐·트리 자료구조, 운영체제 개념, 네트워크 기초, 데이터베이스를 학습합니다.",
    recommended_for: "SW·AI 계열 진학을 목표로 하는 학생. 프로그래밍 대회(KOI, USACO) 준비에도 직접적으로 도움이 됩니다.",
    related_majors: ["컴퓨터공학", "소프트웨어공학", "AI·데이터사이언스", "정보통신공학"],
  },
  {
    id: "c-112", name: "음악 연주와 창작", category: "진로선택", area: "예술",
    streams: ["예체능"],
    description: "음악 실기와 창작 능력을 전문적으로 계발하는 과목",
    detail: "악기 연주 기법의 심화, 화성법과 대위법, 디지털 음악 제작(DAW), 편곡 등 음악 창작의 실전적 역량을 기릅니다.",
    recommended_for: "음악 계열 입시를 준비하는 학생. 실용음악·작곡 전공 희망자에게 특히 추천합니다.",
    related_majors: ["음악학", "작곡학", "실용음악", "음악교육학"],
  },
  {
    id: "c-113", name: "미술 창작", category: "진로선택", area: "예술",
    streams: ["예체능"],
    description: "다양한 매체를 활용한 심화 창작 역량을 기르는 과목",
    detail: "회화·조소·디지털 아트·설치미술 등 다양한 매체로 자신의 아이디어를 표현하고 작품 의도를 설명하는 능력을 키웁니다.",
    recommended_for: "미술·디자인 계열 입시를 준비하는 학생. 포트폴리오 제작에 직접적으로 도움이 됩니다.",
    related_majors: ["미술학", "시각디자인", "산업디자인", "영상디자인"],
  },

  // ── 융합선택 ─────────────────────────────────────────────────────────────────
  {
    id: "c-201", name: "기후변화와 지속가능한 세계", category: "융합선택", area: "과학·사회",
    streams: ["자연", "인문", "공통"],
    description: "기후위기의 과학적 원리와 사회적 대응을 통합적으로 탐구하는 과목",
    detail: "온실가스 증가, 해수면 상승, 생태계 변화 등 기후변화의 과학적 메커니즘을 이해하고, 국제 협약·탄소중립 정책·지속가능 발전 목표(SDGs)와 연결해 인문·사회적 해법을 탐구합니다.",
    recommended_for: "환경 문제에 관심이 있는 모든 학생. 환경공학·도시계획·국제관계 계열 진학 희망자에게 특히 추천합니다.",
    related_majors: ["환경공학", "지구과학", "사회학", "국제관계학", "도시공학"],
  },
  {
    id: "c-202", name: "디지털과 인공지능", category: "융합선택", area: "정보·과학",
    streams: ["자연", "인문", "공통"],
    description: "AI·빅데이터·디지털 전환의 사회적 영향을 탐구하는 과목",
    detail: "머신러닝의 작동 원리, 빅데이터 분석 사례, 알고리즘 편향과 윤리, 디지털 경제와 플랫폼 비즈니스를 학습합니다. 코딩보다 개념과 비판적 이해에 초점을 맞춥니다.",
    recommended_for: "문과·이과 구분 없이 디지털·AI 소양을 쌓고 싶은 모든 학생에게 추천합니다.",
    related_majors: ["AI·데이터사이언스", "경영정보학", "사회학", "미디어학"],
  },
  {
    id: "c-203", name: "여행지리", category: "융합선택", area: "사회",
    streams: ["인문", "공통"],
    description: "세계 각지의 자연환경과 문화를 지리적 관점에서 탐구하는 과목",
    detail: "세계 유명 여행지의 지형·기후·문화를 지리적 관점에서 탐구하고, 지속가능한 여행의 의미를 성찰합니다. 지리 개념을 흥미로운 맥락에서 학습할 수 있습니다.",
    recommended_for: "지리·관광·문화 분야에 관심이 있는 학생. 세계지리와 함께 이수하면 시너지 효과가 큽니다.",
    related_majors: ["지리학", "관광경영학", "문화인류학", "국제관계학"],
  },
  {
    id: "c-204", name: "사회문제 탐구", category: "융합선택", area: "사회",
    streams: ["인문", "공통"],
    description: "실제 사회 문제를 탐구·분석하고 해결책을 제안하는 과목",
    detail: "빈부격차, 고령화, 디지털 격차, 젠더, 환경 등 현대 사회문제를 다양한 사회과학적 방법론으로 탐구합니다. 보고서 작성과 발표가 중심이 됩니다.",
    recommended_for: "사회과학 계열 진학 희망자. 세특 활동을 풍부하게 만들고 싶은 학생에게 적극 추천합니다.",
    related_majors: ["사회학", "사회복지학", "행정학", "언론학"],
  },
  {
    id: "c-205", name: "데이터 과학", category: "융합선택", area: "수학·정보",
    streams: ["자연", "인문", "공통"],
    description: "데이터 수집·분석·시각화를 통해 문제를 해결하는 과목",
    detail: "통계적 사고, Python·R을 활용한 데이터 분석, 데이터 시각화, 기초 머신러닝을 실습 중심으로 학습합니다.",
    recommended_for: "이공계·경영·사회과학 계열 진학 희망자. 데이터 기반 문제 해결 능력을 키우고 싶은 학생에게 강력히 추천합니다.",
    related_majors: ["통계학", "AI·데이터사이언스", "경영정보학", "사회학"],
  },
  {
    id: "c-206", name: "세포와 물질대사", category: "융합선택", area: "과학",
    streams: ["자연", "의약"],
    description: "세포 생물학과 생화학을 융합하여 생명 현상을 심층 탐구하는 과목",
    detail: "ATP 합성, 세포막 수송, 효소 반응, 대사 경로(해당과정·TCA회로·산화적 인산화)를 생화학적으로 탐구합니다. 의약계열 대학 수업과 직결됩니다.",
    recommended_for: "의학·약학·생명과학 계열 진학 희망자에게 강력히 추천합니다. 생명과학Ⅱ와 함께 이수하면 효과적입니다.",
    related_majors: ["의학", "약학", "생명과학", "간호학", "식품영양학"],
  },
  {
    id: "c-207", name: "화학반응의 세계", category: "융합선택", area: "과학",
    streams: ["자연", "의약"],
    description: "화학 반응의 원리를 실생활과 산업 맥락에서 탐구하는 과목",
    detail: "산화·환원, 전기화학, 고분자 합성, 의약품 설계 등 화학 반응이 실생활·산업에 어떻게 활용되는지를 탐구합니다.",
    recommended_for: "화학·화학공학·약학 계열 진학 희망자. 화학Ⅱ와 함께 이수하면 매우 효과적입니다.",
    related_majors: ["화학", "화학공학", "약학", "재료공학", "의학"],
  },
  {
    id: "c-208", name: "공학 수학", category: "융합선택", area: "수학·기술",
    streams: ["자연"],
    description: "공학 문제 해결에 필요한 수학적 도구를 실습하는 과목",
    detail: "미분방정식, 선형대수, 벡터 해석, 수치해석의 기초를 MATLAB·Python을 활용해 실습합니다. 공대 1학년 커리큘럼과 직접 연결됩니다.",
    recommended_for: "기계·전기전자·토목·항공 등 공학 계열 진학 희망자에게 강력히 추천합니다.",
    related_majors: ["기계공학", "전기전자공학", "토목공학", "항공우주공학", "화학공학"],
  },
  {
    id: "c-209", name: "실용 통계", category: "융합선택", area: "수학",
    streams: ["인문", "자연", "공통"],
    description: "실생활 데이터를 통계적으로 분석하고 해석하는 능력을 기르는 과목",
    detail: "기술통계, 가설 검정, 회귀분석의 기초를 엑셀·R·Python으로 실습하며 배웁니다. 언론·경영·사회과학 분야에서 실제로 쓰이는 통계 기법에 초점을 맞춥니다.",
    recommended_for: "경영·경제·사회과학 계열 진학 희망자. 문과생도 데이터 분석 능력을 갖추고 싶다면 적극 추천합니다.",
    related_majors: ["통계학", "경영학", "경제학", "사회학", "심리학"],
  },
  {
    id: "c-210", name: "독서 토론과 글쓰기", category: "융합선택", area: "국어",
    streams: ["인문", "공통"],
    description: "비판적 독서와 토론, 논리적 글쓰기를 통합적으로 연습하는 과목",
    detail: "고전 텍스트·시사 이슈를 읽고 토론하며, 주장의 근거를 갖춰 설득력 있는 글을 쓰는 훈련을 합니다. 논술 전형 준비에 직접적으로 도움이 됩니다.",
    recommended_for: "논술 전형을 준비하는 학생, 사고력과 표현력을 동시에 키우고 싶은 모든 학생에게 추천합니다.",
    related_majors: ["국어국문학", "법학", "언론학", "교육학", "사범대"],
  },
  {
    id: "c-211", name: "스포츠 과학", category: "융합선택", area: "체육·과학",
    streams: ["예체능", "자연"],
    description: "운동의 과학적 원리를 탐구하고 스포츠 퍼포먼스를 분석하는 과목",
    detail: "운동생리학, 바이오메카닉스, 스포츠 심리학, 트레이닝 방법론, 스포츠 영양학을 학습하고 실제 운동 데이터를 분석합니다.",
    recommended_for: "체육학·스포츠과학 계열 진학 희망자. 운동선수로서 자신의 퍼포먼스를 과학적으로 이해하고 싶은 학생에게도 추천합니다.",
    related_majors: ["체육학", "스포츠과학", "물리치료학", "운동처방학"],
  },
  {
    id: "c-212", name: "인문학과 경제", category: "융합선택", area: "사회·인문",
    streams: ["인문", "공통"],
    description: "경제 현상을 인문학적 관점에서 성찰하는 융합 과목",
    detail: "경제학의 기본 개념을 역사·철학·문학과 융합하여 탐구합니다. 자본주의의 역사, 불평등의 철학, 소비문화와 문학 등을 다룹니다.",
    recommended_for: "경제학·경영학 진학을 희망하지만 인문적 소양도 함께 키우고 싶은 학생에게 추천합니다.",
    related_majors: ["경제학", "경영학", "철학", "사회학"],
  },
];

// ─── 후기 seed ────────────────────────────────────────────────────────────────

export let REVIEWS: CourseReview[] = [
  {
    id: "r-001", course_id: "c-101", author_id: "u-kimminsu", author_name: "김민수", author_role: "student",
    content: "미적분Ⅱ 처음엔 정말 어려웠는데 문제를 많이 풀다 보면 패턴이 보여요. 수능보다 세특용으로 배운 게 더 많은 것 같아요.",
    rating: 5, difficulty: "어려움", recommended: true, created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "r-002", course_id: "c-006", author_id: "u-jeongyeeun", author_name: "정예은", author_role: "student",
    content: "확률과 통계는 개념 정리만 잘 해 두면 생각보다 어렵지 않아요. 실생활 예제가 많아서 재미있게 들었습니다.",
    rating: 4, difficulty: "보통", recommended: true, created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "r-003", course_id: "c-111", author_id: "u-choihaneul", author_name: "최하늘", author_role: "alumni",
    content: "정보과학 수강하고 코딩 대회 나갔는데 입시에 정말 많이 도움됐어요. 컴공 가고 싶으면 무조건 들으세요.",
    rating: 5, difficulty: "어려움", recommended: true, created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: "r-004", course_id: "c-201", author_id: "u-leejunho", author_name: "이준호", author_role: "student",
    content: "기후변화와 지속가능한 세계는 문이과 경계 없이 들을 수 있어서 좋았어요. 탐구 보고서 쓰기가 많지만 배우는 게 확실히 많습니다.",
    rating: 4, difficulty: "보통", recommended: true, created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "r-005", course_id: "c-102", author_id: "u-leejunho", author_name: "이준호", author_role: "student",
    content: "기하는 공간 감각이 없으면 처음에 많이 헤매요. 그림 그리면서 이해하는 게 핵심입니다. 물리학이랑 같이 들으면 엄청 시너지 납니다.",
    rating: 4, difficulty: "어려움", recommended: true, created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "r-006", course_id: "c-202", author_id: "u-kanghyerin", author_name: "강혜린", author_role: "student",
    content: "디지털과 인공지능은 코딩을 몰라도 들을 수 있어요. AI 윤리 파트가 특히 흥미로웠습니다. 진로가 문과여도 AI 소양 쌓기에 딱입니다.",
    rating: 5, difficulty: "쉬움", recommended: true, created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

// ─── Q&A seed ──────────────────────────────────────────────────────────────────

export let QNAS: CourseQna[] = [
  {
    id: "q-001", course_id: "c-101", author_id: "u-kanghyerin", author_name: "강혜린",
    question: "미적분Ⅱ를 1학년 때 들어도 괜찮을까요? 대수랑 미적분Ⅰ은 들었어요.",
    answer: "미적분Ⅰ을 이수했다면 가능합니다. 다만 진도가 빠르고 난이도가 높으니, 여름방학 때 미리 예습하고 시작하는 것을 추천드립니다.",
    answered_by: "한지훈 선생님", answered_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "q-002", course_id: "c-111", author_id: "u-kimminsu", author_name: "김민수",
    question: "정보과학이랑 정보 중에 뭘 먼저 들어야 하나요?",
    answer: "정보 → 정보과학 순서로 이수하는 것을 권장합니다. 정보 과목에서 Python 기초와 알고리즘 개념을 먼저 익힌 후 정보과학의 심화 내용으로 넘어가야 수업을 따라가기 편합니다.",
    answered_by: "박선생님", answered_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "q-003", course_id: "c-105", author_id: "u-jeongyeeun", author_name: "정예은",
    question: "화학Ⅱ랑 생명과학Ⅱ 중에 의대 입시에 더 중요한 과목이 뭔가요?",
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "q-004", course_id: "c-201", author_id: "u-leejunho", author_name: "이준호",
    question: "기후변화와 지속가능한 세계는 이과생이 들어도 괜찮나요? 사회 개념이 많이 나오나요?",
    answer: "이과생도 충분히 들을 수 있습니다. 과학 파트(온실가스, 기후 시스템)와 사회 파트(정책, SDGs)가 절반씩 구성되어 있어 이과 학생들에게는 사회적 시각을 넓히는 기회가 됩니다. 세특 소재로도 매우 유용합니다.",
    answered_by: "진로진학부",
    answered_at: new Date(Date.now() - 4 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: "q-005", course_id: null, author_id: "u-kanghyerin", author_name: "강혜린",
    question: "1학년인데 2·3학년 진로선택 과목을 미리 들을 수 있나요? 학교에서 허용해 주는지 궁금해요.",
    created_at: new Date(Date.now() - 30 * 60000).toISOString(),
  },
];

// ─── 헬퍼 함수 ────────────────────────────────────────────────────────────────

export function getCourseById(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id);
}

export function getReviewsByCourse(courseId: string): CourseReview[] {
  return REVIEWS.filter((r) => r.course_id === courseId);
}

export function getAverageRating(courseId: string): number {
  const reviews = getReviewsByCourse(courseId);
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

export function addReview(review: Omit<CourseReview, "id" | "created_at">): CourseReview {
  const newReview: CourseReview = {
    ...review,
    id: `r-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  REVIEWS = [newReview, ...REVIEWS];
  return newReview;
}

export function addQna(qna: Omit<CourseQna, "id" | "created_at">): CourseQna {
  const newQna: CourseQna = {
    ...qna,
    id: `q-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  QNAS = [newQna, ...QNAS];
  return newQna;
}

export function answerQna(id: string, answer: string, answeredBy: string): void {
  const q = QNAS.find((q) => q.id === id);
  if (q) {
    q.answer = answer;
    q.answered_by = answeredBy;
    q.answered_at = new Date().toISOString();
  }
}

export const STREAM_COLORS: Record<CourseStream, string> = {
  인문: "#06b6d4",
  자연: "#7c3aed",
  예체능: "#ec4899",
  의약: "#10b981",
  공통: "#f59e0b",
};

export const AREA_COLORS: Record<string, string> = {
  국어: "#f59e0b",
  수학: "#7c3aed",
  과학: "#10b981",
  사회: "#06b6d4",
  정보: "#3b82f6",
  예술: "#ec4899",
  체육: "#f97316",
  "과학·사회": "#10b981",
  "정보·과학": "#3b82f6",
  "수학·정보": "#7c3aed",
  "수학·기술": "#7c3aed",
  "체육·과학": "#f97316",
  "사회·인문": "#06b6d4",
};
