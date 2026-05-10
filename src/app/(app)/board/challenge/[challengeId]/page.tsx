"use client";

// 챌린지 상세 페이지 — /board/challenge/[challengeId]
// 히어로(개설자/태그/설명/참여자) → 주간 랭킹 → 인증 타임라인 그리드 순.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Camera,
  Flame,
  Loader2,
  Trophy,
  Users,
} from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { Badge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useSupabaseProfile } from "@/lib/supabase-profile";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { CHALLENGE_CATEGORY_LABEL } from "@/lib/board";
import {
  CHALLENGE_TAGS,
  CHALLENGE_TAG_STYLE,
  formatChallengeDuration,
  getChallenge,
  getChallengeParticipants,
  getChallengeStatsForChallenge,
  joinChallenge,
  leaveChallenge,
  parseTags,
  stripTagsFromDescription,
  type Challenge,
  type ChallengeParticipant,
  type ChallengeStatsForChallenge,
} from "@/lib/challenge";

const TAG_DEF_BY_KEY = new Map(CHALLENGE_TAGS.map((t) => [t.key, t]));

export default function ChallengeDetailPage() {
  return (
    <AuthGate
      title="챌린지는 로그인이 필요합니다"
      description="문태고 학생·교사·학부모·졸업생만 이용할 수 있어요."
    >
      <ChallengeDetailInner />
    </AuthGate>
  );
}

function ChallengeDetailInner() {
  const params = useParams<{ challengeId: string }>();
  const challengeId = params.challengeId;
  const { user } = useSupabaseProfile();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);
  const [stats, setStats] = useState<ChallengeStatsForChallenge | null>(null);
  const [posts, setPosts] = useState<TimelinePost[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!challengeId) return;
    let active = true;
    setLoading(true);
    Promise.all([
      getChallenge(challengeId),
      getChallengeParticipants(challengeId),
      getChallengeStatsForChallenge(challengeId),
      fetchTimelinePosts(challengeId),
    ]).then(([c, parts, s, ps]) => {
      if (!active) return;
      setChallenge(c);
      setParticipants(parts);
      setStats(s);
      setPosts(ps);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [challengeId]);

  const isParticipating = !!user && participants.some((p) => p.id === user.id);

  async function reloadParticipants() {
    const parts = await getChallengeParticipants(challengeId);
    setParticipants(parts);
  }

  async function handleJoin() {
    if (!challenge) return;
    setActionLoading(true);
    setError(null);
    const { error: e } = await joinChallenge(challenge.id);
    setActionLoading(false);
    if (e) {
      setError(e);
      return;
    }
    await reloadParticipants();
  }

  async function handleLeave() {
    if (!challenge) return;
    if (!confirm("정말 챌린지에서 나가시겠어요?")) return;
    setActionLoading(true);
    setError(null);
    const { error: e } = await leaveChallenge(challenge.id);
    setActionLoading(false);
    if (e) {
      setError(e);
      return;
    }
    await reloadParticipants();
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-violet-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="mx-auto max-w-screen-md px-4 py-10">
        <Link
          href="/board/challenge"
          className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-800 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          챌린지 목록
        </Link>
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-white/[0.07] dark:bg-[#16162a]">
          <p className="text-sm text-gray-500">챌린지를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const tags = parseTags(challenge.description);
  const description = stripTagsFromDescription(challenge.description);
  const durationLabel = formatChallengeDuration(challenge);
  const categoryLabel =
    challenge.category === "custom"
      ? "학생 챌린지"
      : CHALLENGE_CATEGORY_LABEL[challenge.category];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-screen-lg px-4 py-6"
    >
      <Link
        href="/board/challenge"
        className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-800 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        챌린지 목록
      </Link>

      {/* 히어로 */}
      <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/[0.07] dark:bg-[#16162a]">
        <div className="flex items-start gap-3">
          <span className="text-5xl leading-none">{challenge.emoji ?? "🔥"}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                {challenge.title}
              </h1>
              {challenge.is_official && (
                <span className="shrink-0 rounded-full border-2 border-violet-400 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 dark:bg-violet-500/10 dark:text-violet-200">
                  ⭐ 공식
                </span>
              )}
            </div>
            {/* 개설자 */}
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <UserAvatar
                size="xs"
                nickname={challenge.creator?.nickname}
                role={challenge.creator?.role}
                avatarUrl={challenge.creator?.avatar_url}
              />
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {challenge.creator?.nickname ?? "(알수없음)"}
              </span>
              {challenge.creator && (
                <Badge role={challenge.creator.role} className="text-[9px] py-0 px-1.5" />
              )}
              <span>·</span>
              <span>{formatYmd(challenge.created_at)}</span>
            </div>
          </div>
        </div>

        {/* 태그 */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((key) => {
              const def = TAG_DEF_BY_KEY.get(key);
              if (!def) return null;
              return (
                <span
                  key={key}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    CHALLENGE_TAG_STYLE[key],
                  )}
                >
                  <span>{def.emoji}</span>
                  <span>{def.label}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* 설명 */}
        {description && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-200">
            {description}
          </p>
        )}

        {/* 정보 라인 */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <strong className="text-gray-800 dark:text-gray-100">
              {participants.length}명
            </strong>{" "}
            참여 중
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {durationLabel}
          </span>
          <span>· {categoryLabel}</span>
        </div>

        {/* 참여자 아바타 */}
        {participants.length > 0 && (
          <div className="mt-3 flex items-center -space-x-1.5">
            {participants.slice(0, 5).map((p) => (
              <UserAvatar
                key={p.id}
                size="sm"
                nickname={p.nickname}
                role={p.role}
                avatarUrl={p.avatar_url}
                className="ring-2 ring-white dark:ring-[#16162a]"
              />
            ))}
            {participants.length > 5 && (
              <span className="ml-3 text-[11px] font-semibold text-gray-500">
                +{participants.length - 5}명
              </span>
            )}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!isParticipating && challenge.is_public && (
            <button
              type="button"
              onClick={handleJoin}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              참여하기 🙌
            </button>
          )}
          {!isParticipating && !challenge.is_public && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-500 dark:bg-white/[0.05] dark:text-gray-400">
              🔒 초대받은 사람만 참여 가능
            </span>
          )}
          {isParticipating && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                참여 중 ✓
              </span>
              <Link
                href={`/board/challenge/write?challengeId=${challenge.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-700"
              >
                <Camera className="h-4 w-4" />
                인증하기 📸
              </Link>
              <button
                type="button"
                onClick={handleLeave}
                disabled={actionLoading}
                className="text-xs text-gray-400 underline transition hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
              >
                탈퇴
              </button>
            </>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </section>

      {/* 주간 랭킹 */}
      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/[0.07] dark:bg-[#16162a]">
        <div className="mb-3 flex items-center gap-1.5 text-sm font-bold text-amber-500">
          <Trophy className="h-4 w-4" />
          🏆 이번 주 랭킹
        </div>
        {!stats || stats.weeklyRanking.length === 0 ? (
          <p className="px-1 py-3 text-xs text-gray-400">
            아직 인증한 사람이 없어요. 1등을 차지해보세요!
          </p>
        ) : (
          <ol className="space-y-2">
            {stats.weeklyRanking.map((r, i) => {
              const medal =
                i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
              const myStreak = stats.streakByAuthor[r.author_id] ?? 0;
              return (
                <li
                  key={r.author_id}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="grid w-7 shrink-0 place-items-center text-base">
                    {medal}
                  </span>
                  <span className="flex-1 truncate font-semibold text-gray-800 dark:text-gray-100">
                    {r.nickname}
                  </span>
                  <Badge role={r.role} className="text-[9px] py-0 px-1.5" />
                  {myStreak >= 2 && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-300">
                      <Flame className="h-3 w-3" />
                      {myStreak}일
                    </span>
                  )}
                  <span className="shrink-0 tabular-nums text-xs text-gray-400">
                    {r.count}회
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* 인증 타임라인 */}
      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">
            📸 인증 타임라인
          </h2>
          <span className="text-[11px] text-gray-400">{posts.length}개</span>
        </div>
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center dark:border-white/10 dark:bg-[#16162a]">
            <p className="text-sm text-gray-500 dark:text-gray-300">
              아직 인증이 없어요. 첫 번째 인증을 올려보세요! 📸
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {posts.map((p) => (
              <TimelineCard
                key={p.id}
                post={p}
                streak={stats?.streakByAuthor[p.author_id] ?? 0}
              />
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}

// ── 타임라인 카드 ─────────────────────────────────────────────

interface TimelinePost {
  id: string;
  author_id: string;
  title: string;
  image_url: string | null;
  created_at: string;
  author: { id: string; nickname: string; role: string; avatar_url: string | null } | null;
}

function TimelineCard({
  post,
  streak,
}: {
  post: TimelinePost;
  streak: number;
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-white/[0.04]">
      {post.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.image_url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-violet-500 to-cyan-500 p-3 text-white">
          <Flame className="h-6 w-6 opacity-90" />
          <span className="line-clamp-2 text-center text-[11px] font-bold leading-tight">
            {post.title}
          </span>
        </div>
      )}
      {streak >= 3 && (
        <span className="absolute right-2 top-2 rounded-full bg-orange-500/90 px-2 py-0.5 text-[10px] font-bold text-white ring-1 ring-white/20 backdrop-blur-sm">
          🔥 {streak}일
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-3 pb-2 pt-6">
        <p className="line-clamp-1 text-[11px] font-semibold text-white drop-shadow">
          {post.author?.nickname ?? "(알수없음)"}
        </p>
        <p className="text-[10px] text-white/80 drop-shadow">
          {relativeTime(post.created_at)}
        </p>
      </div>
    </div>
  );
}

// ── 헬퍼 ──────────────────────────────────────────────────────

function formatYmd(iso: string): string {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = 60 * 1000;
  if (diff < 5 * min) return "방금 전";
  if (diff < 60 * min) return `${Math.floor(diff / min)}분 전`;
  if (diff < 24 * 60 * min) return `${Math.floor(diff / (60 * min))}시간 전`;
  if (diff < 7 * 24 * 60 * min) return `${Math.floor(diff / (24 * 60 * min))}일 전`;
  return formatYmd(iso);
}

async function fetchTimelinePosts(challengeId: string): Promise<TimelinePost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, title, image_url, created_at, challenge_status, author:profiles!author_id ( id, nickname, role, avatar_url )",
    )
    .eq("board_type", "challenge")
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error || !data) {
    if (error) console.warn("[fetchTimelinePosts] 실패", error);
    return [];
  }
  type Row = TimelinePost & { challenge_status: string | null };
  return (data as unknown as Row[])
    .filter((r) => (r.challenge_status ?? "approved") !== "rejected")
    .map((r) => ({
      id: r.id,
      author_id: r.author_id,
      title: r.title,
      image_url: r.image_url,
      created_at: r.created_at,
      author: r.author,
    }));
}
