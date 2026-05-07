"use client";

// 내 프로필 — 닉네임/역할/통계 + 내가 쓴 글·댓글 + 닉네임 변경/프로필 사진 업로드.
// 모든 정보는 localStorage 와 mock-data 의 ME 객체를 통해 동기화된다.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Camera,
  FileText,
  Heart,
  MessageCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { Avatar } from "@/components/feed/Avatar";
import { Badge } from "@/components/ui/Badge";
import { PostContent } from "@/components/feed/PostContent";
import {
  ME,
  fetchMyComments,
  fetchMyPosts,
  getReceivedLikes,
  subscribe,
  type Comment,
  type Post,
} from "@/lib/mock-data";
import {
  attemptUpdateProfileImage,
  nicknameCooldownDaysLeft,
  useProfile,
} from "@/lib/profile";
import { CHANNEL_LABEL } from "@/lib/mock-data";
import { relativeTime } from "@/lib/format";
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
  const profile = useProfile();
  const [tab, setTab] = useState<"posts" | "comments">("posts");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [likes, setLikes] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const [p, c] = await Promise.all([fetchMyPosts(), fetchMyComments()]);
      if (cancelled) return;
      setPosts(p);
      setComments(c);
      setLikes(getReceivedLikes());
    };
    void refresh();
    const unsub = subscribe(() => {
      void refresh();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:py-8">
      <ProfileHeader
        likes={likes}
        postCount={posts?.length ?? 0}
        commentCount={comments?.length ?? 0}
        cooldown={nicknameCooldownDaysLeft(profile)}
        nickname={profile.nickname}
        profileImage={profile.profileImage}
      />

      {/* 탭 */}
      <div className="mt-6 flex gap-1 rounded-2xl bg-foreground/5 p-1">
        <TabButton
          active={tab === "posts"}
          onClick={() => setTab("posts")}
          label="내가 쓴 글"
          count={posts?.length ?? 0}
        />
        <TabButton
          active={tab === "comments"}
          onClick={() => setTab("comments")}
          label="내가 쓴 댓글"
          count={comments?.length ?? 0}
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
  nickname,
  profileImage,
  likes,
  postCount,
  commentCount,
  cooldown,
}: {
  nickname: string;
  profileImage: string | null;
  likes: number;
  postCount: number;
  commentCount: number;
  cooldown: number;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass rounded-3xl p-5 md:p-6"
    >
      <div className="flex items-start gap-4">
        <ProfileImageEditor image={profileImage} nickname={nickname} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-extrabold tracking-tight md:text-2xl">
              {nickname}
            </h1>
            <Badge role={ME.role} />
          </div>
          <p className="mt-1 text-xs text-foreground/55">
            {cooldown > 0
              ? `닉네임은 ${cooldown}일 뒤에 변경할 수 있어요`
              : "닉네임은 30일에 한 번 변경할 수 있어요"}
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
// 프로필 이미지 업로드 — 클릭하면 파일 선택 → data URL 로 저장
// ─────────────────────────────────────────────

function ProfileImageEditor({
  image,
  nickname,
}: {
  image: string | null;
  nickname: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      window.alert("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      window.alert("이미지는 2MB 이하로 올려주세요.");
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await attemptUpdateProfileImage(dataUrl);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!image) return;
    if (!window.confirm("프로필 사진을 기본 아바타로 되돌릴까요?")) return;
    setBusy(true);
    try {
      await attemptUpdateProfileImage(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <Avatar
        author={{ ...ME, name: nickname, imageUrl: image }}
        size="xl"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="프로필 사진 변경"
        className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-background bg-violet-500 text-white shadow-[0_4px_12px_rgba(124,58,237,0.45)] transition-transform hover:scale-105 disabled:opacity-50"
      >
        <Camera className="h-3.5 w-3.5" />
      </button>

      {image && (
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
        accept="image/*"
        onChange={onPick}
        className="hidden"
      />
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
// 내가 쓴 글 / 댓글 목록
// ─────────────────────────────────────────────

function MyPostList({ posts }: { posts: Post[] | null }) {
  if (posts === null) {
    return <SkeletonList />;
  }
  if (posts.length === 0) {
    return <EmptyState text="아직 쓴 글이 없어요" />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {posts.map((p) => (
        <li key={p.id}>
          <Link
            href={`/feed/${p.id}`}
            className="glass block rounded-2xl p-4 transition-shadow hover:shadow-[0_6px_20px_rgba(124,58,237,0.2)]"
          >
            <div className="mb-1 flex items-center gap-2 text-[11px] text-foreground/55">
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 font-semibold text-violet-500">
                {CHANNEL_LABEL[p.channel]}
              </span>
              <span>· {relativeTime(p.createdAt)}</span>
            </div>
            <PostContent
              text={p.content}
              className="text-sm text-foreground/85"
              collapsible
            />
            <div className="mt-2 flex items-center gap-3 text-[11px] text-foreground/55">
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {p.likes}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {p.commentCount}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MyCommentList({ comments }: { comments: Comment[] | null }) {
  if (comments === null) {
    return <SkeletonList />;
  }
  if (comments.length === 0) {
    return <EmptyState text="아직 쓴 댓글이 없어요" />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {comments.map((c) => (
        <li
          key={c.id}
          className="glass rounded-2xl p-4"
        >
          <div className="mb-1 flex items-center gap-2 text-[11px] text-foreground/55">
            <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-semibold text-cyan-600 dark:text-cyan-400">
              {targetLabel(c.targetId)}
            </span>
            <span>· {relativeTime(c.createdAt)}</span>
          </div>
          <PostContent
            text={c.content}
            className="text-sm text-foreground/85"
          />
          <div className="mt-2 flex items-center gap-3 text-[11px] text-foreground/55">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {c.likes}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SkeletonList() {
  return (
    <ul className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="glass h-20 animate-pulse rounded-2xl"
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

// targetId prefix → 채널명 매핑 (댓글 카드에 노출)
const TARGET_LABEL: Record<string, string> = {
  feed: "자유게시판",
  notice: "공지사항",
  lost: "분실물",
  share: "나눔장터",
  debate: "이슈토론",
  qna: "학습 Q&A",
  alumni: "졸업생",
  reviews: "선배 후기",
  news: "문태뉴스",
};

function targetLabel(targetId: string): string {
  const prefix = targetId.split(":")[0];
  return TARGET_LABEL[prefix] ?? "댓글";
}
