"use client";

// ============================================================================
// 문태 미디어 (MoonTube) — 롱폼(16:9) + 쇼츠(9:16) 통합 피드 · Supabase 연동
// ----------------------------------------------------------------------------
// 유튜브 앱처럼 한 피드에 롱폼 카드와 쇼츠 섹션이 섞여 나온다.
//  · 롱폼 카드: 썸네일 → 클릭 시 상세 모달(임베드 + 메타 + 액션 + 댓글).
//  · 쇼츠 섹션: 피드 맨 위(2줄 그리드) + 롱폼 그룹과 번갈아 →
//    클릭 시 풀스크린 세로 뷰어. "모두 보기" 누르면 쇼츠만 전체 그리드.
//  · 우상단 + : URL 붙여넣기 → 유형 자동 감지(shorts=쇼츠, 그 외=롱폼) → 등록.
//
// 3단계(이번): 카운트와 댓글 시스템 정비.
//  · 좋아요/저장/조회/댓글 수는 DB 캐시 값(like_count, save_count, view_count,
//    comment_count) 만 사용 — fallback 영상은 모두 0 으로 표기(가짜 인기 X).
//  · 댓글 컴포넌트는 src/components/moontube/CommentSection 으로 일원화
//    (멘션 자동완성 + 댓글 좋아요 + 답글 펼침/접기 + 정렬 토글).
//  · 쇼츠 풀스크린에서 댓글 버튼 → 영상 40%/댓글 60% 슬라이드업 (유튜브 동일 UX).
//  · 쇼츠 슬라이드 상하 검정 바 제거 — iframe 이 슬라이드 전체 높이를 채움.
//
// 데이터 흐름:
//  · 영상   = listMoontubeItems() (moontube_items). 실패/빈 결과 → mock fallback.
//  · 좋아요/저장 = toggleLike/toggleSave (낙관적 UI, 실패 시 롤백).
//  · 댓글   = listComments/createComment/deleteComment + 댓글 좋아요 토글.
//  · 공유   = navigator.share, 미지원 시 클립보드 복사.
//  · 등록   = createMoontubeItem (RLS 가 source/상태/작성자 강제).
//  · fallback(mock) 항목은 실 row 가 없어 인터랙션을 로컬 더미로만 처리.
// ============================================================================
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  Clapperboard,
  Heart,
  Loader2,
  MessageCircle,
  MoreVertical,
  Play,
  Plus,
  Search,
  Share2,
  X,
} from "lucide-react";
import {
  MOONTUBE_TABS,
  MOONTUBE_CATEGORIES,
  MOONTUBE_CATEGORY_CUSTOM,
  TARGET_GRADE_LABEL,
  moontubeCategoryColor,
  moontubeEmbedUrl,
  extractYoutubeId,
  detectVideoType,
  youtubeUrlFor,
  getMoontubeFallback,
  formatViewCount,
  formatRelativeDate,
  type MoontubeItem,
  type MoontubeVideoType,
} from "@/lib/moontube-data";
import {
  listMoontubeItems,
  createMoontubeItem,
  ensureMoontubeItem,
  hideMoontubeItem,
  toggleLike as svcToggleLike,
  toggleSave as svcToggleSave,
  toggleCommentLike as svcToggleCommentLike,
  getMyReactions,
  getMyCommentLikes,
  listComments,
  createComment,
  deleteComment,
  bumpView,
  type MoontubeComment,
} from "@/lib/moontube-service";
import { findBannedWordInFields } from "@/lib/muntz-profanity";
import { useSupabaseProfile } from "@/lib/supabase-profile";
import { CommentSection } from "@/components/moontube/CommentSection";
import type { MoontubeUIComment } from "@/components/moontube/types";
import { cn } from "@/lib/utils";

// ─── 통합 카테고리 칩 ────────────────────────────────────────────────────────
// 카테고리는 롱폼/쇼츠 구분 없이 동일 목록(MOONTUBE_CATEGORIES) 을 사용한다.
// 한 카테고리 탭을 누르면 롱폼·쇼츠가 카테고리 일치 여부로만 필터링된다.
type Tab = string;

/** 정렬 모드 — UI 의 정렬 segmented control 과 1:1. */
type SortMode = "latest" | "popular" | "views";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "views", label: "조회순" },
];

/**
 * 정렬 — popular/views 는 카운트 desc, 동률 시 최신순 tiebreak.
 * latest 는 입력 배열 순서를 그대로 유지(=listMoontubeItems 의 created_at desc).
 */
function sortItems(arr: MoontubeItem[], mode: SortMode): MoontubeItem[] {
  if (mode === "latest") return arr;
  const sorted = [...arr];
  const byNewest = (a: MoontubeItem, b: MoontubeItem) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (mode === "popular") {
    sorted.sort((a, b) => b.likeCount - a.likeCount || byNewest(a, b));
  } else {
    sorted.sort((a, b) => b.viewCount - a.viewCount || byNewest(a, b));
  }
  return sorted;
}

/** 좋아요 수 → 인기 뱃지(없을 수도 있음). HOT 이 인기보다 우선. */
function popularityBadge(
  likeCount: number,
): { text: string; className: string } | null {
  if (likeCount >= 50)
    return {
      text: "🔥🔥 HOT",
      className:
        "bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-[0_2px_10px_rgba(244,63,94,0.45)]",
    };
  if (likeCount >= 10)
    return {
      text: "🔥 인기",
      className:
        "bg-orange-500/95 text-white shadow-[0_2px_8px_rgba(249,115,22,0.4)]",
    };
  return null;
}

/** 댓글 수 → 활발한 토론 뱃지. 5개 이상부터 노출. */
function discussionBadge(
  commentCount: number,
): { text: string; className: string } | null {
  if (commentCount >= 5)
    return {
      text: "💬 활발한 토론",
      className:
        "bg-violet-500/95 text-white shadow-[0_2px_8px_rgba(124,58,237,0.4)]",
    };
  return null;
}

/** 1234 → "1.2천", 23456 → "2.3만" 한국어 축약. */
function formatCount(n: number): string {
  if (n >= 10000) return `${trimZero(n / 10000)}만`;
  if (n >= 1000) return `${trimZero(n / 1000)}천`;
  return String(n);
}
function trimZero(v: number): string {
  return v.toFixed(1).replace(/\.0$/, "");
}

/** DB 댓글 → UI 댓글. liked/likeCount 는 부모가 합성해 다시 채운다. */
function toUIComment(
  c: MoontubeComment,
  liked: boolean,
  isFallback = false,
): MoontubeUIComment {
  return {
    id: c.id,
    parentId: c.parentId,
    content: c.content,
    createdAt: c.createdAt,
    authorName: c.author?.nickname ?? "사용자",
    authorRole: c.author?.role ?? null,
    authorAvatarUrl: c.author?.avatarUrl ?? null,
    likeCount: c.likeCount,
    liked,
    isMine: c.isMine,
    canDelete: c.canDelete,
    isFallback,
  };
}

// ============================================================================
// 페이지
// ============================================================================
export default function MoonTubePage() {
  const { user, profile } = useSupabaseProfile();
  const [tab, setTab] = useState<Tab>("전체");
  const [shortsOnly, setShortsOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  // 검색어 — 제목/작성자(channelTitle) 부분 일치. 카테고리 필터와 AND 결합.
  const [searchQuery, setSearchQuery] = useState("");

  const [items, setItems] = useState<MoontubeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  // 인터랙션 상태 (itemId 기준)
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  // 좋아요 진행 중 항목 — fallback 영상에서 resolveDbId 가 끝날 때까지
  // 하트 버튼 비활성(opacity-50 pointer-events-none) + 중복 클릭 차단.
  // ref 는 동기적으로 즉시 확인하기 위함(set/check race 회피), state 는 UI 반영.
  const [likeBusy, setLikeBusy] = useState<Set<string>>(new Set());
  const likeBusyRef = useRef<Set<string>>(new Set());
  // itemId → 댓글 목록 캐시 (열 때 로드). 캐시에 있는 항목의 liked/likeCount 는
  // 토글 시 그 자리에서 갱신한다.
  const [commentsMap, setCommentsMap] = useState<
    Record<string, MoontubeUIComment[]>
  >({});

  // ── fallback 영상 → 실 DB id 매핑 ────────────────────────────────────────
  // fallback 영상은 moontube_items 에 행이 없어 좋아요/댓글 외래키가 안 잡힌다.
  // 사용자가 fallback 에 좋아요/댓글을 시도하는 순간 ensureMoontubeItem 으로
  // 실 DB row 를 만들고 그 id 를 캐시한다. 같은 영상에 재인터랙션 시 캐시된
  // DB id 를 그대로 사용.
  //  · realIdMap: 확정된 매핑 (fallback id → DB id)
  //  · pendingMap: 진행 중 promote Promise — 동시 클릭 시 한 번만 INSERT 되도록 공유
  // state(items, commentsMap, liked, saved) 는 그대로 fallback id 를 키로 유지.
  // DB 호출 시에만 매핑된 실 id 를 쓴다 → 스냅샷(viewer.list) 와 ref 일관성 유지.
  const realIdMapRef = useRef<Map<string, string>>(new Map());
  const pendingPromoteRef = useRef<
    Map<string, Promise<string | null>>
  >(new Map());

  /**
   * fallback 영상이면 DB row 를 보장하고 실 DB id 를 반환.
   * 일반(실 DB) 영상이면 자기 id 를 그대로 반환.
   * 로그인 X + DB 에도 없으면 null → 호출 측이 기존 로컬 더미 동작으로 폴백.
   */
  const resolveDbId = useCallback(
    async (item: MoontubeItem): Promise<string | null> => {
      console.log(
        "[moontube] resolveDbId 시작, isFallback:",
        item.isFallback,
        "기존캐시:",
        realIdMapRef.current.get(item.id),
      );
      if (!item.isFallback) {
        console.log("[moontube] resolveDbId 완료, dbId:", item.id);
        return item.id;
      }
      const cached = realIdMapRef.current.get(item.id);
      if (cached) {
        console.log("[moontube] resolveDbId 완료, dbId:", cached);
        return cached;
      }
      const pending = pendingPromoteRef.current.get(item.id);
      if (pending) return pending;
      const p = (async () => {
        const res = await ensureMoontubeItem({
          youtubeId: item.youtubeId,
          youtubeUrl: item.youtubeUrl,
          title: item.title,
          channelTitle: item.channelTitle,
          authorNickname: item.authorNickname,
          videoType: item.videoType,
          category: item.category,
          targetGrade: item.targetGrade,
          description: item.description,
        });
        pendingPromoteRef.current.delete(item.id);
        if (!res.ok) {
          console.log("[moontube] resolveDbId 완료, dbId:", null);
          return null;
        }
        realIdMapRef.current.set(item.id, res.id);
        console.log("[moontube] resolveDbId 완료, dbId:", res.id);
        return res.id;
      })();
      pendingPromoteRef.current.set(item.id, p);
      return p;
    },
    [],
  );

  // 오버레이/모달
  const [watch, setWatch] = useState<MoontubeItem | null>(null);
  const [viewer, setViewer] = useState<{
    list: MoontubeItem[];
    index: number;
  } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // ── 영상 로드 — Supabase + fallback 병합 ─────────────────────────────────
  // DB 영상이 1개라도 있으면 그것이 맨 위(우선순위), 그 뒤로 fallback 중
  // DB 에 같은 youtube_id 가 없는 항목만 이어 붙인다. 사용자에게는 자연스럽게
  // 섞여 보이고, DB 영상 1개만 등록되어도 fallback 9+10 개가 사라지지 않는다.
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const remote = await listMoontubeItems();
      const fallback = getMoontubeFallback();
      const remoteYtIds = new Set(remote.map((r) => r.youtubeId));
      const merged: MoontubeItem[] = [
        ...remote,
        ...fallback.filter((f) => !remoteYtIds.has(f.youtubeId)),
      ];
      setItems(merged);
      // 안내 배너는 DB 영상이 하나도 없을 때만 노출
      setUsingFallback(remote.length === 0);
      // 내 좋아요/저장 상태는 실 DB 영상에만 의미가 있어 그 ID 만 조회
      if (remote.length > 0) {
        const ids = remote.map((it) => it.id);
        const my = await getMyReactions(ids);
        setLiked(my.liked);
        setSaved(my.saved);
      } else {
        setLiked(new Set());
        setSaved(new Set());
      }
    } catch {
      setItems(getMoontubeFallback());
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const overlayOpen = !!watch || !!viewer;
  useEffect(() => {
    if (!overlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlayOpen]);

  // ── 파생 목록 ─────────────────────────────────────────────────────────────
  // 정렬 모드를 적용해 longs/shorts 를 만들고, 카테고리 필터는 그 위에 얹는다.
  const longs = useMemo(
    () => sortItems(items.filter((it) => it.videoType === "long"), sortMode),
    [items, sortMode],
  );
  const shorts = useMemo(
    () => sortItems(items.filter((it) => it.videoType === "short"), sortMode),
    [items, sortMode],
  );

  /** 좋아요 수 기준 상위 5개 (롱폼·쇼츠 통합). 0 개는 제외. */
  const popularItems = useMemo(() => {
    return [...items]
      .filter((it) => it.likeCount > 0)
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, 5);
  }, [items]);

  // 통합 카테고리 + 검색어(제목/작성자) — 둘 다 AND 로 결합해 필터링.
  const matchesSearch = useCallback(
    (it: MoontubeItem, q: string) =>
      it.title.toLowerCase().includes(q) ||
      (it.channelTitle?.toLowerCase().includes(q) ?? false),
    [],
  );
  const longFiltered = useMemo(() => {
    const byCat =
      tab === "전체" ? longs : longs.filter((v) => v.category === tab);
    const q = searchQuery.trim().toLowerCase();
    return q ? byCat.filter((v) => matchesSearch(v, q)) : byCat;
  }, [longs, tab, searchQuery, matchesSearch]);
  const shortsFiltered = useMemo(() => {
    const byCat =
      tab === "전체" ? shorts : shorts.filter((s) => s.category === tab);
    const q = searchQuery.trim().toLowerCase();
    return q ? byCat.filter((s) => matchesSearch(s, q)) : byCat;
  }, [shorts, tab, searchQuery, matchesSearch]);

  // ── 인터랙션 헬퍼 ─────────────────────────────────────────────────────────
  const isLiked = useCallback((id: string) => liked.has(id), [liked]);
  const isSaved = useCallback((id: string) => saved.has(id), [saved]);
  const isLikeBusy = useCallback((id: string) => likeBusy.has(id), [likeBusy]);

  /** 모든 카운트는 DB 캐시(real) / fallback 영상은 0. 가짜 인기 표시 X.
   *  ShortsViewer 는 `viewer.list` 스냅샷을 보유 → setItems 후에도 그 스냅샷의
   *  `item.likeCount` 는 stale. 그래서 라이브 items 에서 같은 id 항목을 찾아
   *  최신 likeCount/viewCount 를 반환한다. 매칭은 id 우선, fallback 으로
   *  youtubeId 도 확인(승격 등으로 id 가 바뀌어도 안전). */
  const likeCountOf = useCallback(
    (item: MoontubeItem) => {
      const live = items.find(
        (it) => it.id === item.id || it.youtubeId === item.youtubeId,
      );
      return live?.likeCount ?? item.likeCount;
    },
    [items],
  );
  const viewCountOf = useCallback(
    (item: MoontubeItem) => {
      const live = items.find(
        (it) => it.id === item.id || it.youtubeId === item.youtubeId,
      );
      return live?.viewCount ?? item.viewCount;
    },
    [items],
  );
  const commentCountOf = useCallback(
    (item: MoontubeItem): number => {
      // 이미 로드해 본 적 있으면 실시간 길이, 아니면 DB 캐시
      const loaded = commentsMap[item.id];
      return loaded ? loaded.length : item.commentCount;
    },
    [commentsMap],
  );

  /** 낙관적 좋아요 토글 — 실패 시 롤백.
   *  핵심 순서:
   *   1) likeBusy 켜고 (하트 disabled) → resolveDbId 를 await
   *   2) await 완료 후에만 낙관적 UI 반영 — null id 로 서버 호출이 새는
   *      케이스 + 미완료 dbId 로 잘못된 낙관적 반영 모두 차단.
   *   3) 서버 호출 → 실패 시 likedSet/likeCount 모두 롤백.
   *  · 실 DB 영상이라도 일관성을 위해 await 경로를 통과(즉시 반환). */
  const toggleLike = useCallback(
    async (item: MoontubeItem) => {
      console.log(
        "[moontube] toggleLike 호출됨, item:",
        item.youtubeId,
        "isFallback:",
        item.isFallback,
      );
      const id = item.id;

      // 진행 중인 좋아요 처리가 있으면 즉시 무시(중복 클릭 차단)
      if (likeBusyRef.current.has(id)) return;

      const wasLiked = liked.has(id);

      // 1) busy 켜기 — resolveDbId 결과가 나올 때까지 하트 disabled
      likeBusyRef.current.add(id);
      setLikeBusy((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      // 2) resolveDbId 를 항상 await — 캐시 hit 이라도 동일 경로
      let dbId: string | null = null;
      try {
        dbId = await resolveDbId(item);
        console.log(
          "[moontube] resolveDbId 결과:",
          dbId,
          "item.id:",
          id,
          "isFallback:",
          item.isFallback,
        );
      } finally {
        likeBusyRef.current.delete(id);
        setLikeBusy((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }

      // 3) DB row 확보 실패(미로그인 등) → 토글 자체 포기
      if (!dbId) {
        setToast("로그인 후 이용할 수 있어요");
        return;
      }

      // 4) 낙관적 반영 — resolveDbId 완료 후, 서버 호출 직전
      const currentCount =
        items.find(
          (it) => it.id === id || it.youtubeId === item.youtubeId,
        )?.likeCount ?? item.likeCount;
      console.log(
        "[moontube] 낙관적 UI 업데이트, dbId:",
        dbId,
        "현재 likeCount:",
        currentCount,
        "liked:",
        wasLiked,
      );
      setLiked((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(id);
        else next.add(id);
        return next;
      });
      setItems((prev) =>
        prev.map((it) =>
          it.id === id || it.youtubeId === item.youtubeId
            ? {
                ...it,
                likeCount: Math.max(
                  0,
                  it.likeCount + (wasLiked ? -1 : 1),
                ),
              }
            : it,
        ),
      );

      // 5) 서버 반영 + 실패 시 롤백
      const res = await svcToggleLike(dbId);
      console.log(
        "[moontube] toggleLike 서버 응답:",
        res,
        "dbId:",
        dbId,
        "wasLiked:",
        wasLiked,
      );
      if (!res.ok) {
        setLiked((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(id);
          else next.delete(id);
          return next;
        });
        setItems((prev) =>
          prev.map((it) =>
            it.id === id || it.youtubeId === item.youtubeId
              ? {
                  ...it,
                  likeCount: Math.max(
                    0,
                    it.likeCount + (wasLiked ? 1 : -1),
                  ),
                }
              : it,
          ),
        );
        setToast("좋아요 처리에 실패했어요");
      }
    },
    [liked, resolveDbId, items],
  );

  /** 낙관적 저장 토글 — 실패 시 롤백. fallback 도 ensureMoontubeItem 으로 승격. */
  const toggleSave = useCallback(
    async (item: MoontubeItem) => {
      const id = item.id;
      const wasSaved = saved.has(id);
      setSaved((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(id);
        else next.add(id);
        return next;
      });
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                saveCount: Math.max(0, it.saveCount + (wasSaved ? -1 : 1)),
              }
            : it,
        ),
      );
      setToast(wasSaved ? "저장을 해제했어요" : "저장했어요");

      const dbId = await resolveDbId(item);
      if (!dbId) return;

      const res = await svcToggleSave(dbId);
      if (!res.ok) {
        setSaved((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(id);
          else next.delete(id);
          return next;
        });
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  saveCount: Math.max(0, it.saveCount + (wasSaved ? 1 : -1)),
                }
              : it,
          ),
        );
        setToast("저장 처리에 실패했어요");
      }
    },
    [saved, resolveDbId],
  );

  /** 공유 — Web Share API, 미지원 시 클립보드 복사 */
  const share = useCallback(async (item: MoontubeItem) => {
    const url = item.youtubeUrl;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: item.title, url });
        return;
      }
    } catch (e) {
      const err = e as { name?: string };
      if (err?.name === "AbortError") return; // 사용자가 취소
      // 그 외엔 클립보드 폴백
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast("링크를 복사했어요");
    } catch {
      setToast("링크 복사에 실패했어요");
    }
  }, []);

  /** 댓글 로드 (열 때 호출).
   *  fallback 영상도 ensureMoontubeItem 으로 DB row 를 확보한 뒤 그 id 로 조회.
   *  DB row 가 새로 만들어진 경우 댓글이 0개인 것이 정상이다 — 절대 다른 영상의
   *  댓글이 섞이지 않는다(영상별로 고유한 실 DB id 를 사용하므로).
   *  미로그인 + DB 에도 없으면 빈 목록 (기존 fallback 데모 동작). */
  const loadComments = useCallback(
    async (item: MoontubeItem) => {
      if (commentsMap[item.id]) return;

      const dbId = await resolveDbId(item);
      if (!dbId) {
        setCommentsMap((prev) => ({ ...prev, [item.id]: [] }));
        return;
      }

      const list = await listComments(dbId);
      const ids = list.map((c) => c.id);
      const myLikes = await getMyCommentLikes(ids);
      setCommentsMap((prev) => ({
        ...prev,
        // commentsMap 키는 항상 item.id (= viewer.list 스냅샷과 일치) 로 유지
        [item.id]: list.map((c) => toUIComment(c, myLikes.has(c.id))),
      }));
    },
    [commentsMap, resolveDbId],
  );

  const getComments = useCallback(
    (id: string): MoontubeUIComment[] => commentsMap[id] ?? [],
    [commentsMap],
  );

  /** 댓글 추가 (멘션 옵션 포함).
   *  fallback 영상도 ensureMoontubeItem 으로 DB row 를 확보한 뒤 실 댓글로 저장.
   *  미로그인 + DB row 없음일 때만 로컬 더미로 폴백(데모 동작). */
  const addComment = useCallback(
    async (
      item: MoontubeItem,
      text: string,
      opts?: { parentId?: string | null; mentionUserId?: string | null },
    ): Promise<{ ok: boolean; message?: string }> => {
      const banned = findBannedWordInFields([text]);
      if (banned) {
        return {
          ok: false,
          message: `부적절한 단어가 포함되어 있어요: "${banned}"`,
        };
      }

      const dbId = await resolveDbId(item);

      // 로그인 + DB id 확보 가능 → 실 DB 댓글로 저장 (fallback 포함)
      if (dbId && user) {
        const res = await createComment(
          dbId,
          text,
          opts?.parentId ?? null,
          opts?.mentionUserId ?? null,
        );
        if (!res.ok) return { ok: false, message: res.message };

        setCommentsMap((prev) => ({
          ...prev,
          [item.id]: [
            ...(prev[item.id] ?? []),
            toUIComment(res.comment, false),
          ],
        }));
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, commentCount: it.commentCount + 1 }
              : it,
          ),
        );
        return { ok: true };
      }

      // fallback + 미로그인 → 로컬 더미만 (기존 데모 동작 유지)
      if (item.isFallback) {
        const mine: MoontubeUIComment = {
          id: `me-${Date.now()}`,
          parentId: opts?.parentId ?? null,
          content: text,
          createdAt: new Date().toISOString(),
          authorName: profile?.nickname ?? "나",
          authorRole: profile?.role ?? "student",
          authorAvatarUrl: profile?.avatar_url ?? null,
          likeCount: 0,
          liked: false,
          isMine: true,
          canDelete: true,
          isFallback: true,
        };
        setCommentsMap((prev) => ({
          ...prev,
          [item.id]: [...(prev[item.id] ?? []), mine],
        }));
        return { ok: true };
      }

      return { ok: false, message: "로그인 후 댓글을 작성할 수 있어요." };
    },
    [user, profile, resolveDbId],
  );

  /** 댓글 삭제 (낙관적).
   *  로컬 더미 댓글(id 가 "me-" 로 시작) 은 DB 호출 없이 로컬에서만 제거.
   *  그 외는 모두 실 DB 댓글(fallback 영상이라도 ensureMoontubeItem 으로
   *  승격된 후 작성된 것) 이므로 DB deleteComment 호출. */
  const removeComment = useCallback(
    async (item: MoontubeItem, commentId: string) => {
      const before = commentsMap[item.id] ?? [];
      setCommentsMap((prev) => ({
        ...prev,
        [item.id]: (prev[item.id] ?? []).filter(
          (c) => c.id !== commentId && c.parentId !== commentId,
        ),
      }));

      // 로컬 더미는 여기서 종료
      if (commentId.startsWith("me-")) return;

      const res = await deleteComment(commentId);
      if (!res.ok) {
        setCommentsMap((prev) => ({ ...prev, [item.id]: before }));
        setToast(res.message);
        return;
      }
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, commentCount: Math.max(0, it.commentCount - 1) }
            : it,
        ),
      );
      setToast(res.message);
    },
    [commentsMap],
  );

  /** 댓글 좋아요 토글 (낙관적).
   *  로컬 더미 댓글(id 가 "me-" 시작) 은 로컬만 토글.
   *  그 외는 실 DB 댓글(fallback 영상 포함) 이므로 svcToggleCommentLike 호출. */
  const toggleCommentLike = useCallback(
    async (item: MoontubeItem, commentId: string) => {
      const list = commentsMap[item.id];
      if (!list) return;
      const current = list.find((c) => c.id === commentId);
      if (!current) return;
      const wasLiked = current.liked;

      // 1) 낙관적 반영
      setCommentsMap((prev) => ({
        ...prev,
        [item.id]: (prev[item.id] ?? []).map((c) =>
          c.id === commentId
            ? {
                ...c,
                liked: !wasLiked,
                likeCount: Math.max(0, c.likeCount + (wasLiked ? -1 : 1)),
              }
            : c,
        ),
      }));

      // 로컬 더미는 여기서 종료
      if (commentId.startsWith("me-")) return;

      // 2) 서버 반영 + 실패 롤백
      const res = await svcToggleCommentLike(commentId);
      if (!res.ok) {
        setCommentsMap((prev) => ({
          ...prev,
          [item.id]: (prev[item.id] ?? []).map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  liked: wasLiked,
                  likeCount: Math.max(0, c.likeCount + (wasLiked ? 1 : -1)),
                }
              : c,
          ),
        }));
        setToast("댓글 좋아요 처리에 실패했어요");
      }
    },
    [commentsMap],
  );

  const handleHide = useCallback(
    async (item: MoontubeItem) => {
      if (item.isFallback) {
        setToast("샘플 영상은 숨길 수 없어요");
        return;
      }
      const before = items;
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      const res = await hideMoontubeItem(item.id);
      if (!res.ok) setItems(before);
      setToast(res.message);
    },
    [items],
  );

  /** 조회수 +1 (열 때). fallback 은 무시. */
  const handleView = useCallback((item: MoontubeItem) => {
    if (item.isFallback) return;
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id ? { ...it, viewCount: it.viewCount + 1 } : it,
      ),
    );
    void bumpView(item.id);
  }, []);

  // 오버레이가 가리키는 최신 item (state 변경 반영)
  const watchItem = useMemo(
    () => (watch ? items.find((it) => it.id === watch.id) ?? watch : null),
    [watch, items],
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-1">
      {/* ── 헤더 ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-4 flex items-end justify-between gap-3 px-2 pt-1"
      >
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-violet-500/15 text-violet-500 dark:text-violet-400">
              <Clapperboard className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              Moon
              <span className="rounded-sm bg-red-600 px-1 text-white">
                Tube
              </span>
            </h1>
          </div>
          <p className="text-sm text-foreground/55">
            문튜브 롱폼과 문츠 쇼츠를 한 곳에서 — 함께 보고, 함께 나눠요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          aria-label="영상 등록"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          <span className="hidden sm:inline">등록</span>
        </button>
      </motion.div>

      {/* ── 검색 입력창 ──────────────────────────────────────────────── */}
      <div className="mb-3 px-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40"
            aria-hidden
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="제목·채널 검색"
            aria-label="영상 검색"
            className="w-full rounded-2xl border border-foreground/10 bg-foreground/5 py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-foreground/40 outline-none transition-colors focus:border-violet-500/50 focus:bg-foreground/[0.07]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="검색어 지우기"
              className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-foreground/45 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── 카테고리 칩 ──────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="문태 미디어 카테고리"
        className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {MOONTUBE_TABS.map((t) => {
          const active = tab === t;
          const accent = moontubeCategoryColor(t);
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(t);
                setShortsOnly(false);
              }}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
                  : "bg-foreground/5 text-foreground/65 hover:bg-foreground/10 hover:text-foreground",
              )}
              style={active ? { background: accent } : undefined}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* ── 정렬 토글 ────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-end px-2">
        <SortToggle value={sortMode} onChange={setSortMode} />
      </div>

      {/* ── 🔥 인기 영상 캐러셀 — 전체 탭 + 좋아요>0 영상이 있을 때만 ── */}
      {tab === "전체" && !shortsOnly && !searchQuery.trim() && popularItems.length > 0 && (
        <PopularSection
          items={popularItems}
          onOpenLong={(it) => {
            setWatch(it);
            void loadComments(it);
            handleView(it);
          }}
          onOpenShort={(it) => {
            const idx = shorts.findIndex((s) => s.id === it.id);
            setViewer({ list: shorts, index: Math.max(0, idx) });
          }}
        />
      )}

      {/* ── 피드 ─────────────────────────────────────────────────────── */}
      <Feed
        tab={tab}
        shortsOnly={shortsOnly}
        longFiltered={longFiltered}
        shortsFiltered={shortsFiltered}
        shortsAll={shorts}
        loading={loading}
        onOpenLong={(it) => {
          setWatch(it);
          void loadComments(it);
          handleView(it);
        }}
        onOpenShorts={(list, index) => setViewer({ list, index })}
        onSeeAllShorts={() => setShortsOnly(true)}
        onExitShortsOnly={() => setShortsOnly(false)}
        isLiked={isLiked}
        isLikeBusy={isLikeBusy}
        toggleLike={toggleLike}
        likeCountOf={likeCountOf}
        viewCountOf={viewCountOf}
        commentCountOf={commentCountOf}
      />

      {usingFallback && !loading && (
        <p className="mt-6 rounded-xl bg-amber-500/10 px-4 py-2 text-center text-xs font-semibold text-amber-600 dark:text-amber-400">
          아직 등록된 영상이 없어 샘플을 보여드리고 있어요
        </p>
      )}

      {/* ── 롱폼 상세 모달 ──────────────────────────────────────────── */}
      <AnimatePresence>
        {watchItem && (
          <WatchOverlay
            video={watchItem}
            liked={isLiked(watchItem.id)}
            saved={isSaved(watchItem.id)}
            likeBusy={isLikeBusy(watchItem.id)}
            likeCount={likeCountOf(watchItem)}
            viewCount={viewCountOf(watchItem)}
            saveCount={watchItem.saveCount}
            comments={getComments(watchItem.id)}
            currentUserId={user?.id ?? null}
            allowAnonymousWrite={watchItem.isFallback === true}
            selfAvatar={{
              nickname: profile?.nickname,
              role: profile?.role,
              avatarUrl: profile?.avatar_url,
            }}
            onClose={() => setWatch(null)}
            onToggleLike={() => void toggleLike(watchItem)}
            onToggleSave={() => void toggleSave(watchItem)}
            onShare={() => void share(watchItem)}
            onAddComment={(t, o) => addComment(watchItem, t, o)}
            onDeleteComment={(cid) => void removeComment(watchItem, cid)}
            onToggleCommentLike={(cid) =>
              void toggleCommentLike(watchItem, cid)
            }
          />
        )}
      </AnimatePresence>

      {/* ── 풀스크린 쇼츠 뷰어 ──────────────────────────────────────── */}
      <AnimatePresence>
        {viewer && (
          <ShortsViewer
            list={viewer.list}
            initialIndex={viewer.index}
            onClose={() => setViewer(null)}
            isLiked={isLiked}
            isSaved={isSaved}
            isLikeBusy={isLikeBusy}
            likeCountOf={likeCountOf}
            commentCountOf={commentCountOf}
            toggleLike={toggleLike}
            toggleSave={toggleSave}
            getComments={getComments}
            loadComments={loadComments}
            addComment={addComment}
            deleteComment={removeComment}
            toggleCommentLike={toggleCommentLike}
            onShare={share}
            onHide={handleHide}
            onView={handleView}
            currentUserId={user?.id ?? null}
            selfAvatar={{
              nickname: profile?.nickname,
              role: profile?.role,
              avatarUrl: profile?.avatar_url,
            }}
          />
        )}
      </AnimatePresence>

      {/* ── 등록 모달 ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {uploadOpen && (
          <UploadModal
            userId={user?.id ?? null}
            onClose={() => setUploadOpen(false)}
            onSuccess={(msg) => {
              setToast(msg);
              setUploadOpen(false);
              void reload();
            }}
          />
        )}
      </AnimatePresence>

      {/* ── 토스트 ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-black/85 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md md:bottom-8"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// 피드 — 쇼츠 섹션 먼저 → 롱폼 그룹과 번갈아 (유튜브 앱 스타일)
// ============================================================================
const SHORTS_PER_SECTION = 8;
const LONG_PER_GROUP = 3;

type FeedBlock =
  | { type: "shorts"; items: { item: MoontubeItem; index: number }[] }
  | { type: "long"; items: MoontubeItem[] };

function buildAllTabBlocks(
  longs: MoontubeItem[],
  shorts: MoontubeItem[],
): FeedBlock[] {
  const blocks: FeedBlock[] = [];
  const longGroups: MoontubeItem[][] = [];
  for (let i = 0; i < longs.length; i += LONG_PER_GROUP) {
    longGroups.push(longs.slice(i, i + LONG_PER_GROUP));
  }

  const chunkSize = Math.min(SHORTS_PER_SECTION, shorts.length);
  let cursor = 0;
  const nextShortsChunk = (): { item: MoontubeItem; index: number }[] => {
    if (shorts.length === 0) return [];
    const chunk: { item: MoontubeItem; index: number }[] = [];
    for (let k = 0; k < chunkSize; k += 1) {
      const idx = (cursor + k) % shorts.length;
      chunk.push({ item: shorts[idx], index: idx });
    }
    cursor = (cursor + chunkSize) % shorts.length;
    return chunk;
  };

  if (shorts.length > 0) blocks.push({ type: "shorts", items: nextShortsChunk() });
  longGroups.forEach((g) => {
    blocks.push({ type: "long", items: g });
    if (shorts.length > 0) {
      blocks.push({ type: "shorts", items: nextShortsChunk() });
    }
  });
  return blocks;
}

function LongList({
  videos,
  isLiked,
  isLikeBusy,
  toggleLike,
  likeCountOf,
  viewCountOf,
  commentCountOf,
  onOpenLong,
}: {
  videos: MoontubeItem[];
  isLiked: (id: string) => boolean;
  isLikeBusy: (id: string) => boolean;
  toggleLike: (it: MoontubeItem) => void;
  likeCountOf: (it: MoontubeItem) => number;
  viewCountOf: (it: MoontubeItem) => number;
  commentCountOf: (it: MoontubeItem) => number;
  onOpenLong: (v: MoontubeItem) => void;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      className="flex flex-col gap-5"
    >
      {videos.map((v) => (
        <LongCard
          key={v.id}
          video={v}
          liked={isLiked(v.id)}
          likeBusy={isLikeBusy(v.id)}
          likeCount={likeCountOf(v)}
          viewCount={viewCountOf(v)}
          commentCount={commentCountOf(v)}
          onToggleLike={() => toggleLike(v)}
          onClick={() => onOpenLong(v)}
        />
      ))}
    </motion.div>
  );
}

function Feed({
  tab,
  shortsOnly,
  longFiltered,
  shortsFiltered,
  shortsAll,
  loading,
  onOpenLong,
  onOpenShorts,
  onSeeAllShorts,
  onExitShortsOnly,
  isLiked,
  isLikeBusy,
  toggleLike,
  likeCountOf,
  viewCountOf,
  commentCountOf,
}: {
  tab: Tab;
  shortsOnly: boolean;
  longFiltered: MoontubeItem[];
  shortsFiltered: MoontubeItem[];
  shortsAll: MoontubeItem[];
  loading: boolean;
  onOpenLong: (v: MoontubeItem) => void;
  onOpenShorts: (list: MoontubeItem[], index: number) => void;
  onSeeAllShorts: () => void;
  onExitShortsOnly: () => void;
  isLiked: (id: string) => boolean;
  isLikeBusy: (id: string) => boolean;
  toggleLike: (it: MoontubeItem) => void;
  likeCountOf: (it: MoontubeItem) => number;
  viewCountOf: (it: MoontubeItem) => number;
  commentCountOf: (it: MoontubeItem) => number;
}) {
  if (shortsOnly) {
    if (loading) return <FeedLoading label="불러오는 중..." />;
    if (shortsAll.length === 0)
      return <EmptyBox text="등록된 쇼츠가 아직 없어요." />;
    return (
      <ShortsSectionShell
        action={
          <button
            type="button"
            onClick={onExitShortsOnly}
            className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[12px] font-semibold text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            피드로
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {shortsAll.map((s, i) => (
            <ShortGridCard
              key={s.id}
              item={s}
              viewCount={viewCountOf(s)}
              likeCount={likeCountOf(s)}
              onClick={() => onOpenShorts(shortsAll, i)}
            />
          ))}
        </div>
      </ShortsSectionShell>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 px-2">
        <ShortsSection
          loading
          items={[]}
          onOpen={() => {}}
          onSeeAll={onSeeAllShorts}
          viewCountOf={viewCountOf}
          likeCountOf={likeCountOf}
        />
      </div>
    );
  }

  if (longFiltered.length === 0 && shortsFiltered.length === 0)
    return (
      <EmptyBox
        text={
          tab === "전체"
            ? "아직 등록된 영상이 없어요."
            : "이 카테고리의 영상이 아직 없어요."
        }
      />
    );

  const blocks = buildAllTabBlocks(longFiltered, shortsFiltered);
  return (
    <div className="flex flex-col gap-6 px-2">
      {blocks.map((b, bi) =>
        b.type === "shorts" ? (
          <ShortsSection
            key={`b-${bi}`}
            loading={false}
            items={b.items}
            onOpen={(idx) => onOpenShorts(shortsFiltered, idx)}
            onSeeAll={onSeeAllShorts}
            viewCountOf={viewCountOf}
            likeCountOf={likeCountOf}
          />
        ) : (
          <LongList
            key={`b-${bi}`}
            videos={b.items}
            isLiked={isLiked}
            isLikeBusy={isLikeBusy}
            toggleLike={toggleLike}
            likeCountOf={likeCountOf}
            viewCountOf={viewCountOf}
            commentCountOf={commentCountOf}
            onOpenLong={onOpenLong}
          />
        ),
      )}
    </div>
  );
}

// ─── 롱폼 카드 ──────────────────────────────────────────────────────────────
function LongCard({
  video,
  liked,
  likeBusy,
  likeCount,
  viewCount,
  commentCount,
  onToggleLike,
  onClick,
}: {
  video: MoontubeItem;
  liked: boolean;
  likeBusy: boolean;
  likeCount: number;
  viewCount: number;
  commentCount: number;
  onToggleLike: () => void;
  onClick: () => void;
}) {
  const accent = moontubeCategoryColor(video.category);
  // 인기/토론 뱃지 — 카운트 임계치에 따라 자동 결정. null 이면 미노출.
  const popBadge = popularityBadge(likeCount);
  const discBadge = discussionBadge(commentCount);

  return (
    <motion.article
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0 },
      }}
      className="glass group overflow-hidden rounded-2xl ring-1 ring-inset ring-white/5"
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={`${video.title} 재생`}
        className="relative block aspect-video w-full overflow-hidden bg-black/40"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            video.thumbnailUrl ??
            `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`
          }
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* 좌상단 뱃지들 — 카테고리 + (선택) 인기/HOT + (선택) 활발한 토론 */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-md"
            style={{ background: `${accent}cc` }}
          >
            {video.category}
          </span>
          {popBadge && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10.5px] font-extrabold",
                popBadge.className,
              )}
            >
              {popBadge.text}
            </span>
          )}
          {discBadge && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                discBadge.className,
              )}
            >
              {discBadge.text}
            </span>
          )}
        </div>
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-black/55 text-white opacity-90 backdrop-blur-md transition-transform group-hover:scale-110">
            <Play className="h-6 w-6 translate-x-0.5 fill-white" />
          </span>
        </span>
      </button>

      <div className="flex flex-col gap-2 px-4 py-3">
        <button type="button" onClick={onClick} className="text-left">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
            {video.title}
          </h3>
          <p className="mt-1 text-[11px] text-foreground/45">
            {video.channelTitle ? `${video.channelTitle} · ` : "문튜브 · "}
            조회수 {formatViewCount(viewCount)}회
            {video.publishedAt && ` · ${formatRelativeDate(video.publishedAt)}`}
          </p>
        </button>
        <div className="flex items-center gap-1 pt-1">
          <InlineAction
            icon={Heart}
            label={formatCount(likeCount)}
            active={liked}
            activeColor="#ec4899"
            loading={likeBusy}
            onClick={onToggleLike}
          />
          <InlineAction
            icon={MessageCircle}
            label={String(commentCount)}
            onClick={onClick}
          />
          <InlineAction icon={Share2} label="공유" onClick={onClick} />
        </div>
      </div>
    </motion.article>
  );
}

function InlineAction({
  icon: Icon,
  label,
  active = false,
  activeColor,
  loading = false,
  onClick,
}: {
  icon: typeof Heart;
  label: string;
  active?: boolean;
  activeColor?: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (loading) return;
        onClick();
      }}
      aria-pressed={active}
      aria-busy={loading}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground",
        loading && "pointer-events-none opacity-50",
      )}
    >
      <Icon
        className="h-4 w-4"
        strokeWidth={2.2}
        style={
          active && activeColor
            ? { color: activeColor, fill: activeColor }
            : undefined
        }
      />
      {label}
    </button>
  );
}

// ─── 쇼츠 섹션 ──────────────────────────────────────────────────────────────
function ShortsSectionShell({
  action,
  children,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-foreground/[0.03] px-3 py-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FF0033] px-2.5 py-1 text-[12px] font-extrabold tracking-tight text-white shadow-[0_2px_10px_rgba(255,0,51,0.45)]">
          <span aria-hidden>🎬</span> Shorts
        </span>
        {action}
      </div>
      {children}
    </section>
  );
}

function ShortsSection({
  loading,
  items,
  onOpen,
  onSeeAll,
  viewCountOf,
  likeCountOf,
}: {
  loading: boolean;
  items: { item: MoontubeItem; index: number }[];
  onOpen: (index: number) => void;
  onSeeAll: () => void;
  viewCountOf: (it: MoontubeItem) => number;
  likeCountOf: (it: MoontubeItem) => number;
}) {
  const seeAll = (
    <button
      type="button"
      onClick={onSeeAll}
      className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[12px] font-semibold text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
    >
      모두 보기
      <ChevronRight className="h-3.5 w-3.5" />
    </button>
  );

  if (loading)
    return (
      <ShortsSectionShell action={seeAll}>
        <FeedLoading label="불러오는 중..." />
      </ShortsSectionShell>
    );
  if (items.length === 0) return null;

  return (
    <ShortsSectionShell action={seeAll}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map(({ item, index }, pos) => (
          <div
            key={`${pos}-${item.id}`}
            className={pos >= 6 ? "hidden lg:block" : undefined}
          >
            <ShortGridCard
              item={item}
              viewCount={viewCountOf(item)}
              likeCount={likeCountOf(item)}
              onClick={() => onOpen(index)}
            />
          </div>
        ))}
      </div>
    </ShortsSectionShell>
  );
}

function ShortGridCard({
  item,
  viewCount,
  likeCount,
  onClick,
}: {
  item: MoontubeItem;
  viewCount: number;
  likeCount: number;
  onClick: () => void;
}) {
  // 인기/토론 뱃지 — 쇼츠 카드는 공간이 좁아 하나만 우선 노출(HOT > 인기 > 토론).
  const popBadge = popularityBadge(likeCount);
  const discBadge = discussionBadge(item.commentCount);
  const topBadge = popBadge ?? discBadge;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group block w-full text-left"
    >
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black/50 ring-1 ring-inset ring-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            item.thumbnailUrl ??
            `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg`
          }
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
        {/* 좌상단: 카테고리 + (선택) 인기/HOT 또는 토론 뱃지 */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ background: `${moontubeCategoryColor(item.category)}dd` }}
          >
            {item.category}
          </span>
          {topBadge && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[9.5px] font-extrabold",
                topBadge.className,
              )}
            >
              {topBadge.text}
            </span>
          )}
        </div>
        <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/45 backdrop-blur-md">
          <Play className="h-3 w-3 translate-x-px fill-white text-white" />
        </span>
      </div>
      <p className="mt-1.5 line-clamp-1 px-0.5 text-[12px] font-semibold leading-snug text-foreground">
        {item.title}
      </p>
      <div className="mt-0.5 flex items-center gap-2 px-0.5 text-[10.5px] text-foreground/45">
        {/* 쇼츠: 유튜브 실제 조회수가 있으면(>0) 표시, 없으면 숨김. */}
        {viewCount > 0 && <span>조회 {formatViewCount(viewCount)}</span>}
        {/* 등록일 — publishedAt 있을 때만 노출(쇼츠는 카드가 좁아 보수적으로) */}
        {item.publishedAt && (
          <span>{formatRelativeDate(item.publishedAt)}</span>
        )}
        <span className="inline-flex items-center gap-0.5">
          <Heart className="h-3 w-3" strokeWidth={2.2} />
          {formatCount(likeCount)}
        </span>
      </div>
    </button>
  );
}

function FeedLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-foreground/55">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

// ─── 정렬 토글 ─────────────────────────────────────────────────────────────
function SortToggle({
  value,
  onChange,
}: {
  value: SortMode;
  onChange: (v: SortMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="정렬"
      className="inline-flex items-center rounded-full bg-foreground/5 p-0.5 text-[11px] font-semibold"
    >
      {SORT_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-full px-3 py-1 transition-colors",
              active
                ? "bg-violet-500 text-white shadow-[0_2px_8px_rgba(124,58,237,0.35)]"
                : "text-foreground/55 hover:bg-foreground/[0.06] hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── 🔥 인기 영상 캐러셀 ────────────────────────────────────────────────────
// 좋아요 수 기준 상위(롱폼/쇼츠 혼합). 가로 스크롤. 카드 클릭 시 유형에
// 맞춰 롱폼 모달/쇼츠 풀스크린으로 분기.
function PopularSection({
  items,
  onOpenLong,
  onOpenShort,
}: {
  items: MoontubeItem[];
  onOpenLong: (it: MoontubeItem) => void;
  onOpenShort: (it: MoontubeItem) => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-5"
    >
      <h2 className="mb-2 flex items-center gap-1.5 px-2 text-sm font-extrabold text-foreground">
        <span aria-hidden>🔥</span> 인기 영상
        <span className="text-[10px] font-semibold text-foreground/45">
          좋아요 많은 순
        </span>
      </h2>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it, i) => (
          <motion.div
            key={it.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
          >
            <PopularCard
              item={it}
              rank={i + 1}
              onClick={() =>
                it.videoType === "long" ? onOpenLong(it) : onOpenShort(it)
              }
            />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

function PopularCard({
  item,
  rank,
  onClick,
}: {
  item: MoontubeItem;
  rank: number;
  onClick: () => void;
}) {
  const accent = moontubeCategoryColor(item.category);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-[180px] shrink-0 text-left sm:w-[200px]"
      aria-label={`인기 ${rank}위 — ${item.title}`}
    >
      <div className="glass relative aspect-video w-full overflow-hidden rounded-xl ring-1 ring-inset ring-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            item.thumbnailUrl ??
            `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg`
          }
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* 좌상단: 🔥 + 순위 */}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-[0_2px_10px_rgba(244,63,94,0.45)]">
          🔥 {rank}
        </span>
        {/* 우상단: 영상 유형(쇼츠/롱폼) */}
        <span
          className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg"
          style={{ background: `${accent}dd` }}
        >
          {item.videoType === "short" ? "쇼츠" : "롱폼"}
        </span>
        {/* 하단: 좋아요 N개 */}
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
          <Heart
            className="h-3 w-3"
            strokeWidth={2.2}
            style={{ color: "#ec4899", fill: "#ec4899" }}
          />
          좋아요 {formatCount(item.likeCount)}개
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 px-0.5 text-[12.5px] font-semibold leading-snug text-foreground">
        {item.title}
      </p>
    </button>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="glass rounded-2xl py-12 text-center text-sm text-foreground/45">
      {text}
    </div>
  );
}

// ============================================================================
// 롱폼 상세 모달 — 16:9 임베드 + 메타 + 액션 + CommentSection
// ============================================================================
function WatchOverlay({
  video,
  liked,
  saved,
  likeBusy,
  likeCount,
  viewCount,
  saveCount,
  comments,
  currentUserId,
  allowAnonymousWrite,
  selfAvatar,
  onClose,
  onToggleLike,
  onToggleSave,
  onShare,
  onAddComment,
  onDeleteComment,
  onToggleCommentLike,
}: {
  video: MoontubeItem;
  liked: boolean;
  saved: boolean;
  likeBusy: boolean;
  likeCount: number;
  viewCount: number;
  saveCount: number;
  comments: MoontubeUIComment[];
  currentUserId: string | null;
  allowAnonymousWrite: boolean;
  selfAvatar?: React.ComponentProps<typeof CommentSection>["selfAvatar"];
  onClose: () => void;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  onAddComment: (
    text: string,
    options?: { parentId?: string | null; mentionUserId?: string | null },
  ) => Promise<{ ok: boolean; message?: string }>;
  onDeleteComment: (commentId: string) => void;
  onToggleCommentLike: (commentId: string) => void;
}) {
  const accent = moontubeCategoryColor(video.category);

  return (
    <motion.div
      key="watch"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      // 모바일 Safari 의 100vh 함정 회피 — dvh 로 동적 viewport 추적.
      // BottomNav(z-30) / MobileBackButton 보다 명확히 위에 깔리도록 z-[80].
      className="fixed inset-0 z-[80] flex h-[100dvh] flex-col bg-[#0c0c14] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
    >
      {/* 상단 바 — 고정 영역 */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="truncate text-sm font-bold">문튜브</span>
      </div>

      {/* 16:9 임베드 — 고정 영역.
          제한 없이 w-full 만 두면 데스크탑/태블릿에서 영상 높이가
          viewport 의 50% 이상을 먹어버려 아래 본문(flex-1)이 음수로
          내려가 스크롤이 사라지는 핵심 원인 → max-w 로 영상 크기를
          제한하고 좌우 가운데 정렬. 모바일은 100vw 그대로. */}
      <div className="mx-auto relative aspect-video w-full max-w-[640px] shrink-0 bg-black">
        <iframe
          src={moontubeEmbedUrl(video.youtubeId)}
          title={video.title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>

      {/* 본문 스크롤 — 메타 + 액션 + 댓글.
          min-h-0 가 없으면 flex-1 자식이 내용에 따라 늘어나 sticky 입력행이
          화면 밖으로 빠진다(=댓글창이 안 보이는 핵심 원인). */}
      <div
        className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]"
        style={{
          // 노치/홈인디케이터 영역만큼 하단 패딩 — sticky 입력행이 안전 영역 위로 떠 있게.
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* 데스크탑에서 본문이 너무 넓게 늘어나지 않도록 가운데 정렬. */}
        <div className="mx-auto w-full max-w-3xl">
        <div className="px-4 pt-3">
          <span
            className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
            style={{ background: accent }}
          >
            {video.category}
          </span>
          <h1 className="mt-2 text-base font-extrabold leading-snug">
            {video.title}
          </h1>
          <p className="mt-1 text-xs text-white/55">
            {video.channelTitle ? `${video.channelTitle} · ` : ""}
            조회수 {formatViewCount(viewCount)}회
            {video.publishedAt && ` · ${formatRelativeDate(video.publishedAt)}`}
            {" · "}
            <span className="text-violet-300">@{video.authorNickname}</span>
          </p>
          {video.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/85">
              {video.description}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 border-y border-white/10 py-2">
            <PillAction
              icon={Heart}
              label={formatCount(likeCount)}
              active={liked}
              activeColor="#ec4899"
              loading={likeBusy}
              onClick={onToggleLike}
            />
            <PillAction icon={Share2} label="공유" onClick={onShare} />
            <PillAction
              icon={Bookmark}
              label={saveCount > 0 ? formatCount(saveCount) : "저장"}
              active={saved}
              activeColor="#f59e0b"
              onClick={onToggleSave}
            />
          </div>
        </div>

        {/* CommentSection — 인라인 변형 */}
        <CommentSection
          itemId={video.id}
          comments={comments}
          currentUserId={currentUserId}
          selfAvatar={selfAvatar}
          allowAnonymousWrite={allowAnonymousWrite}
          variant="inline"
          actions={{
            onSubmit: (text, opts) => onAddComment(text, opts),
            onDelete: (cid) => onDeleteComment(cid),
            onToggleLike: (cid) => onToggleCommentLike(cid),
          }}
        />
        </div>
      </div>
    </motion.div>
  );
}

function PillAction({
  icon: Icon,
  label,
  active = false,
  activeColor,
  loading = false,
  onClick,
}: {
  icon: typeof Heart;
  label: string;
  active?: boolean;
  activeColor?: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (loading) return;
        onClick();
      }}
      aria-pressed={active}
      aria-busy={loading}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20",
        loading && "pointer-events-none opacity-50",
      )}
    >
      <Icon
        className="h-4 w-4"
        strokeWidth={2.2}
        style={
          active && activeColor
            ? { color: activeColor, fill: activeColor }
            : undefined
        }
      />
      {label}
    </button>
  );
}

// ============================================================================
// 풀스크린 쇼츠 뷰어 — 댓글은 영상 위 오버레이(컨테이너 높이 불변)
// ----------------------------------------------------------------------------
// 이전 구현은 댓글 열기 시 scroll 컨테이너 height 를 40dvh 로 줄이고
// rAF·ResizeObserver 로 scrollTop 을 복원했지만, scroll-snap-mandatory 가
// 높이 변동 도중 다른 snap point 로 튕기는 브라우저 동작은 타이밍 제어로
// 잡히지 않았다. → 댓글 패널을 컨테이너 외부 absolute 오버레이로 띄워
// 컨테이너 높이 자체를 변동시키지 않는다. 높이가 변하지 않으니 보정 로직
// 일체 불필요.
// ============================================================================
function ShortsViewer({
  list,
  initialIndex,
  onClose,
  isLiked,
  isSaved,
  isLikeBusy,
  likeCountOf,
  commentCountOf,
  toggleLike,
  toggleSave,
  getComments,
  loadComments,
  addComment,
  deleteComment,
  toggleCommentLike,
  onShare,
  onHide,
  onView,
  currentUserId,
  selfAvatar,
}: {
  list: MoontubeItem[];
  initialIndex: number;
  onClose: () => void;
  isLiked: (id: string) => boolean;
  isSaved: (id: string) => boolean;
  isLikeBusy: (id: string) => boolean;
  likeCountOf: (it: MoontubeItem) => number;
  commentCountOf: (it: MoontubeItem) => number;
  toggleLike: (it: MoontubeItem) => void;
  toggleSave: (it: MoontubeItem) => void;
  getComments: (id: string) => MoontubeUIComment[];
  loadComments: (it: MoontubeItem) => void;
  addComment: (
    it: MoontubeItem,
    text: string,
    options?: { parentId?: string | null; mentionUserId?: string | null },
  ) => Promise<{ ok: boolean; message?: string }>;
  deleteComment: (it: MoontubeItem, commentId: string) => void;
  toggleCommentLike: (it: MoontubeItem, commentId: string) => void;
  onShare: (it: MoontubeItem) => void;
  onHide: (it: MoontubeItem) => void;
  onView: (it: MoontubeItem) => void;
  currentUserId: string | null;
  selfAvatar?: React.ComponentProps<typeof CommentSection>["selfAvatar"];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [commentFor, setCommentFor] = useState<MoontubeItem | null>(null);
  const viewedRef = useRef<Set<string>>(new Set());
  // 어떤 영상의 댓글이 열려 있는지 추적용. 슬라이드 높이는 댓글 열림 여부와
  // 무관하게 항상 100dvh — 댓글 시트는 컨테이너 외부 오버레이라 높이를
  // 변동시키지 않는다.

  // ── 댓글 토글 — 단순 state 전환 ──────────────────────────────────────────
  // 컨테이너 높이가 변하지 않으므로 snap 해제·scrollTop 복원·rAF 보정 일체
  // 불필요. 그냥 commentFor 만 갱신하면 된다.
  const handleToggleComments = useCallback(
    (next: MoontubeItem | null) => {
      if (next) {
        loadComments(next);
        setCommentFor(next);
      } else {
        setCommentFor(null);
      }
    },
    [loadComments],
  );

  // ── 초기 위치로 즉시 이동 ────────────────────────────────────────────────
  // 컨테이너가 100dvh 로 고정이므로 첫 paint 후 layout 이 확정되면 바로
  // initialIndex*h 로 점프하면 된다.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const apply = () => {
      const target = scrollRef.current;
      if (!target) return;
      const h = target.clientHeight;
      if (h <= 0) {
        requestAnimationFrame(apply);
        return;
      }
      const prev = target.style.scrollBehavior;
      target.style.scrollBehavior = "auto";
      target.scrollTop = initialIndex * h;
      target.style.scrollBehavior = prev;
    };
    requestAnimationFrame(apply);

    const first = list[initialIndex];
    if (first && !viewedRef.current.has(first.id)) {
      viewedRef.current.add(first.id);
      onView(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIndex]);

  return (
    <motion.div
      key="shorts-viewer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] bg-black text-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(124,58,237,0.25),transparent_60%)]"
      />

      {/* 모바일은 풀스크린, 데스크탑은 9:16 카드. */}
      <div className="relative mx-auto h-[100dvh] w-full max-w-full md:my-4 md:h-[calc(100dvh-2rem)] md:max-w-[420px] md:overflow-hidden md:rounded-[2.25rem] md:shadow-[0_30px_80px_rgba(0,0,0,0.6)] md:ring-1 md:ring-white/10">
        {/* 상단 바 — 영상 위 오버레이 (반투명 그라데이션) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/55 to-transparent px-3 pb-4 pt-[max(env(safe-area-inset-top),0.5rem)]">
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/40 backdrop-blur-md transition-colors hover:bg-black/60"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="text-sm font-bold tracking-tight [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
            문츠 <span aria-hidden>🎬</span>
          </div>
          <div className="h-10 w-10" />
        </div>

        {/* 영상 스크롤 컨테이너 — 항상 100dvh 고정.
            댓글 시트는 이 컨테이너 외부 absolute 오버레이로 띄우므로
            컨테이너 높이 자체는 댓글 열림 여부와 무관하다. height 애니메이션
            없음 → scroll-snap 튕김도 없음. */}
        <div
          ref={scrollRef}
          className={cn(
            "h-full snap-y snap-mandatory overflow-y-scroll scroll-smooth",
            "[-webkit-overflow-scrolling:touch]",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {list.map((it) => (
            <ShortSlide
              key={it.id}
              item={it}
              liked={isLiked(it.id)}
              saved={isSaved(it.id)}
              likeBusy={isLikeBusy(it.id)}
              likeCount={likeCountOf(it)}
              commentCount={commentCountOf(it)}
              slideHeight="100dvh"
              compact={false}
              onToggleLike={() => toggleLike(it)}
              onToggleSave={() => toggleSave(it)}
              onShare={() => onShare(it)}
              onOpenComments={() => handleToggleComments(it)}
              onHide={() => onHide(it)}
            />
          ))}
        </div>

        {/* 댓글 오버레이 — 화면 하단 50% 를 덮는 슬라이드업 시트.
            scroll 컨테이너 외부 absolute 라 컨테이너 높이를 건드리지 않음. */}
        <AnimatePresence>
          {commentFor && (
            <motion.div
              key={`comments-${commentFor.id}`}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 32 }}
              className="absolute inset-x-0 bottom-0 z-50 flex h-[50dvh] flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-black/90 backdrop-blur-lg"
            >
              {/* 헤더 — 그랩 핸들 + 닫기 버튼 */}
              <div className="relative flex shrink-0 items-center justify-center border-b border-white/5 px-3 pt-2 pb-1">
                <div className="h-1 w-9 rounded-full bg-white/20" />
                <button
                  type="button"
                  onClick={() => handleToggleComments(null)}
                  aria-label="댓글 닫기"
                  className="absolute right-2 top-1.5 grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <CommentSection
                  itemId={commentFor.id}
                  comments={getComments(commentFor.id)}
                  currentUserId={currentUserId}
                  selfAvatar={selfAvatar}
                  allowAnonymousWrite={commentFor.isFallback === true}
                  variant="sheet"
                  actions={{
                    onSubmit: (text, opts) =>
                      addComment(commentFor, text, opts),
                    onDelete: (cid) => deleteComment(commentFor, cid),
                    onToggleLike: (cid) =>
                      toggleCommentLike(commentFor, cid),
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ShortSlide({
  item,
  liked,
  saved,
  likeBusy,
  likeCount,
  commentCount,
  slideHeight,
  compact,
  onToggleLike,
  onToggleSave,
  onShare,
  onOpenComments,
  onHide,
}: {
  item: MoontubeItem;
  liked: boolean;
  saved: boolean;
  likeBusy: boolean;
  likeCount: number;
  commentCount: number;
  slideHeight: string;
  /** 댓글 열림 → 메타/액션 영역을 작게 축약 */
  compact: boolean;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  onOpenComments: () => void;
  onHide: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section
      style={{ height: slideHeight }}
      className="relative w-full snap-start snap-always overflow-hidden bg-black"
    >
      {/* iframe — 슬라이드를 완전히 cover.
          가로가 좁은 모바일은 width=100% 가 되어 YouTube iframe 안에서 영상이
          contain 되며 위/아래에 검정 패딩이 남았다(=상단 검정 바의 원인).
          → width 를 slideH*9/16 로 강제하고 min-w-full 로 100% 도 보장하면
            9:16 영상이 슬라이드 전체를 꽉 채운다. 좌우 약간 잘리지만 시각적
            몰입은 회복된다. overflow-hidden 으로 좌우 잘림 처리. */}
      <iframe
        src={moontubeEmbedUrl(item.youtubeId)}
        title={item.title}
        className="absolute left-1/2 top-1/2 min-h-full min-w-full -translate-x-1/2 -translate-y-1/2"
        style={{
          ["--slide-h" as string]: slideHeight,
          width: "calc(var(--slide-h) * 9 / 16)",
          height: "var(--slide-h)",
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        loading="lazy"
      />

      {/* 하단 그라데이션 (메타 가독성) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent"
      />

      {/* 더보기 메뉴 */}
      <div className="absolute right-3 top-14 z-20">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          aria-label="더보기"
          className="grid h-9 w-9 place-items-center rounded-full bg-black/50 backdrop-blur-md transition-colors hover:bg-black/70"
        >
          <MoreVertical className="h-4 w-4 text-white" strokeWidth={2.2} />
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              aria-hidden
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div
              role="menu"
              className="absolute right-0 top-11 z-20 min-w-[140px] overflow-hidden rounded-xl border border-white/10 bg-neutral-900/95 text-xs font-semibold text-white shadow-xl backdrop-blur-md"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  if (
                    window.confirm(
                      "이 영상을 숨김 처리할까요?\n관리자/본인만 처리할 수 있어요.",
                    )
                  ) {
                    onHide();
                  }
                }}
                className="block w-full px-3 py-2.5 text-left text-rose-300 hover:bg-white/5"
              >
                신고 / 숨김 처리
              </button>
              <a
                role="menuitem"
                href={item.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="block w-full border-t border-white/10 px-3 py-2.5 text-left text-white/80 hover:bg-white/5"
              >
                유튜브에서 보기 ↗
              </a>
            </div>
          </>
        )}
      </div>

      {/* 메타 — 댓글 열림 시 한 줄로 축약.
          홈 인디케이터/모바일 브라우저 하단 UI(주소창/탭바)에 텍스트가
          잘리던 문제 → safe-area 위로 4rem(약 64px) 만큼 더 들어 올린다.
          댓글 열림(compact) 시에는 슬라이드가 40dvh 로 줄어 공간이 좁으니
          최소값만 유지. */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 px-4 pr-16",
          compact ? "pb-2" : "pb-5",
        )}
        style={{
          paddingBottom: compact
            ? "max(env(safe-area-inset-bottom), 0.5rem)"
            : "calc(env(safe-area-inset-bottom, 0px) + 4rem)",
        }}
      >
        {!compact && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            <span
              className="rounded-full px-2 py-0.5 text-white"
              style={{ backgroundColor: moontubeCategoryColor(item.category) }}
            >
              {item.category}
            </span>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-white backdrop-blur-md">
              {item.targetGrade}
            </span>
            {/* 유튜브 실제 조회수 — 없으면(0) 칩 자체를 숨김. */}
            {item.viewCount > 0 && (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-white backdrop-blur-md">
                조회 {formatViewCount(item.viewCount)}
              </span>
            )}
          </div>
        )}
        <p
          className={cn(
            "font-semibold text-violet-300",
            compact ? "mt-0 text-[12px]" : "mt-2 text-[13px]",
          )}
        >
          @{item.authorNickname}
        </p>
        <h2
          className={cn(
            "font-extrabold leading-snug text-white",
            compact ? "mt-0 line-clamp-1 text-[14px]" : "mt-1 text-[17px]",
          )}
        >
          {item.title}
        </h2>
        {!compact && item.description && (
          <div className="mt-1 text-[13px] leading-snug text-white/85">
            <p className={expanded ? "" : "line-clamp-2"}>
              {item.description}
            </p>
            {item.description.length > 40 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-[12px] font-semibold text-white/70 underline-offset-2 hover:underline"
                aria-expanded={expanded}
              >
                {expanded ? "접기" : "더보기"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 우측 액션 컬럼 — 댓글 열림 시 살짝 올림.
          최하단 버튼(저장)이 브라우저 하단 UI 에 가려지지 않도록 safe-area
          위로 5rem(약 80px) 만큼 들어 올린다. 메타보다 살짝 더 위에 위치. */}
      <div
        className="absolute right-3 z-10 flex flex-col items-center gap-4"
        style={{
          bottom: compact
            ? "max(env(safe-area-inset-bottom), 0.75rem)"
            : "calc(env(safe-area-inset-bottom, 0px) + 5rem)",
        }}
      >
        <ShortAction
          label={formatCount(likeCount)}
          icon={Heart}
          active={liked}
          activeColor="#ec4899"
          loading={likeBusy}
          onClick={onToggleLike}
        />
        <ShortAction
          label={String(commentCount)}
          icon={MessageCircle}
          onClick={onOpenComments}
        />
        <ShortAction label="공유" icon={Share2} onClick={onShare} />
        <ShortAction
          label="저장"
          icon={Bookmark}
          active={saved}
          activeColor="#f59e0b"
          onClick={onToggleSave}
        />
      </div>
    </section>
  );
}

function ShortAction({
  label,
  icon: Icon,
  active = false,
  activeColor,
  loading = false,
  onClick,
}: {
  label: string;
  icon: typeof Heart;
  active?: boolean;
  activeColor?: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (loading) return;
        onClick();
      }}
      aria-pressed={active}
      aria-busy={loading}
      aria-label={label}
      className={cn(
        "group flex flex-col items-center gap-1",
        loading && "pointer-events-none opacity-50",
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-md transition-transform group-active:scale-90">
        <Icon
          className="h-5 w-5"
          strokeWidth={2.2}
          style={
            active && activeColor
              ? { color: activeColor, fill: activeColor }
              : { color: "white" }
          }
        />
      </span>
      <span className="text-[10px] font-semibold text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        {label}
      </span>
    </button>
  );
}

// ============================================================================
// 등록 모달 — URL 붙여넣기 → 유형 자동 감지 → 등록 (moontube_items)
// ============================================================================
function UploadModal({
  userId,
  onClose,
  onSuccess,
}: {
  userId: string | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  return (
    <motion.div
      key="upload-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="영상 등록"
    >
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-neutral-950 text-white shadow-2xl sm:rounded-3xl"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-bold">영상 등록</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <UploadForm userId={userId} onSuccess={onSuccess} onClose={onClose} />
      </motion.div>
    </motion.div>
  );
}

const INPUT_CLS =
  "w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-violet-500";

function ModalField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11px] font-semibold text-white/70">
        {label}
        {required && <span className="ml-0.5 text-rose-400">*</span>}
      </span>
      {children}
    </label>
  );
}

function UploadForm({
  userId,
  onSuccess,
  onClose,
}: {
  userId: string | null;
  onSuccess: (message: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [authorNickname, setAuthorNickname] = useState("");
  // 카테고리는 통합 목록(MOONTUBE_CATEGORIES) + "직접입력" 으로 고정.
  // category: select 의 현재 값(직접입력이면 MOONTUBE_CATEGORY_CUSTOM).
  // customCategory: "직접입력" 선택 시 입력한 텍스트.
  const [category, setCategory] = useState<string>(MOONTUBE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [targetGrade, setTargetGrade] = useState<string>("all");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const youtubeId = useMemo(() => extractYoutubeId(url), [url]);
  const videoType: MoontubeVideoType = useMemo(
    () => detectVideoType(url),
    [url],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!userId) {
      setError("로그인 정보를 확인할 수 없습니다. 다시 로그인 후 시도해주세요.");
      return;
    }
    if (!youtubeId) {
      setError("유효한 유튜브 링크가 아닙니다. 11자리 영상 ID 가 필요해요.");
      return;
    }
    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!authorNickname.trim()) {
      setError("작성자 닉네임을 입력해주세요.");
      return;
    }
    // 직접입력 선택 시 텍스트 검증
    const finalCategory =
      category === MOONTUBE_CATEGORY_CUSTOM ? customCategory.trim() : category;
    if (!finalCategory) {
      setError("카테고리를 입력해주세요.");
      return;
    }
    const banned = findBannedWordInFields([
      title,
      description,
      authorNickname,
      finalCategory,
    ]);
    if (banned) {
      setError(`부적절한 단어가 포함되어 있어요: "${banned}"`);
      return;
    }

    setSubmitting(true);
    const res = await createMoontubeItem(
      {
        youtubeId,
        youtubeUrl: youtubeUrlFor(youtubeId, videoType),
        title: title.trim(),
        authorNickname: authorNickname.trim(),
        videoType,
        category: finalCategory,
        targetGrade,
        description: description.trim() || undefined,
      },
      userId,
    );
    setSubmitting(false);

    if (!res.ok) {
      setError(res.message);
      return;
    }
    onSuccess(
      videoType === "short"
        ? "쇼츠가 등록되었어요!"
        : "롱폼 영상이 등록되었어요!",
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-h-[70vh] overflow-y-auto px-5 py-4 [scrollbar-width:thin]"
    >
      <ModalField label="유튜브 링크" required>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... 또는 /shorts/..."
          required
          autoFocus
          className={INPUT_CLS}
        />
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/50">
          {youtubeId ? (
            <>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{
                  background: videoType === "short" ? "#06b6d4" : "#7c3aed",
                }}
              >
                {videoType === "short" ? "쇼츠 (9:16)" : "롱폼 (16:9)"}
              </span>
              <span>✓ {youtubeId}</span>
            </>
          ) : (
            "shorts 링크면 쇼츠, 그 외엔 롱폼으로 자동 분류됩니다"
          )}
        </p>
      </ModalField>

      <ModalField label="제목" required>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          className={INPUT_CLS}
        />
      </ModalField>

      <ModalField label="작성자 닉네임" required>
        <input
          type="text"
          value={authorNickname}
          onChange={(e) => setAuthorNickname(e.target.value)}
          maxLength={30}
          required
          placeholder="@ 빼고"
          className={INPUT_CLS}
        />
      </ModalField>

      <div className="grid grid-cols-2 gap-3">
        <ModalField label="카테고리" required>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={INPUT_CLS}
          >
            {MOONTUBE_CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-neutral-900">
                {c}
              </option>
            ))}
            <option
              key={MOONTUBE_CATEGORY_CUSTOM}
              value={MOONTUBE_CATEGORY_CUSTOM}
              className="bg-neutral-900"
            >
              {MOONTUBE_CATEGORY_CUSTOM}
            </option>
          </select>
        </ModalField>

        <ModalField label="대상 학년" required>
          <select
            value={targetGrade}
            onChange={(e) => setTargetGrade(e.target.value)}
            className={INPUT_CLS}
          >
            {(["all", "1", "2", "3"] as const).map((g) => (
              <option key={g} value={g} className="bg-neutral-900">
                {TARGET_GRADE_LABEL[g]}
              </option>
            ))}
          </select>
        </ModalField>
      </div>

      {/* "직접입력" 선택 시에만 노출되는 자유 텍스트 입력 */}
      {category === MOONTUBE_CATEGORY_CUSTOM && (
        <ModalField label="카테고리 직접입력" required>
          <input
            type="text"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            maxLength={20}
            placeholder="예: 우주, 게임, 코딩..."
            className={INPUT_CLS}
          />
        </ModalField>
      )}

      <ModalField label="한줄 설명">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="간단한 소개 (선택)"
          className={cn(INPUT_CLS, "resize-none")}
        />
      </ModalField>

      {error && (
        <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">
          {error}
        </p>
      )}
      <p className="mt-3 text-[11px] leading-snug text-white/50">
        등록한 영상은 다른 학생/교사에게 즉시 노출됩니다. 부적절한 영상은
        관리자가 숨김 처리할 수 있어요.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/15"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(124,58,237,0.5)] transition-colors hover:bg-violet-500 disabled:opacity-60"
        >
          {submitting ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              등록 중...
            </span>
          ) : (
            "등록"
          )}
        </button>
      </div>
    </form>
  );
}
