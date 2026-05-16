# PROGRESS · 문파스 작업 진척 기록

> 매 작업 단위로 한 줄씩 추가. 상세 배경/근거는 [DECISIONS.md](./DECISIONS.md) 참고.

## 2026-05-16

- **문츠 자동 후보 수집기 1차 (3차 작업)**
  - `scripts/find-muntz-candidates.mjs` 신규 — YouTube Data API v3 (search.list + videos.list) 로 카테고리 15개 인기 쇼츠 후보를 수집.
  - 필터: 올해 1/1 이후 업로드, 조회수 ≥ 1,000,000, 길이 ≤ 60초, embeddable=true, madeForKids 제외, 부적절 키워드(영/한 22개) 제외, 중복 제거.
  - 상위 20개를 `scripts/output/muntz-candidates.json` 으로 저장. `reviewStatus: "pending"`, `source: "youtube_auto"` 로 마킹 — 학생 노출 전 검수 단계 필수.
  - `npm run muntz:find` 로 실행. 의존성 추가 없음(Node 내장 fetch + 간단 .env 파서).
  - `.env.example` 신규 — `YOUTUBE_API_KEY` 포함 전체 환경변수 템플릿. `.gitignore` 에 `/scripts/output/` 추가.
  - 이번 작업에서 /muntz UI, Supabase 스키마, 관리자 승인 UI 는 의도적으로 건드리지 않음.
- **/muntz fullscreen 쇼츠 뷰어로 재설계 (2차)**
  - 1차의 일반 페이지 레이아웃에서 → `fixed inset-0 z-50 bg-black` 풀스크린 몰입형 뷰어로 교체.
  - AppShell 에 `FULLSCREEN_VIEWER_PATHS` 집합 추가, `/muntz` 에서는 BottomNav 자동 숨김.
  - 슬라이드 1개 = `h-[100dvh]` + `snap-start snap-always`. 비디오는 `w=min(100%, 100dvh*9/16)` 로 9:16 유지하면서 항상 화면 안.
  - 하단 그라데이션 오버레이 + 좌하단 메타(카테고리/학년 칩, @닉네임, 제목, 설명+더보기).
  - 우측 액션 버튼 3종(좋아요/공유/저장) 더미 인터랙션만 구현, 실제 기능은 DB 연동 단계로 보류.
  - 상단 오버레이: 좌상단 뒤로가기, 가운데 "문츠 🎬", 그 아래 작은 카테고리 칩 가로 스크롤.
  - PC 는 가운데 폰 프레임(`md:max-w-[420px]`) 안에서 동일한 피드가 동작 — 어두운 배경에 폰 모양 카드.
  - body scroll lock — 뷰어 밖으로 스크롤이 새지 않도록.
  - `MuntzItem` 에 `youtubeId` 필드 분리 + 안정 `id` 도입 (같은 영상을 여러 게시물이 공유 가능).
  - `authorNickname` 을 한국어 커뮤니티 닉네임(@수학괴짜쌤, @진로쌤, @1학년부, @문태교육, @학생회 등)으로 갱신 — 영상 제작자가 아니라 "문파스에 링크를 올린 사람".
- **/muntz 1차 mock 피드 구현**
  - ComingSoon 자리에 9:16 세로 쇼츠 피드(scroll-snap, 카테고리 필터, 7개 mock) 배치.
  - `src/lib/muntz-data.ts` 신규 — `MuntzItem` 타입, `MUNTZ_CATEGORIES`(학습꿀팁/학교생활/동아리/진로/도전·챌린지), `muntzEmbedUrl()` 헬퍼.
  - 영상은 공식 iframe embed (`youtube-nocookie`) 만 사용 — 서버 저장 없음.
  - DB 연동/관리자 등록은 다음 마일스톤. 현재는 mock 으로 UI/UX 검증.
- **메가메뉴 5섹션 재구조화 + /muntz 라우트 신설**
  - 커뮤니티 🫧 / 문태 생활 ✨ / 학습·진로 🎯 / 문태 미디어 🎬 / 학교알림 🔔.
  - "문태 이벤트" → "문태 생활" 라벨 변경, 재학생 섹션을 학습·진로로 재편, 미디어 섹션 신설.
  - `career_news` BoardType 추가(ComingSoon 분기), `/muntz` 라우트 신규.

## 다음 후보

- 문츠 Supabase 스키마(`muntz_items` 테이블) 설계 + 교사 등록 UI.
- FullscreenMenu(랜딩 페이지) 메뉴 구조를 TopBar 와 동기화.
- 문츠 카드 자동재생/음소거 토글 정책 결정 후 적용.
