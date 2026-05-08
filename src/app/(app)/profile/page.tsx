"use client";

// 내 프로필 — Supabase profiles 기준으로 닉네임/역할/아바타 표시.
//  · 닉네임: profiles.nickname 우선, 없으면 Google user_metadata.full_name 폴백
//  · 아바타: profiles.avatar_url 이 있으면 이미지, 없으면 역할 그라데이션 + 첫 글자
//  · 내가 쓴 글/댓글: posts/comments 테이블에서 author_id = 내 user.id 조회

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Camera,
  FileText,
  Heart,
  Loader2,
  MessageCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { Badge, type Role } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  BOARD_LABEL,
  getUserComments,
  getUserPosts,
  getUserStats,
  type PostRow,
  type UserCommentRow,
  type UserStats,
} from "@/lib/board";
import {
  pickDisplayName,
  saveAvatarUrl,
  useSupabaseProfile,
} from "@/lib/supabase-profile";
import { looksLikeStudentIdName } from "@/lib/author-display";
import { uploadAvatar, validateAvatarFile } from "@/lib/storage";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  return (
    <AuthGate
      title="프로필은 로그인이 필요합니다"
      description="내 활동·작성 글·관심 채널을 한 곳에서 관리할 수 있는 공간이에요."
    >
      <ProfileShell />
    </AuthGate>
  );
}

function ProfileShell() {
  const { user, profile, loading: profileLoading, refetch } = useSupabaseProfile();
  const [tab, setTab] = useState<"posts" | "comments">("posts");

  const [posts, setPosts] = useState<PostRow[] | null>(null);
  const [comments, setComments] = useState<UserCommentRow[] | null>(null);
  const [stats, setStats] = useState<UserStats>({
    posts: 0,
    comments: 0,
    receivedLikes: 0,
  });

  // 사용자 본인 데이터 fetch
  useEffect(() => {
    if (!user) {
      setPosts([]);
      setComments([]);
      return;
    }
    let active = true;
    Promise.all([
      getUserPosts(user.id, 20),
      getUserComments(user.id, 20),
      getUserStats(user.id),
    ]).then(([p, c, s]) => {
      if (!active) return;
      setPosts(p);
      setComments(c);
      setStats(s);
    });
    return () => {
      active = false;
    };
  }, [user]);

  // 닉네임: profiles.nickname 우선 → Google 이름 폴백 (학번+이름 형태는 노출 금지)
  const rawNickname = profile?.nickname?.trim();
  const fallback = pickDisplayName(user);
  const displayNickname =
    (rawNickname && !looksLikeStudentIdName(rawNickname) && rawNickname) ||
    fallback ||
    "사용자";
  const role = profile?.role ?? null;
  const avatarUrl = profile?.avatar_url ?? null;

  if (profileLoading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl items-center justify-center px-4 py-20 text-violet-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:py-8">
      <ProfileHeader
        userId={user?.id ?? null}
        nickname={displayNickname}
        role={role}
        avatarUrl={avatarUrl}
        likes={stats.receivedLikes}
        postCount={stats.posts}
        commentCount={stats.comments}
        onAvatarChanged={refetch}
      />

      {/* 탭 */}
      <div className="mt-6 flex gap-1 rounded-2xl bg-foreground/5 p-1">
        <TabButton
          active={tab === "posts"}
          onClick={() => setTab("posts")}
          label="내가 쓴 글"
          count={stats.posts}
        />
        <TabButton
          active={tab === "comments"}
          onClick={() => setTab("comments")}
          label="내가 쓴 댓글"
          count={stats.comments}
        />
      </div>

      {/* 탭 내용 */}
      <motion.section
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mt-4 flex flex-col gap-2"
      >
        {tab === "posts" ? (
          <MyPostList posts={posts} />
        ) : (
          <MyCommentList comments={comments} />
        )}
      </motion.section>
    </div>
  );
}

// ─────────────────────────────────────────────
// 헤더 카드
// ─────────────────────────────────────────────

function ProfileHeader({
  userId,
  nickname,
  role,
  avatarUrl,
  likes,
  postCount,
  commentCount,
  onAvatarChanged,
}: {
  userId: string | null;
  nickname: string;
  role: Role | null;
  avatarUrl: string | null;
  likes: number;
  postCount: number;
  commentCount: number;
  onAvatarChanged: () => Promise<void>;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass rounded-3xl p-5 md:p-6"
    >
      <div className="flex items-start gap-4">
        <ProfileImageEditor
          userId={userId}
          nickname={nickname}
          role={role ?? null}
          avatarUrl={avatarUrl}
          onChanged={onAvatarChanged}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-extrabold tracking-tight md:text-2xl">
              {nickname}
            </h1>
            {role && <Badge role={role} />}
          </div>
          <p className="mt-1 text-xs text-foreground/55">
            닉네임은 7일에 한 번 변경할 수 있어요
          </p>
        </div>

        <Link
          href="/profile/setup"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1.5 text-xs font-semibold text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
          닉네임 변경
        </Link>
      </div>

      {/* 통계 */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <StatBox icon={Heart} label="받은 좋아요" value={likes} accent="rose" />
        <StatBox icon={FileText} label="쓴 글" value={postCount} accent="violet" />
        <StatBox
          icon={MessageCircle}
          label="쓴 댓글"
          value={commentCount}
          accent="cyan"
        />
      </div>
    </motion.header>
  );
}

const ACCENT_STYLES = {
  rose: "text-rose-500 bg-rose-500/10",
  violet: "text-violet-500 bg-violet-500/10",
  cyan: "text-cyan-500 bg-cyan-500/10",
} as const;

function StatBox({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Heart;
  label: string;
  value: number;
  accent: keyof typeof ACCENT_STYLES;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-foreground/10 bg-foreground/[0.02] px-3 py-3">
      <span
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full",
          ACCENT_STYLES[accent],
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-base font-extrabold tabular-nums">
        {value.toLocaleString()}
      </span>
      <span className="text-[11px] text-foreground/55">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 프로필 이미지 업로드 — Supabase Storage(avatars 버킷) → profiles.avatar_url
// ─────────────────────────────────────────────

function ProfileImageEditor({
  userId,
  nickname,
  role,
  avatarUrl,
  onChanged,
}: {
  userId: string | null;
  nickname: string;
  role: Role | null;
  avatarUrl: string | null;
  onChanged: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!userId) {
      setError("로그인이 필요합니다.");
      return;
    }

    const validation = validateAvatarFile(file);
    if (validation) {
      setError(validation.message);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const url = await uploadAvatar(file, userId);
      if (!url) {
        setError("업로드에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      const { error: dbError } = await saveAvatarUrl(userId, url);
      if (dbError) {
        setError("프로필 저장에 실패했어요.");
        return;
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!avatarUrl || !userId) return;
    if (!window.confirm("프로필 사진을 기본 아바타로 되돌릴까요?")) return;
    setError(null);
    setBusy(true);
    try {
      const { error: dbError } = await saveAvatarUrl(userId, null);
      if (dbError) {
        setError("저장에 실패했어요.");
        return;
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="relative">
        <UserAvatar
          nickname={nickname}
          role={role}
          avatarUrl={avatarUrl}
          size="xl"
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label="프로필 사진 변경"
          className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-background bg-violet-500 text-white shadow-[0_4px_12px_rgba(124,58,237,0.45)] transition-transform hover:scale-105 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
        </button>

        {avatarUrl && !busy && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            aria-label="프로필 사진 삭제"
            className="absolute -top-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-rose-500 text-white shadow disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onPick}
          className="hidden"
        />
      </div>
      {error && (
        <p className="max-w-[120px] text-[10px] leading-snug text-rose-500">
          {error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭
// ─────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-foreground/55 hover:text-foreground/80",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
          active
            ? "bg-violet-500/15 text-violet-500"
            : "bg-foreground/10 text-foreground/55",
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────
// 내가 쓴 글 / 댓글 목록 (Supabase 실데이터)
// ─────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = 60 * 1000;
  if (diff < 5 * min) return "방금 전";
  if (diff < 60 * min) return `${Math.floor(diff / min)}분 전`;
  if (diff < 24 * 60 * min) return `${Math.floor(diff / (60 * min))}시간 전`;
  if (diff < 7 * 24 * 60 * min)
    return `${Math.floor(diff / (24 * 60 * min))}일 전`;
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function previewText(content: string, max = 140): string {
  // 게시판별 JSON 본문도 있을 수 있어, 단순 문자열 truncate 만 수행.
  return content.replace(/\s+/g, " ").trim().slice(0, max);
}

function MyPostList({ posts }: { posts: PostRow[] | null }) {
  if (posts === null) return <SkeletonList />;
  if (posts.length === 0) return <EmptyState text="아직 쓴 글이 없어요" />;
  return (
    <ul className="flex flex-col gap-2">
      {posts.map((p) => (
        <li key={p.id}>
          <Link
            href={`/board/${p.board_type}/${p.id}`}
            className="glass block rounded-2xl p-4 transition-shadow hover:shadow-[0_6px_20px_rgba(124,58,237,0.2)]"
          >
            <div className="mb-1 flex items-center gap-2 text-[11px] text-foreground/55">
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 font-semibold text-violet-500">
                {BOARD_LABEL[p.board_type]}
              </span>
              <span>· {formatRelative(p.created_at)}</span>
            </div>
            <p className="line-clamp-1 text-sm font-bold text-foreground/90">
              {p.title}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-foreground/60">
              {previewText(p.content, 140)}
            </p>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-foreground/55">
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {p.like_count}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {p.comment_count}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MyCommentList({ comments }: { comments: UserCommentRow[] | null }) {
  if (comments === null) return <SkeletonList />;
  if (comments.length === 0) return <EmptyState text="아직 쓴 댓글이 없어요" />;
  return (
    <ul className="flex flex-col gap-2">
      {comments.map((c) => {
        const targetLabel = c.post ? BOARD_LABEL[c.post.board_type] : "댓글";
        const href = c.post ? `/board/${c.post.board_type}/${c.post.id}` : "#";
        return (
          <li key={c.id}>
            <Link href={href} className="glass block rounded-2xl p-4">
              <div className="mb-1 flex items-center gap-2 text-[11px] text-foreground/55">
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-semibold text-cyan-600 dark:text-cyan-400">
                  {targetLabel}
                </span>
                <span>· {formatRelative(c.created_at)}</span>
              </div>
              {c.post?.title && (
                <p className="line-clamp-1 text-[11px] font-semibold text-foreground/70">
                  ↳ {c.post.title}
                </p>
              )}
              <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-foreground/85">
                {c.content}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SkeletonList() {
  return (
    <ul className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="glass h-24 animate-pulse rounded-2xl"
          aria-hidden
        />
      ))}
    </ul>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="glass rounded-2xl p-8 text-center text-sm text-foreground/45">
      {text}
    </div>
  );
}
