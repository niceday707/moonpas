"use client";

// 챌린지 v2 — 학생이 직접 만드는 커스텀 챌린지 + 공식 챌린지 통합 헬퍼.
// 기존 board.ts 의 카테고리 기반 joinChallenge/leaveChallenge/getChallengeStats 는
// 보조용으로 유지하고, 이 파일은 challenges / challenge_invites 테이블을 다룬다.
//
// TODO(미래 마이그레이션): challenges 테이블에 tags JSONB 컬럼 추가.
//   ALTER TABLE challenges ADD COLUMN tags TEXT[] DEFAULT '{}';
//   CREATE INDEX challenges_tags_gin ON challenges USING GIN (tags);
// 추가되면 createChallenge 의 tags 인자를 description 텍스트에 합치는 대신
// 별도 컬럼으로 저장하고, parseTags 는 컬럼에서 직접 읽도록 교체.

import { supabase } from "@/lib/supabase";
import type { Role } from "@/components/ui/Badge";
import type {
  ChallengeCategory,
  ChallengeRankRow,
  ChallengeStats,
} from "@/lib/board";

// ─────────────────────────────────────────────────────────
// 태그 정의 — 프론트 표시 전용 (DB 미저장).
// description 앞부분에 [학습][영어] 형태로 합쳐 저장하고 목록에서 파싱.
// ─────────────────────────────────────────────────────────

export type ChallengeTagKey =
  | "study"
  | "exercise"
  | "lifestyle"
  | "hobby"
  | "reading"
  | "exam"
  | "english"
  | "math";

export interface ChallengeTagDef {
  key: ChallengeTagKey;
  label: string;
  emoji: string;
}

export const CHALLENGE_TAGS: ChallengeTagDef[] = [
  { key: "study", label: "학습", emoji: "📝" },
  { key: "exercise", label: "운동", emoji: "💪" },
  { key: "lifestyle", label: "생활습관", emoji: "☀️" },
  { key: "hobby", label: "취미", emoji: "🎨" },
  { key: "reading", label: "독서", emoji: "📖" },
  { key: "exam", label: "수행평가", emoji: "🧪" },
  { key: "english", label: "영어", emoji: "🗣️" },
  { key: "math", label: "수학", emoji: "🔢" },
];

/** 태그별 뱃지 색상 (Tailwind 클래스) */
export const CHALLENGE_TAG_STYLE: Record<ChallengeTagKey, string> = {
  study:     "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  exercise:  "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  lifestyle: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  hobby:     "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
  reading:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  exam:      "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  english:   "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  math:      "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
};

const TAG_KEY_BY_LABEL = new Map<string, ChallengeTagKey>(
  CHALLENGE_TAGS.map((t) => [t.label, t.key]),
);
const TAG_DEF_BY_KEY = new Map<ChallengeTagKey, ChallengeTagDef>(
  CHALLENGE_TAGS.map((t) => [t.key, t]),
);

/** description 앞부분의 [라벨] 패턴들을 ChallengeTagKey 배열로 추출 */
export function parseTags(description: string | null): ChallengeTagKey[] {
  if (!description) return [];
  const result: ChallengeTagKey[] = [];
  const seen = new Set<ChallengeTagKey>();
  // 시작 부분에서만 연속된 [...] 패턴을 추출
  const re = /^\s*((?:\[[^\]]+\])+)/;
  const m = description.match(re);
  if (!m) return [];
  const block = m[1];
  for (const tagMatch of block.matchAll(/\[([^\]]+)\]/g)) {
    const label = tagMatch[1].trim();
    const key = TAG_KEY_BY_LABEL.get(label);
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

/** description 앞부분의 [라벨] 블록을 제거한 순수 설명 */
export function stripTagsFromDescription(description: string | null): string {
  if (!description) return "";
  return description.replace(/^\s*(?:\[[^\]]+\])+\s*/, "").trim();
}

/** 태그 키 배열을 description 앞에 [라벨] 형식으로 합치기 */
export function formatTagsInDescription(
  tags: ChallengeTagKey[],
  rawDescription: string,
): string {
  const labels = tags
    .map((k) => TAG_DEF_BY_KEY.get(k)?.label)
    .filter((l): l is string => !!l);
  if (labels.length === 0) return rawDescription;
  const prefix = labels.map((l) => `[${l}]`).join("");
  const desc = rawDescription.trim();
  return desc ? `${prefix} ${desc}` : prefix;
}

// ─────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────

export type ChallengeCategoryV2 = ChallengeCategory | "custom";

export interface Challenge {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  emoji: string | null;
  category: ChallengeCategoryV2;
  duration_days: number;
  start_date: string | null;
  max_participants: number | null;
  is_official: boolean;
  is_public: boolean;
  is_active: boolean;
  image_url: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    nickname: string;
    role: Role;
    avatar_url: string | null;
  } | null;
  participant_count?: number;
}

export interface ChallengeInvite {
  id: string;
  challenge_id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
}

interface RawChallenge {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  emoji: string | null;
  category: ChallengeCategoryV2;
  duration_days: number;
  start_date: string | null;
  max_participants: number | null;
  is_official: boolean;
  is_public: boolean;
  is_active: boolean;
  image_url: string | null;
  view_count: number | null;
  created_at: string;
  updated_at: string;
  creator?:
    | { id: string; nickname: string; role: Role; avatar_url: string | null }
    | null;
}

const CHALLENGE_SELECT = `
  id, creator_id, title, description, emoji, category,
  duration_days, start_date, max_participants,
  is_official, is_public, is_active, image_url, view_count,
  created_at, updated_at,
  creator:profiles!creator_id ( id, nickname, role, avatar_url )
`;

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * 각 challenge_id 별 활성 참여자 수를 한 번의 쿼리로 집계해 Map 으로 반환.
 * 클라이언트에서 group-by 가 어려우니 전체 row 를 받아서 Map 에 누적.
 */
async function fetchParticipantCounts(
  challengeIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (challengeIds.length === 0) return result;
  const { data, error } = await supabase
    .from("challenge_participants")
    .select("challenge_id")
    .in("challenge_id", challengeIds)
    .eq("is_active", true);
  if (error || !data) {
    if (error) console.warn("[fetchParticipantCounts] 실패", error);
    return result;
  }
  for (const row of data as Array<{ challenge_id: string | null }>) {
    if (!row.challenge_id) continue;
    result.set(row.challenge_id, (result.get(row.challenge_id) ?? 0) + 1);
  }
  return result;
}

// ─────────────────────────────────────────────────────────
// 목록 / 상세
// ─────────────────────────────────────────────────────────

export async function listChallenges(filter?: {
  category?: ChallengeCategoryV2;
  onlyActive?: boolean;
  onlyMine?: boolean;
}): Promise<Challenge[]> {
  let query = supabase
    .from("challenges")
    .select(CHALLENGE_SELECT)
    .order("created_at", { ascending: false });

  if (filter?.category) {
    query = query.eq("category", filter.category);
  }
  if (filter?.onlyActive ?? true) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error("[listChallenges] 실패", error);
    return [];
  }

  let rows = (data as unknown as RawChallenge[]).slice();

  // onlyMine: 현재 유저가 만들었거나 참여 중인 챌린지만
  if (filter?.onlyMine) {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data: myParts, error: pe } = await supabase
      .from("challenge_participants")
      .select("challenge_id")
      .eq("user_id", uid)
      .eq("is_active", true);
    if (pe) console.warn("[listChallenges] myParts 실패", pe);
    const myChallengeIds = new Set(
      (myParts ?? [])
        .map((p) => (p as { challenge_id: string | null }).challenge_id)
        .filter((v): v is string => !!v),
    );
    rows = rows.filter(
      (r) => r.creator_id === uid || myChallengeIds.has(r.id),
    );
  }

  const counts = await fetchParticipantCounts(rows.map((r) => r.id));
  return rows.map((r) => ({
    ...r,
    view_count: r.view_count ?? 0,
    participant_count: counts.get(r.id) ?? 0,
  }));
}

export async function getChallenge(
  challengeId: string,
): Promise<Challenge | null> {
  const { data, error } = await supabase
    .from("challenges")
    .select(CHALLENGE_SELECT)
    .eq("id", challengeId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[getChallenge] 실패", error);
    return null;
  }
  const counts = await fetchParticipantCounts([challengeId]);
  const row = data as unknown as RawChallenge;
  return {
    ...row,
    view_count: row.view_count ?? 0,
    participant_count: counts.get(challengeId) ?? 0,
  };
}

/** 챌린지 상세 조회수 +1 (security definer RPC). 실패해도 페이지 로딩 영향 없음. */
export async function incrementChallengeView(
  challengeId: string,
): Promise<void> {
  const { error } = await supabase.rpc("increment_challenge_view", {
    c_id: challengeId,
  });
  if (error) {
    console.warn("[incrementChallengeView] 실패", error);
  }
}

// ─────────────────────────────────────────────────────────
// 생성 / 참여 / 탈퇴
// ─────────────────────────────────────────────────────────

export async function createChallenge(input: {
  title: string;
  description?: string;
  emoji?: string;
  category?: ChallengeCategoryV2;
  duration_days: number;
  is_public?: boolean;
  image_url?: string;
  tags?: ChallengeTagKey[];
}): Promise<{ id: string | null; error: string | null }> {
  const uid = await getCurrentUserId();
  if (!uid) return { id: null, error: "로그인이 필요합니다" };

  const finalCategory: ChallengeCategoryV2 = input.category ?? "custom";
  const rawDesc = input.description?.trim() ?? "";
  const description = input.tags && input.tags.length > 0
    ? formatTagsInDescription(input.tags, rawDesc)
    : rawDesc || null;

  const { data, error } = await supabase
    .from("challenges")
    .insert({
      creator_id: uid,
      title: input.title.trim(),
      description,
      emoji: input.emoji ?? "🔥",
      category: finalCategory,
      duration_days: input.duration_days,
      start_date: new Date().toISOString().slice(0, 10),
      max_participants: null,
      is_official: false,
      is_public: input.is_public ?? true,
      is_active: true,
      image_url: input.image_url ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[createChallenge] 실패", error);
    return { id: null, error: error?.message ?? "알 수 없는 오류" };
  }

  // 개설자 자동 참여
  const { error: pErr } = await supabase
    .from("challenge_participants")
    .insert({
      user_id: uid,
      challenge_id: data.id,
      category: finalCategory,
      is_active: true,
      updated_at: new Date().toISOString(),
    });
  if (pErr) {
    console.warn("[createChallenge] 자동 참여 INSERT 실패", pErr);
  }

  return { id: data.id, error: null };
}

export async function joinChallenge(
  challengeId: string,
): Promise<{ error: string | null }> {
  const uid = await getCurrentUserId();
  if (!uid) return { error: "로그인이 필요합니다" };

  const challenge = await getChallenge(challengeId);
  if (!challenge) return { error: "챌린지를 찾을 수 없습니다" };

  // 정원 체크
  if (
    challenge.max_participants &&
    (challenge.participant_count ?? 0) >= challenge.max_participants
  ) {
    return { error: "정원이 가득 찼습니다" };
  }

  // 이미 참여 중인지 확인
  const { data: existing } = await supabase
    .from("challenge_participants")
    .select("user_id, challenge_id, is_active")
    .eq("user_id", uid)
    .eq("challenge_id", challengeId)
    .maybeSingle();

  if (existing) {
    if ((existing as { is_active: boolean }).is_active) {
      return { error: null };
    }
    const { error } = await supabase
      .from("challenge_participants")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("user_id", uid)
      .eq("challenge_id", challengeId);
    if (error) {
      console.error("[joinChallenge v2] update 실패", error);
      return { error: error.message };
    }
    return { error: null };
  }

  const { error } = await supabase.from("challenge_participants").insert({
    user_id: uid,
    challenge_id: challengeId,
    category: challenge.category,
    is_active: true,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[joinChallenge v2] insert 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

export async function leaveChallenge(
  challengeId: string,
): Promise<{ error: string | null }> {
  const uid = await getCurrentUserId();
  if (!uid) return { error: "로그인이 필요합니다" };
  const { error } = await supabase
    .from("challenge_participants")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", uid)
    .eq("challenge_id", challengeId);
  if (error) {
    console.error("[leaveChallenge v2] 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

// ─────────────────────────────────────────────────────────
// 참여자 목록
// ─────────────────────────────────────────────────────────

export interface ChallengeParticipant {
  id: string;
  nickname: string;
  role: Role;
  avatar_url: string | null;
  joined_at: string;
}

export async function getChallengeParticipants(
  challengeId: string,
): Promise<ChallengeParticipant[]> {
  const { data, error } = await supabase
    .from("challenge_participants")
    .select(
      "user_id, updated_at, profile:profiles!user_id ( id, nickname, role, avatar_url )",
    )
    .eq("challenge_id", challengeId)
    .eq("is_active", true)
    .order("updated_at", { ascending: true });
  if (error || !data) {
    if (error) console.warn("[getChallengeParticipants] 실패", error);
    return [];
  }
  type Row = {
    user_id: string;
    updated_at: string;
    profile: {
      id: string;
      nickname: string;
      role: Role;
      avatar_url: string | null;
    } | null;
  };
  return (data as unknown as Row[])
    .filter((r) => r.profile)
    .map((r) => ({
      id: r.profile!.id,
      nickname: r.profile!.nickname,
      role: r.profile!.role,
      avatar_url: r.profile!.avatar_url,
      joined_at: r.updated_at,
    }));
}

// ─────────────────────────────────────────────────────────
// 내 챌린지 / 초대
// ─────────────────────────────────────────────────────────

export async function getMyChallenges(): Promise<Challenge[]> {
  return listChallenges({ onlyMine: true });
}

export interface PendingInvite {
  invite: ChallengeInvite;
  challenge: Challenge;
  inviter: { nickname: string };
}

export async function getMyPendingInvites(): Promise<PendingInvite[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];

  const { data, error } = await supabase
    .from("challenge_invites")
    .select(
      `id, challenge_id, inviter_id, invitee_id, status, created_at, responded_at,
       challenge:challenges!challenge_id ( ${CHALLENGE_SELECT.trim()} ),
       inviter:profiles!inviter_id ( nickname )`,
    )
    .eq("invitee_id", uid)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data) {
    if (error) console.warn("[getMyPendingInvites] 실패", error);
    return [];
  }

  type Row = ChallengeInvite & {
    challenge: RawChallenge | null;
    inviter: { nickname: string } | null;
  };

  const rows = data as unknown as Row[];
  const result: PendingInvite[] = [];
  for (const r of rows) {
    if (!r.challenge) continue;
    result.push({
      invite: {
        id: r.id,
        challenge_id: r.challenge_id,
        inviter_id: r.inviter_id,
        invitee_id: r.invitee_id,
        status: r.status,
        created_at: r.created_at,
        responded_at: r.responded_at,
      },
      challenge: {
        ...r.challenge,
        view_count: r.challenge.view_count ?? 0,
        participant_count: 0,
      },
      inviter: { nickname: r.inviter?.nickname ?? "(알수없음)" },
    });
  }
  return result;
}

export async function inviteToChallenge(
  challengeId: string,
  challengeTitle: string,
  inviterNickname: string,
  inviteeIds: string[],
): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid || inviteeIds.length === 0) return;

  const inviteRows = inviteeIds.map((id) => ({
    challenge_id: challengeId,
    inviter_id: uid,
    invitee_id: id,
    status: "pending",
  }));
  const { error: iErr } = await supabase
    .from("challenge_invites")
    .insert(inviteRows);
  if (iErr) {
    console.error("[inviteToChallenge] invites insert 실패", iErr);
  }

  const message = `${inviterNickname}님이 '${challengeTitle}' 챌린지에 초대했습니다`;
  const notifRows = inviteeIds.map((id) => ({
    user_id: id,
    type: "challenge_invite",
    message,
    post_id: challengeId,
  }));
  const { error: nErr } = await supabase
    .from("notifications")
    .insert(notifRows);
  if (nErr) {
    console.error("[inviteToChallenge] notifications insert 실패", nErr);
  }
}

export async function respondToInvite(
  inviteId: string,
  accept: boolean,
): Promise<{ error: string | null }> {
  const uid = await getCurrentUserId();
  if (!uid) return { error: "로그인이 필요합니다" };

  const status = accept ? "accepted" : "declined";

  // invite 정보 먼저 조회 (challenge_id, inviter_id, invitee_id 필요)
  const { data: inviteRow, error: inviteErr } = await supabase
    .from("challenge_invites")
    .select("id, challenge_id, inviter_id, invitee_id, status")
    .eq("id", inviteId)
    .maybeSingle();
  if (inviteErr || !inviteRow) {
    return { error: inviteErr?.message ?? "초대를 찾을 수 없습니다" };
  }
  const invite = inviteRow as {
    id: string;
    challenge_id: string;
    inviter_id: string;
    invitee_id: string;
    status: string;
  };
  if (invite.invitee_id !== uid) {
    return { error: "본인 초대만 응답할 수 있습니다" };
  }

  const { error: uErr } = await supabase
    .from("challenge_invites")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (uErr) {
    return { error: uErr.message };
  }

  if (accept) {
    const { error: jErr } = await joinChallenge(invite.challenge_id);
    if (jErr) {
      console.warn("[respondToInvite] joinChallenge 실패", jErr);
    }

    // 초대자에게 참여 알림
    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", uid)
      .maybeSingle();
    const myNick = (profile as { nickname: string } | null)?.nickname ?? "친구";
    await supabase.from("notifications").insert({
      user_id: invite.inviter_id,
      type: "challenge_invite",
      message: `${myNick}님이 챌린지에 참여했습니다!`,
      post_id: invite.challenge_id,
    });
  }

  return { error: null };
}

// ─────────────────────────────────────────────────────────
// 챌린지별 통계 (streak + 주간 랭킹)
// 기존 board.ts/getChallengeStats 의 로직을 challenge_id 필터 버전으로 재구현.
// ─────────────────────────────────────────────────────────

const STREAK_LOOKBACK_DAYS = 60;
const RANKING_LOOKBACK_DAYS = 7;

function ymdInKst(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
function todayKst(): string {
  return ymdInKst(new Date().toISOString());
}
function dateBefore(ymd: string, days: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function computeStreak(set: Set<string>, today: string, yesterday: string): number {
  let cursor: string;
  if (set.has(today)) cursor = today;
  else if (set.has(yesterday)) cursor = yesterday;
  else return 0;
  let count = 0;
  while (set.has(cursor)) {
    count++;
    cursor = dateBefore(cursor, 1);
  }
  return count;
}

export interface ChallengeStatsForChallenge {
  streakByAuthor: Record<string, number>;
  weeklyRanking: ChallengeRankRow[];
}

/** 단일 챌린지의 streak + 주간 TOP5 랭킹. 기존 ChallengeStats 와 형태가 다름에 유의. */
export async function getChallengeStatsForChallenge(
  challengeId: string,
): Promise<ChallengeStatsForChallenge> {
  const since = dateBefore(todayKst(), STREAK_LOOKBACK_DAYS);
  const { data, error } = await supabase
    .from("posts")
    .select(
      "author_id, created_at, challenge_status, author:profiles!author_id ( id, nickname, role )",
    )
    .eq("board_type", "challenge")
    .eq("challenge_id", challengeId)
    .gte("created_at", since + "T00:00:00+09:00")
    .order("created_at", { ascending: false });

  if (error || !data) {
    if (error) console.error("[getChallengeStatsForChallenge] 실패", error);
    return { streakByAuthor: {}, weeklyRanking: [] };
  }

  type Row = {
    author_id: string;
    created_at: string;
    challenge_status: string | null;
    author: { id: string; nickname: string; role: Role } | null;
  };

  const rows = (data as unknown as Row[]).filter(
    (r) => (r.challenge_status ?? "approved") !== "rejected",
  );

  const dates = new Map<string, Set<string>>();
  const authorMeta = new Map<string, { nickname: string; role: Role }>();
  const weekly = new Map<string, number>();
  const weeklyCutoff = dateBefore(todayKst(), RANKING_LOOKBACK_DAYS - 1);

  for (const row of rows) {
    const day = ymdInKst(row.created_at);
    if (!dates.has(row.author_id)) dates.set(row.author_id, new Set());
    dates.get(row.author_id)!.add(day);
    if (row.author && !authorMeta.has(row.author_id)) {
      authorMeta.set(row.author_id, {
        nickname: row.author.nickname,
        role: row.author.role,
      });
    }
    if (day >= weeklyCutoff) {
      weekly.set(row.author_id, (weekly.get(row.author_id) ?? 0) + 1);
    }
  }

  const today = todayKst();
  const yesterday = dateBefore(today, 1);
  const streakByAuthor: Record<string, number> = {};
  for (const [authorId, set] of dates.entries()) {
    streakByAuthor[authorId] = computeStreak(set, today, yesterday);
  }

  const weeklyRanking: ChallengeRankRow[] = Array.from(weekly.entries())
    .map(([author_id, count]) => {
      const meta = authorMeta.get(author_id);
      return {
        author_id,
        nickname: meta?.nickname ?? "(알수없음)",
        role: meta?.role ?? ("student" as Role),
        count,
      };
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.nickname.localeCompare(b.nickname, "ko");
    })
    .slice(0, 5);

  return { streakByAuthor, weeklyRanking };
}

// ─────────────────────────────────────────────────────────
// 표시 유틸
// ─────────────────────────────────────────────────────────

/** 시작일 + duration 으로부터 D-N 또는 "상시" 표시 */
export function formatChallengeDuration(c: Challenge): string {
  if (c.duration_days >= 9999) return "상시";
  if (!c.start_date) return `${c.duration_days}일`;
  const start = new Date(c.start_date + "T00:00:00+09:00").getTime();
  const end = start + c.duration_days * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const diff = Math.ceil((end - now) / (24 * 60 * 60 * 1000));
  if (diff <= 0) return "종료";
  return `D-${diff}`;
}

/** 사용 안되는 ChallengeStats 형태 호환 (export 없는 helper) — 다른 파일에서 이름 충돌 회피용 */
export type { ChallengeStats };
