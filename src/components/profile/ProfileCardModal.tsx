"use client";

// 닉네임을 클릭하면 표시되는 프로필 카드 모달.
// - 기본 정보(닉네임/역할/한줄소개) 는 항상 노출
// - 학년: show_grade=true 일 때만, 아니면 "비공개" 라벨
// - 활동통계: show_stats=true 일 때만 비동기 로드, 아니면 "비공개"
// - 익명게시판처럼 author_id 가 비어있는 경우엔 호출 측이 NicknameButton 을 사용하지 않아야 한다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, MessageCircle, PenSquare, X as XIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  getPublicProfile,
  type PublicProfile,
} from "@/lib/supabase-profile";
import { getUserStats, type UserStats } from "@/lib/board";

type Props = {
  open: boolean;
  userId: string | null;
  onClose: () => void;
};

export function ProfileCardModal({ open, userId, onClose }: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let active = true;
    setProfile(null);
    setStats(null);
    setLoading(true);
    (async () => {
      const p = await getPublicProfile(userId);
      if (!active) return;
      setProfile(p);
      // show_stats 가 켜져 있을 때만 통계 호출 — 트래픽 절약
      if (p?.show_stats) {
        const s = await getUserStats(userId);
        if (active) setStats(s);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [open, userId]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          aria-modal
          role="dialog"
        >
          <motion.div
            key="panel"
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-t-3xl border border-foreground/10 bg-[#16162a] p-6 shadow-2xl sm:rounded-3xl"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <XIcon className="h-4 w-4" />
            </button>

            {loading || !profile ? (
              <div className="flex min-h-[180px] items-center justify-center text-sm text-white/60">
                {loading ? "프로필을 불러오는 중…" : "프로필을 찾을 수 없어요."}
              </div>
            ) : (
              <ProfileBody profile={profile} stats={stats} userId={userId} onClose={onClose} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProfileBody({
  profile,
  stats,
  userId,
  onClose,
}: {
  profile: PublicProfile;
  stats: UserStats | null;
  userId: string | null;
  onClose: () => void;
}) {
  return (
    <div>
      {/* 헤더: 아바타 + 닉네임 + 역할 */}
      <div className="flex items-center gap-3">
        <UserAvatar
          nickname={profile.nickname}
          role={profile.role ?? null}
          avatarUrl={profile.avatar_url}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-base font-bold text-white">
              {profile.nickname || "닉네임 없음"}
            </span>
            {profile.role && <Badge role={profile.role} />}
          </div>
          {profile.show_grade && profile.grade !== null ? (
            <p className="mt-0.5 text-[11px] text-white/55">{profile.grade}학년</p>
          ) : (
            <p className="mt-0.5 text-[11px] text-white/35">학년 비공개</p>
          )}
        </div>
      </div>

      {/* 한줄 소개 */}
      <div className="mt-4 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-white/85">
        {profile.bio?.trim() || (
          <span className="text-white/40">소개가 없습니다</span>
        )}
      </div>

      {/* 활동통계 */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          활동통계
        </p>
        {profile.show_stats ? (
          <div className="grid grid-cols-3 gap-2">
            <StatTile icon={<PenSquare className="h-4 w-4" />} label="쓴 글" value={stats?.posts ?? null} />
            <StatTile icon={<MessageCircle className="h-4 w-4" />} label="쓴 댓글" value={stats?.comments ?? null} />
            <StatTile icon={<Heart className="h-4 w-4" />} label="받은 좋아요" value={stats?.receivedLikes ?? null} />
          </div>
        ) : (
          <div className="rounded-2xl bg-white/[0.04] px-4 py-5 text-center text-xs text-white/40">
            비공개
          </div>
        )}
      </div>

      {/* CTA */}
      {userId && (
        <Link
          href={`/user/${userId}`}
          onClick={onClose}
          className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_6px_20px_rgba(124,58,237,0.4)] transition-transform hover:scale-[1.01]"
        >
          이 사용자의 글 보기
        </Link>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl bg-white/[0.04] px-2 py-3">
      <span className="text-violet-400">{icon}</span>
      <span className="text-base font-extrabold tabular-nums text-white">
        {value === null ? "—" : value.toLocaleString()}
      </span>
      <span className="text-[10px] text-white/55">{label}</span>
    </div>
  );
}
