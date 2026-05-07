"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Pin,
  Bell,
  Download,
  X,
  ChevronRight,
  Plus,
  Users,
  BookOpen,
  Eye,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import {
  NOTICES,
  addNotice,
  markAsRead,
  ATTACHMENT_ICON,
  AUDIENCE_META,
  type Notice,
  type NoticeAudience,
  type AttachmentType,
} from "@/lib/notice-data";
import { CommentSection } from "@/components/comments/CommentSection";
import { countCommentsForTarget, subscribe } from "@/lib/mock-data";

// ─── 마크다운 렌더러 ──────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={i} className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-xs">
          {part.slice(1, -1)}
        </code>
      );
    return <span key={i}>{part}</span>;
  });
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      nodes.push(
        <h3 key={i} className="mb-2 mt-5 text-base font-bold text-foreground">
          {renderInline(line.slice(4))}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      nodes.push(
        <h2 key={i} className="mb-2 mt-6 text-lg font-extrabold text-foreground">
          {renderInline(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith("# ")) {
      nodes.push(
        <h1 key={i} className="mb-3 mt-6 text-xl font-extrabold text-foreground">
          {renderInline(line.slice(2))}
        </h1>,
      );
    } else if (line.startsWith("> ")) {
      nodes.push(
        <blockquote
          key={i}
          className="my-3 border-l-2 border-accent/50 pl-4 text-sm italic text-foreground/65"
        >
          {renderInline(line.slice(2))}
        </blockquote>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-3 ml-5 list-disc space-y-1">
          {items.map((item, j) => (
            <li key={j} className="text-sm text-foreground/80">
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="my-3 ml-5 list-decimal space-y-1">
          {items.map((item, j) => (
            <li key={j} className="text-sm text-foreground/80">
              {renderInline(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    } else if (line.startsWith("| ") && line.includes(" | ")) {
      // 간단한 테이블
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("| ")) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines
        .filter((l) => !l.match(/^\|[-| ]+\|$/))
        .map((l) =>
          l
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim()),
        );
      if (rows.length > 0) {
        nodes.push(
          <div key={`tbl-${i}`} className="my-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {rows[0].map((cell, ci) => (
                    <th
                      key={ci}
                      className="border border-white/10 bg-foreground/5 px-3 py-1.5 text-left text-xs font-bold text-foreground/70"
                    >
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="border border-white/10 px-3 py-1.5 text-foreground/75"
                      >
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    } else if (line.trim() === "") {
      nodes.push(<div key={i} className="h-2" />);
    } else {
      nodes.push(
        <p key={i} className="my-1 text-sm leading-relaxed text-foreground/80">
          {renderInline(line)}
        </p>,
      );
    }

    i++;
  }

  return <div>{nodes}</div>;
}

// ─── 첨부파일 아이콘 색 ───────────────────────────────────────────────────────

const ATTACHMENT_COLOR: Record<AttachmentType, string> = {
  pdf: "#ef4444",
  hwp: "#3b82f6",
  xlsx: "#10b981",
  docx: "#3b82f6",
  img: "#ec4899",
  zip: "#f59e0b",
};

// ─── 애니메이션 ────────────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 26 } },
};

// ─── 공지 카드 ────────────────────────────────────────────────────────────────

function NoticeCard({
  notice,
  onClick,
}: {
  notice: Notice;
  onClick: () => void;
}) {
  const audienceMeta = AUDIENCE_META[notice.audience];
  // 댓글 수 — mock-data 변경 구독으로 실시간 갱신
  const [commentCount, setCommentCount] = useState(() =>
    countCommentsForTarget(`notice:${notice.id}`),
  );
  useEffect(() => {
    const refresh = () =>
      setCommentCount(countCommentsForTarget(`notice:${notice.id}`));
    refresh();
    return subscribe(refresh);
  }, [notice.id]);

  return (
    <GlassCard
      onClick={onClick}
      className={cn(
        "flex flex-col gap-3 transition-opacity",
        notice.read && "opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* 배지 행 */}
          <div className="flex flex-wrap items-center gap-2">
            {notice.pinned && (
              <span className="flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-bold text-red-400 ring-1 ring-red-400/25">
                <Pin className="h-3 w-3" />
                중요
              </span>
            )}
            {!notice.read && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-extrabold text-accent ring-1 ring-accent/30">
                NEW
              </span>
            )}
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{
                background: `${audienceMeta.color}12`,
                color: audienceMeta.color,
              }}
            >
              {audienceMeta.label}
            </span>
          </div>

          {/* 제목 */}
          <p className={cn("font-bold leading-snug", !notice.read && "text-foreground", notice.read && "text-foreground/70")}>
            {notice.title}
          </p>

          {/* 본문 미리보기 2줄 */}
          <p className="line-clamp-2 text-xs text-foreground/55 leading-relaxed">
            {notice.content
              .replace(/#{1,3} /g, "")
              .replace(/\*\*/g, "")
              .replace(/\*/g, "")
              .replace(/`/g, "")
              .replace(/^[-*>] /gm, "")
              .replace(/^\d+\. /gm, "")
              .replace(/\|[^|]*\|/g, "")
              .replace(/\n+/g, " ")
              .trim()}
          </p>
        </div>

        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-foreground/25" />
      </div>

      {/* 작성자 + 날짜 + 첨부파일 수 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge role="teacher" />
          <span className="text-xs text-foreground/50">
            {notice.author_name} · {notice.author_dept}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-foreground/40">
          {notice.attachments.length > 0 && (
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {notice.attachments.length}
            </span>
          )}
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {commentCount}
          </span>
          <span>{relativeTime(notice.created_at)}</span>
        </div>
      </div>
    </GlassCard>
  );
}

// ─── 공지 상세 패널 ───────────────────────────────────────────────────────────

function NoticeDetailPanel({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: () => void;
}) {
  const audienceMeta = AUDIENCE_META[notice.audience];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      onClick={onClose}
    >
      {/* 딤 배경 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* 패널 */}
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "glass relative w-full overflow-y-auto",
          "rounded-t-3xl sm:max-w-2xl sm:rounded-3xl",
          "max-h-[90dvh]",
        )}
      >
        {/* 모바일 드래그 핸들 */}
        <div className="flex justify-center pb-1 pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-foreground/20" />
        </div>

        {/* 헤더 */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/8 bg-[var(--card-bg)] px-6 py-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2">
            {notice.pinned && (
              <span className="flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-bold text-red-400 ring-1 ring-red-400/25">
                <Pin className="h-3 w-3" />
                중요
              </span>
            )}
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: `${audienceMeta.color}15`, color: audienceMeta.color }}
            >
              {audienceMeta.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground/50 hover:bg-foreground/18"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5">
          <h2 className="mb-1 text-xl font-extrabold leading-snug">{notice.title}</h2>

          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/50">
            <div className="flex items-center gap-1.5">
              <Badge role="teacher" />
              <span>{notice.author_name} · {notice.author_dept}</span>
            </div>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {relativeTime(notice.created_at)}
            </span>
          </div>

          {/* 마크다운 본문 */}
          <div className="rounded-2xl bg-foreground/3 p-4">
            <MarkdownContent content={notice.content} />
          </div>

          {/* 첨부파일 */}
          {notice.attachments.length > 0 && (
            <div className="mt-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-foreground/45">
                첨부파일 ({notice.attachments.length})
              </p>
              <ul className="flex flex-col gap-2">
                {notice.attachments.map((att) => (
                  <li key={att.name}>
                    <a
                      href={att.url}
                      download={att.name}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-3 rounded-2xl bg-foreground/5 px-4 py-3 transition-colors hover:bg-foreground/10"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                        style={{ background: `${ATTACHMENT_COLOR[att.type]}15` }}
                      >
                        {ATTACHMENT_ICON[att.type]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{att.name}</p>
                        <p className="text-xs text-foreground/45">{att.size}</p>
                      </div>
                      <Download className="h-4 w-4 shrink-0 text-foreground/35" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 댓글 영역 */}
          <div className="mt-6 border-t border-foreground/10 pt-5">
            <CommentSection
              targetId={`notice:${notice.id}`}
              title="댓글"
              bordered={false}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── 공지 작성 폼 ────────────────────────────────────────────────────────────

function ComposeForm({
  onSubmit,
  onClose,
}: {
  onSubmit: (notice: Omit<Notice, "id" | "created_at">) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    content: "",
    audience: "전체" as NoticeAudience,
    pinned: false,
  });
  const [preview, setPreview] = useState(false);

  const INPUT_CLS =
    "w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-role-teacher/40";

  const handleSubmit = () => {
    if (!form.title.trim() || !form.content.trim()) return;
    onSubmit({
      title: form.title,
      content: form.content,
      author_name: "선생님",
      author_dept: "교무부",
      audience: form.audience,
      pinned: form.pinned,
      read: false,
      attachments: [],
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      <GlassCard interactive={false} className="mb-4 ring-1 ring-role-teacher/25">
        {/* 폼 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold text-role-teacher">공지 작성</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreview((v) => !v)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                preview
                  ? "bg-role-teacher text-white"
                  : "bg-foreground/8 text-foreground/55 hover:bg-foreground/14",
              )}
            >
              {preview ? "편집" : "미리보기"}
            </button>
            <button onClick={onClose} className="text-foreground/35 hover:text-foreground/60">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {/* 제목 */}
          <input
            value={form.title}
            onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))}
            placeholder="공지 제목"
            className={INPUT_CLS}
          />

          {/* 대상 선택 */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-semibold text-foreground/55">
              <Users className="inline h-3.5 w-3.5" /> 대상
            </span>
            {(["전체", "학생만", "학부모만"] as NoticeAudience[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setForm((v) => ({ ...v, audience: a }))}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                  form.audience === a
                    ? "bg-role-teacher text-white"
                    : "bg-foreground/5 text-foreground/55 hover:bg-foreground/10",
                )}
              >
                {a}
              </button>
            ))}
          </div>

          {/* 중요 공지 체크 */}
          <label className="flex cursor-pointer items-center gap-2">
            <div
              onClick={() => setForm((v) => ({ ...v, pinned: !v.pinned }))}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md transition-all",
                form.pinned
                  ? "bg-red-500 text-white"
                  : "bg-foreground/10 text-foreground/30",
              )}
            >
              {form.pinned && <Pin className="h-3 w-3" />}
            </div>
            <span className="text-xs font-semibold text-foreground/65">
              중요 공지로 등록 (상단 고정)
            </span>
          </label>

          {/* 본문 / 미리보기 */}
          <AnimatePresence mode="wait">
            {preview ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-h-[160px] rounded-xl bg-foreground/5 p-4 ring-1 ring-white/10"
              >
                {form.content ? (
                  <MarkdownContent content={form.content} />
                ) : (
                  <p className="text-xs text-foreground/30">본문을 입력하면 미리보기가 표시됩니다.</p>
                )}
              </motion.div>
            ) : (
              <motion.textarea
                key="editor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                value={form.content}
                onChange={(e) => setForm((v) => ({ ...v, content: e.target.value }))}
                placeholder={
                  "본문을 입력하세요. 마크다운을 지원합니다.\n\n## 제목\n**굵게** *기울임* `코드`\n- 항목 1\n- 항목 2"
                }
                rows={8}
                className={cn(INPUT_CLS, "resize-none font-mono text-xs")}
              />
            )}
          </AnimatePresence>

          {/* 마크다운 도움말 */}
          {!preview && (
            <p className="text-[11px] text-foreground/30">
              **굵게** &nbsp;·&nbsp; *기울임* &nbsp;·&nbsp; `코드` &nbsp;·&nbsp; ## 제목
              &nbsp;·&nbsp; - 목록 &nbsp;·&nbsp; {"> 인용"}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!form.title.trim() || !form.content.trim()}
            className="w-full rounded-xl bg-role-teacher py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            공지 게시하기
          </button>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>(NOTICES);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false); // TODO: Supabase auth 연동

  const pinned = useMemo(() => notices.filter((n) => n.pinned), [notices]);
  const regular = useMemo(
    () =>
      notices
        .filter((n) => !n.pinned)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [notices],
  );
  const unreadCount = useMemo(() => notices.filter((n) => !n.read).length, [notices]);

  const openNotice = (notice: Notice) => {
    markAsRead(notice.id);
    setNotices((prev) => prev.map((n) => (n.id === notice.id ? { ...n, read: true } : n)));
    setSelectedNotice(notice);
  };

  const handleAddNotice = (data: Omit<Notice, "id" | "created_at">) => {
    const newNotice = addNotice(data);
    setNotices((prev) => [newNotice, ...prev]);
    setShowCompose(false);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* ── 헤더 ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-7"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-warning/15">
                <Bell className="h-5 w-5 text-warning" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
                공지사항
              </h1>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-extrabold text-white"
                >
                  {unreadCount}
                </motion.span>
              )}
            </div>
            <p className="text-sm text-foreground/55">
              학교의 중요한 소식과 안내사항을 확인하세요.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* 교사 모드 토글 */}
            <button
              onClick={() => setIsTeacher((v) => !v)}
              className="text-[11px] text-foreground/25 hover:text-foreground/50"
            >
              {isTeacher ? "[교사]" : "[학생]"}
            </button>
            <AnimatePresence>
              {isTeacher && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowCompose((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)] transition-opacity hover:opacity-90"
                >
                  {showCompose ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {showCompose ? "닫기" : "공지 작성"}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* ── 공지 작성 폼 ────────────────────────────────────────── */}
      <AnimatePresence>
        {showCompose && isTeacher && (
          <ComposeForm onSubmit={handleAddNotice} onClose={() => setShowCompose(false)} />
        )}
      </AnimatePresence>

      {/* ── 중요 공지 ──────────────────────────────────────────── */}
      {pinned.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-400">
            <Pin className="h-3.5 w-3.5" />
            중요 공지
          </div>
          <motion.ul
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-3"
          >
            {pinned.map((notice) => (
              <motion.li key={notice.id} variants={itemVariants}>
                <div className="relative">
                  {/* 핀 강조 테두리 */}
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-red-400/30 pointer-events-none" />
                  <NoticeCard notice={notice} onClick={() => openNotice(notice)} />
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </section>
      )}

      {/* ── 일반 공지 ──────────────────────────────────────────── */}
      <section>
        {pinned.length > 0 && (
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-foreground/40">
            <BookOpen className="h-3.5 w-3.5" />
            일반 공지
          </div>
        )}
        {regular.length === 0 ? (
          <div className="py-14 text-center text-sm text-foreground/35">
            공지사항이 없습니다.
          </div>
        ) : (
          <motion.ul
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-3"
          >
            {regular.map((notice) => (
              <motion.li key={notice.id} variants={itemVariants}>
                <NoticeCard notice={notice} onClick={() => openNotice(notice)} />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </section>

      {/* 안 읽은 공지 없을 때 안내 */}
      {unreadCount === 0 && notices.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-success/8 py-3 text-sm text-success"
        >
          <AlertCircle className="h-4 w-4" />
          모든 공지를 확인했습니다.
        </motion.div>
      )}

      {/* ── 공지 상세 패널 ──────────────────────────────────────── */}
      <AnimatePresence>
        {selectedNotice && (
          <NoticeDetailPanel
            notice={selectedNotice}
            onClose={() => setSelectedNotice(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
