"use client";

// /user/[userId] — 특정 사용자가 작성한 글 목록.
// 익명 게시판은 작성자 식별이 불가하므로 결과에서 자동 제외 (listPostsByAuthor 가 처리).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { Badge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { listPostsByAuthor, type PostRow } from "@/lib/board";
import { BOARD_LABEL } from "@/lib/board";
import { getPublicProfile, type PublicProfile } from "@/lib/supabase-profile";

export default function UserPostsPage() {
  return (
    <AuthGate
      title="사용자 프로필 보기에는 로그인이 필요합니다"
      description="문태고 학생·교사·학부모·졸업생만 이용할 수 있어요."
    >
      <UserPostsInner />
    </AuthGate>
  );
}

function UserPostsInner() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    Promise.all([getPublicProfile(userId), listPostsByAuthor(userId, 50)]).then(
      ([p, list]) => {
        if (!active) return;
        setProfile(p);
        setPosts(list);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <main className="mx-auto w-full max-w-screen-md px-4 py-6 md:py-10">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-foreground/55 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        홈으로
      </Link>

      {/* 헤더 */}
      <div className="flex items-center gap-3 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-5">
        <UserAvatar
          nickname={profile?.nickname ?? ""}
          role={profile?.role ?? null}
          avatarUrl={profile?.avatar_url ?? null}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-base font-bold">
              {profile?.nickname || "닉네임 없음"}
            </span>
            {profile?.role && <Badge role={profile.role} />}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-foreground/55">
            {profile?.bio?.trim() || "소개가 없습니다"}
          </p>
        </div>
      </div>

      {/* 글 목록 */}
      <h2 className="mt-6 mb-2 text-sm font-bold text-foreground/80">
        작성한 글{" "}
        <span className="font-extrabold text-violet-600 dark:text-violet-400">
          {posts.length}
        </span>
        개
      </h2>

      {loading ? (
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] py-10 text-center text-sm text-foreground/50">
          불러오는 중…
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] py-10 text-center text-sm text-foreground/50">
          아직 작성한 글이 없어요.
        </div>
      ) : (
        <ul className="divide-y divide-foreground/5 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02]">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/board/${p.board_type}/${p.id}`}
                className="flex items-center gap-2 px-4 py-3 transition-colors hover:bg-foreground/5"
              >
                <span className="shrink-0 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-300">
                  {BOARD_LABEL[p.board_type]}
                </span>
                <span className="line-clamp-1 min-w-0 flex-1 text-sm font-medium">
                  {p.title}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-foreground/45">
                  {new Date(p.created_at).toLocaleDateString("ko-KR", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
