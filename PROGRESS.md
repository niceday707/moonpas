# PROGRESS · 문파스 작업 진척 기록

> 매 작업 단위로 한 줄씩 추가. 상세 배경/근거는 [DECISIONS.md](./DECISIONS.md) 참고.

## 2026-05-17

- **/moontube 3단계 — 댓글 컴포넌트 일원화 + 카운트 정합화 + 쇼츠 슬라이드업**
  - `supabase/migrations/034_moontube_comment_likes.sql` — `moontube_comment_likes` 테이블 + RLS + INSERT/DELETE 트리거(SECURITY DEFINER)가 `moontube_comments.like_count` 캐시 갱신. 좋아요 토글로 댓글 카운트 정합 유지.
  - `src/lib/moontube-service.ts` — `toggleCommentLike`/`getMyCommentLikes` 추가 + `createComment` 가 `mention_user_id` 옵션 받음. `MoontubeComment` 에 `mentionUserId/likeCount` 노출.
  - `src/components/moontube/{types,CommentInput,CommentItem,CommentSection}.tsx` 신규 — DB/fallback 공용 `MoontubeUIComment` 모델, 멘션 자동완성(`search_mentionable_users` RPC) + 답글 `@닉네임` prefix + 금지어 필터 입력행, 좋아요/답글/본인삭제 + `@멘션` 보라 강조 행, 정렬 토글(인기순/최신순) + 답글 펼침/접기 + 인라인/시트 변형 섹션. 시트 변형은 `visualViewport` 로 모바일 키보드 추적.
  - `src/app/(app)/moontube/page.tsx` 전면 정리 — `stableCount`/`hashSeed`/`SEED_COMMENTS`/`seedCommentsFor` 등 모든 더미 카운트 로직 제거. 모든 카드 카운트는 DB 캐시(`like_count`/`save_count`/`view_count`/`comment_count`) 사용, fallback 영상은 0 표시. `CommentBox`/`CommentThread`/`CommentItem`/`CommentSheet` 내부 함수 제거 → `CommentSection` 한 컴포넌트로 일원화. 댓글 좋아요는 페이지에서 낙관적 토글 + `svcToggleCommentLike` 동기화 + 실패 롤백. `useSupabaseProfile` 로 본인 아바타/닉네임/역할을 시트 입력행에 전달.
  - 쇼츠 풀스크린 UX 개선: 댓글 버튼 → 영상 컨테이너 `100dvh → 40dvh` 축소 + 60dvh `CommentSection` 슬라이드업(Framer Motion spring). 상하 검정 바 제거 — `iframe` 폭을 슬라이드 높이 기준 9:16(`min(100%, var(--slide-h)*9/16)`) 으로 잡고 슬라이드 전체 높이를 채움. 상단 바는 그라데이션 오버레이로 영상 위에 absolute 배치. 댓글 열림 시 메타/액션 영역은 한 줄 컴팩트 모드.
  - 롱폼 상세: `WatchOverlay` 가 `CommentSection`(`variant="inline"`) 을 직접 받아 메타 + 16:9 임베드 + 액션 + 댓글 한 화면에 표시. 채널/조회수/등록 닉네임/저장 수 노출.
  - 롱폼 자동 수집기 보강: `scripts/find-moontube-longform.mjs` 의 `QUERIES` 에 사용자 요청 핵심 키워드(2026 수능 준비/진로 탐색/고등학생 공부법/내신 대비/학교생활 팁) 추가. `package.json` `moontube:find-long` 등록은 2단계에서 완료, 변경 없음.
  - `tsc --noEmit` · `next lint` 통과. 이전 fallback 더미 카운트 의존을 끊었기 때문에 fallback 영상 클릭 시 좋아요 수가 0 부터 시작 — 의도된 동작(가짜 인기 표시 제거).

- **/moontube 2단계 — 롱폼 자동 수집 + Supabase 연동 + 수동 등록**
  - `supabase/migrations/032_moontube_items.sql` 신규 — `moontube_items` 통합 테이블(롱폼+쇼츠, `video_type`). thumbnail_url·like/save/view/comment 집계 캐시 컬럼·`UNIQUE(youtube_id)`·CHECK·부분 인덱스(피드)·유형 인덱스. `update_updated_at_column` 가 코드베이스에 없어 전용 `moontube_touch_updated_at()` 정의(031 패턴). 비소유자 조회수 증가용 `moontube_bump_view()` SECURITY DEFINER RPC. RLS: SELECT 노출상태+admin / INSERT 인증(source=manual·status=visible·created_by 강제) / UPDATE 본인·admin / DELETE admin.
  - `supabase/migrations/033_moontube_likes.sql` 신규 — `moontube_likes`/`moontube_saves`/`moontube_comments` + RLS. 카운트 캐시는 INSERT/DELETE 트리거(SECURITY DEFINER → 비소유자도 RLS 우회 갱신)가 `moontube_items` 에 반영. user_id 는 코드베이스 관례(016/024)대로 `profiles(id)` 참조 → PostgREST 작성자 프로필 embed.
  - `src/lib/moontube-data.ts` 신규 — 통합 `MoontubeItem` 타입/카테고리/`detectVideoType`/임베드·썸네일 유틸 + `getMoontubeFallback()`(YOUTUBE_VIDEOS+MUNTZ_ITEMS_FALLBACK → MoontubeItem, `isFallback:true`).
  - `src/lib/moontube-service.ts` 신규 — `listMoontubeItems`/`createMoontubeItem`/`hideMoontubeItem`/`toggleLike`/`toggleSave`/`getMyReactions`/`listComments`/`createComment`/`deleteComment`/`bumpView`. 금지어 필터 + RLS 위반/중복 분기.
  - `scripts/find-moontube-longform.mjs` 신규 — 문튜브 4종 한국어 검색, 올해·조회수≥1만·길이 61s~20m·embeddable·safeSearch strict·블랙리스트, 카테고리 quota 상위 10개 → `moontube-longform.json`(`videoType:"long"`,`source:"youtube_auto"`,`reviewStatus:"pending"`). `find-muntz-candidates.mjs` 에 `videoType:"short"` 추가 + 20→30. `npm run moontube:find-long`/`moontube:find-all` 추가.
  - `src/app/(app)/moontube/page.tsx` 전면 개편 — 데이터/롱폼·쇼츠 모두 `listMoontubeItems()` 단일 소스(실패·빈결과 → fallback). 좋아요/저장 낙관적 UI+롤백(fallback 은 로컬), 댓글 DB 연동(작성자 프로필·역할 배지·답글·본인/admin 삭제), 공유 `navigator.share`→클립보드 폴백, 조회수 `bumpView`. 등록 모달은 URL 붙여넣기 → `video_type` 자동 감지 → `moontube_items` INSERT 단일 폼. 카드에 조회수/좋아요/댓글 수 DB 값 표시. `tsc --noEmit`·`next lint` 통과.

- **/moontube 피드 레이아웃 변경 — 쇼츠 우선 + 2줄 그리드 교차 배치**
  - `src/app/(app)/moontube/page.tsx` 의 "전체" 탭을 [쇼츠 섹션] → [롱폼 3개] → [쇼츠 섹션] → … 교차 배치로 변경. `buildAllTabBlocks()` 가 롱폼을 3개씩 그룹화하고 쇼츠를 순환 슬라이스로 섹션마다 반복 채움(mock 10개 대응). 쇼츠 카드 클릭 시 index 는 shorts 원본 배열 기준으로 풀스크린 뷰어 진입.
  - 가로 스크롤 1줄 `ShortsSection` → 2줄 그리드로 교체: 모바일 2열×3 / 태블릿 3열×2 / 데스크톱 4열×2(7·8번째는 `hidden lg:block`). `ShortGridCard` 신설 — 9:16 썸네일 + 제목 1줄 + 조회수/좋아요(키 해시 더미). 기존 `ShortThumb` 제거, 쇼츠 카테고리 탭 그리드도 동일 카드로 통일.
  - 쇼츠 섹션 헤더 `ShortsSectionShell` 신설 — 좌측 빨간 🎬 Shorts 칩(유튜브 Shorts 로고 톤), 우측 "모두 보기" → `shortsOnly` 상태로 카테고리 무관 쇼츠 전체 그리드(헤더 우측은 "← 피드로"). 카테고리 칩 클릭 시 `shortsOnly` 자동 해제.
  - `LongList` 컴포넌트로 롱폼 카드 스택 추출(로딩/전체/카테고리 분기 공용). mock 수량은 그대로(쇼츠 10 / 롱폼 10), 피드에서만 반복 배치.
  - 수집량은 쇼츠 30개/일 + 롱폼 10개/일로 변경 예정(상세 [DECISIONS.md](./DECISIONS.md) 2026-05-17 항목). `tsc --noEmit` · `next lint` 통과.

- **문튜브 + 문츠 → "문태 미디어"(/moontube) 통합 (1단계)**
  - `src/app/(app)/moontube/page.tsx` 신규 — 유튜브 앱 스타일 통합 피드. 통합 카테고리 칩(전체 + 롱폼 4 + 쇼츠 6), 전체 탭에서 롱폼 리스트 3번째 뒤에 쇼츠 가로 스크롤 섹션 삽입.
  - 롱폼: 썸네일 카드(`img.youtube.com` 썸네일 + 재생 오버레이) → 클릭 시 워치 오버레이(16:9 임베드 + 액션 + 인라인 댓글). 데이터는 `YOUTUBE_VIDEOS`(정적) + 세션 로컬 추가분.
  - 쇼츠: 가로 행/그리드 썸네일 → 클릭 시 풀스크린 세로 뷰어(기존 /muntz `fixed inset-0`·snap-y·9:16·우측 액션·신고숨김 메뉴 재활용). 데이터는 `listVisibleMuntzItems()` 시도 후 `MUNTZ_ITEMS_FALLBACK`.
  - 댓글/좋아요/저장/조회수는 1단계 로컬 state 더미 — 더미 카운트는 키 FNV 해시로 안정 생성(새로고침 전까지 동일). 댓글은 하단 시트(쇼츠) / 인라인(롱폼), 입력 시 `muntz-profanity` 금지어 필터.
  - 우상단 + 등록 모달: 롱폼/쇼츠 선택 → 롱폼은 로컬 추가(서버 저장 다음 단계), 쇼츠는 기존 `createMuntzItem`(Supabase + RLS) 그대로.
  - `src/components/nav/TopBar.tsx` MEGA_NAV 재편 — 커뮤니티 최상단에 `{ href:"/moontube", label:"문태 미디어 🎬" }` 추가, 학생자치회/학습게시판을 문태 미디어 섹션으로 이동, 기존 `boardType:"youtube"`·`href:"/muntz"` 메뉴 항목 제거.
  - `/muntz`·`/youtube` 는 파일 유지하되 서버단 `redirect("/moontube")` 로 교체 — 기존 URL/북마크/랜딩 메뉴 링크 호환. AppShell·muntz/youtube 라이브러리(`muntz-data`/`muntz-service`/`muntz-profanity`/`youtube-data`)는 그대로 둠.

## 2026-05-16

- **문츠 학생/교사 수동 등록 + Supabase 연동 (1차)**
  - `supabase/migrations/031_muntz_items.sql` 신규 — `muntz_items` 테이블 + RLS.
    - 컬럼: id/youtube_id/youtube_url/title/channel_title/author_nickname/category/target_grade/description/safety_note/source/review_status/created_by/created_at/updated_at + CHECK 제약 + updated_at 트리거.
    - 인덱스: `(review_status, created_at DESC) WHERE review_status IN ('visible','auto_approved')` 부분 인덱스 — 피드 쿼리 최적화.
    - RLS: SELECT는 노출 상태 + admin, INSERT는 인증 사용자 (source/review_status 강제 manual/visible), UPDATE는 본인 또는 admin, DELETE는 admin만.
  - `src/lib/muntz-service.ts` 신규 — `listVisibleMuntzItems()` / `createMuntzItem()` / `hideMuntzItem()` + row↔UI 변환.
  - `src/lib/muntz-profanity.ts` 신규 — 한/영 금지어 부분 매칭, 등록 시 1차 차단 (사후 검수 보조용).
  - `src/lib/muntz-data.ts` 변경 — `extractYoutubeId()` / `gradeLabelToKey()` 헬퍼 추가, `MUNTZ_ITEMS` → `MUNTZ_ITEMS_FALLBACK` 으로 리네임(Supabase 비어있을 때 fallback).
  - `src/app/(app)/muntz/page.tsx` 전면 개편 — 데이터 소스를 mock → Supabase 조회로 교체, 로딩/빈 상태/fallback 배너/토스트 추가. 우상단 `+` 버튼으로 업로드 모달 (URL/제목/닉네임/카테고리/학년/설명 입력). 각 카드 우상단 `⋮` 메뉴 → 신고/숨김 처리 (낙관적 UI + RLS 실패 시 롤백). fullscreen UI/풀스크린 정책 유지.
  - 1차 정책: 학생/교사 수동 등록은 즉시 `visible`. 문제 영상은 RLS 가 본인/admin 만 hidden 처리 허용. UI 단 권한 분기는 TODO.
  - `.env.local` 은 비공개 (gitignore). 영상 자체는 저장하지 않으며 iframe embed 만 사용.
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
