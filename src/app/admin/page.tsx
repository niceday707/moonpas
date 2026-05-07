"use client";

// 관리자 대시보드 — 통계 카드 + 최근 가입 회원 + 최근 게시글
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  FileText,
  MessageSquare,
  UserPlus,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BOARD_LABEL, type BoardType } from "@/lib/board";
import { cn } from "@/lib/utils";

type AdminRole = "student" | "teacher" | "parent" | "alumni" | "admin";

const ROLE_LABEL: Record<AdminRole, string> = {
  student: "학생",
  teacher: "교사",
  parent: "학부모",
  alumni: "졸업생",
  admin: "관리자",
};

const ROLE_STYLE: Record<AdminRole, string> = {
  student: "bg-blue-500/15 text-blue-300 ring-blue-400/30",
  teacher: "bg-violet-500/15 text-violet-300 ring-violet-400/30",
  parent: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  alumni: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  admin: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
};

type Stats = {
  members: number;
  posts: number;
  comments: number;
  todaySignups: number;
};

type RecentMember = {
  id: string;
  nickname: string;
  role: AdminRole;
  created_at: string;
};

type RecentPost = {
  id: string;
  title: string;
  board_type: BoardType;
  created_at: string;
  author_nickname: string | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [members, setMembers] = useState<RecentMember[]>([]);
  const [posts, setPosts] = useState<RecentPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        membersCount,
        postsCount,
        commentsCount,
        todayCount,
        recentMembers,
        recentPosts,
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("posts").select("*", { count: "exact", head: true }),
        supabase.from("comments").select("*", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("created_at", todayStart.toISOString()),
        supabase
          .from("profiles")
          .select("id, nickname, role, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("posts")
          .select(
            "id, title, board_type, created_at, author:profiles!author_id(nickname)",
          )
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (!active) return;

      setStats({
        members: membersCount.count ?? 0,
        posts: postsCount.count ?? 0,
        comments: commentsCount.count ?? 0,
        todaySignups: todayCount.count ?? 0,
      });

      setMembers(((recentMembers.data ?? []) as RecentMember[]) ?? []);

      type RawRecentPost = {
        id: string;
        title: string;
        board_type: BoardType;
        created_at: string;
        author: { nickname: string } | null;
      };
      const rawPosts = (recentPosts.data ?? []) as unknown as RawRecentPost[];
      setPosts(
        rawPosts.map((p) => ({
          id: p.id,
          title: p.title,
          board_type: p.board_type,
          created_at: p.created_at,
          author_nickname: p.author?.nickname ?? null,
        })),
      );

      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const cards: { label: string; icon: typeof Users; value: number; color: string }[] = [
    {
      label: "총 회원 수",
      icon: Users,
      value: stats?.members ?? 0,
      color: "from-violet-500 to-indigo-500",
    },
    {
      label: "총 게시글",
      icon: FileText,
      value: stats?.posts ?? 0,
      color: "from-cyan-500 to-blue-500",
    },
    {
      label: "총 댓글",
      icon: MessageSquare,
      value: stats?.comments ?? 0,
      color: "from-emerald-500 to-teal-500",
    },
    {
      label: "오늘 가입자",
      icon: UserPlus,
      value: stats?.todaySignups ?? 0,
      color: "from-amber-500 to-orange-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold md:text-2xl">대시보드</h1>
        <p className="mt-1 text-xs text-white/50">
          문파스 사이트 통계와 최근 활동을 한눈에 확인하세요.
        </p>
      </div>

      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c, idx) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-xl"
            >
              <div
                className={cn(
                  "absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br opacity-20 blur-2xl",
                  c.color,
                )}
              />
              <div
                className={cn(
                  "relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-white",
                  c.color,
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="relative mt-3 text-xs text-white/50">{c.label}</p>
              <p className="relative mt-1 text-2xl font-extrabold tabular-nums">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                ) : (
                  c.value.toLocaleString()
                )}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* 최근 가입 회원 + 최근 게시글 */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* 최근 가입 회원 */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-violet-300">
              <Users className="h-4 w-4" />
              최근 가입 회원
            </h2>
            <Link
              href="/admin/users"
              className="text-[11px] text-white/50 transition hover:text-white"
            >
              전체 보기 →
            </Link>
          </div>
          {loading ? (
            <div className="grid place-items-center px-5 py-10 text-xs text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-white/40">
              회원이 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 px-5 py-3 text-sm"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#7c3aed,#06b6d4)] text-xs font-bold text-white">
                    {m.nickname.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{m.nickname}</p>
                    <p className="text-[11px] text-white/40">
                      {formatDate(m.created_at)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                      ROLE_STYLE[m.role],
                    )}
                  >
                    {ROLE_LABEL[m.role]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 최근 게시글 */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-cyan-300">
              <FileText className="h-4 w-4" />
              최근 게시글
            </h2>
            <Link
              href="/admin/posts"
              className="text-[11px] text-white/50 transition hover:text-white"
            >
              전체 보기 →
            </Link>
          </div>
          {loading ? (
            <div className="grid place-items-center px-5 py-10 text-xs text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-white/40">
              게시글이 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/board/${p.board_type}/${p.id}`}
                    className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-white/[0.02]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="mt-0.5 text-[11px] text-white/40">
                        {p.author_nickname ?? "(알수없음)"} ·{" "}
                        {BOARD_LABEL[p.board_type] ?? p.board_type}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-white/40">
                      {formatDate(p.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
