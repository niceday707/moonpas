"use client";

// 글 쓰기 / 수정 — /board/[boardType]/write?id=xxx (id 있으면 수정 모드)
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import {
  BOARD_LABEL,
  createPost,
  getPost,
  updatePost,
  type BoardType,
} from "@/lib/board";
import { useSupabaseProfile } from "@/lib/supabase-profile";

const VALID_BOARDS = Object.keys(BOARD_LABEL) as BoardType[];

export default function BoardWritePage() {
  return (
    <AuthGate
      title="글쓰기는 로그인이 필요합니다"
      description="로그인 후 글을 작성하실 수 있어요."
    >
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-violet-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        }
      >
        <WriteInner />
      </Suspense>
    </AuthGate>
  );
}

function WriteInner() {
  const params = useParams<{ boardType: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const boardType = params.boardType as BoardType;
  const editId = search.get("id");

  const { user, profile, loading: profileLoading } = useSupabaseProfile();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!editId);
  const [error, setError] = useState<string | null>(null);

  // 수정 모드: 기존 글 로드
  useEffect(() => {
    if (!editId) return;
    let active = true;
    setLoadingExisting(true);
    getPost(editId).then((post) => {
      if (!active || !post) return;
      setTitle(post.title);
      setContent(post.content);
      setImageDataUrl(post.image_url);
      setLoadingExisting(false);
    });
    return () => {
      active = false;
    };
  }, [editId]);

  if (!VALID_BOARDS.includes(boardType)) {
    return (
      <div className="mx-auto max-w-screen-md px-4 py-10 text-center text-sm text-gray-500">
        존재하지 않는 게시판입니다.
      </div>
    );
  }

  if (profileLoading || loadingExisting) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-violet-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-screen-md px-4 py-10 text-center">
        <p className="text-sm text-gray-500">먼저 닉네임과 역할을 설정해주세요.</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white"
        >
          대시보드로 이동
        </Link>
      </div>
    );
  }

  const isChallenge = boardType === "challenge";

  // 클라이언트에서 Canvas 로 이미지 리사이즈 + JPEG 재압축. 임시 조치 — 곧 Storage 업로드로 교체 예정.
  async function compressImage(
    file: File,
    maxWidth = 1200,
    quality = 0.7,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objUrl);
          reject(new Error("Canvas 2D context 생성 실패"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objUrl);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        reject(new Error("이미지 로드 실패"));
      };
      img.src = objUrl;
    });
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setImageDataUrl(dataUrl);
    } catch (err) {
      console.error("[handleImageChange] 압축 실패", err);
      setError("이미지를 처리할 수 없어요. 다른 사진으로 시도해주세요.");
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!content.trim()) {
      setError("내용을 입력해주세요.");
      return;
    }
    if (isChallenge && !imageDataUrl) {
      setError("챌린지 게시판은 인증샷 이미지가 필요해요.");
      return;
    }
    if (!user) {
      setError("로그인이 필요합니다.");
      return;
    }
    setSubmitting(true);

    // 디버깅용 — 어떤 user 로 시도하는지 확인
    console.log("[write] 저장 시도", {
      authUserId: user.id,
      profileId: profile?.id,
      boardType,
      editId,
    });

    if (editId) {
      const { error: e } = await updatePost(editId, {
        title: title.trim(),
        content: content.trim(),
      });
      setSubmitting(false);
      if (e) {
        setError(`수정 실패: ${e}`);
        return;
      }
      router.push(`/board/${boardType}/${editId}`);
    } else {
      const result = await createPost({
        authorId: user.id,
        boardType,
        title: title.trim(),
        content: content.trim(),
        imageUrl: imageDataUrl,
      });
      setSubmitting(false);
      if (result.error || !result.id) {
        // 실제 에러 정보를 그대로 화면에 노출 — Supabase 에러 코드/메시지/힌트
        const parts = [
          result.error ?? "알 수 없는 오류",
          result.code ? `code=${result.code}` : null,
          result.hint ? `hint=${result.hint}` : null,
        ].filter(Boolean);
        setError(`저장 실패: ${parts.join(" / ")}`);
        return;
      }
      router.push(`/board/${boardType}/${result.id}`);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-screen-md px-4 py-6"
    >
      <Link
        href={`/board/${boardType}`}
        className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-800 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {BOARD_LABEL[boardType]}로 돌아가기
      </Link>
      <h1 className="mt-2 text-xl font-extrabold text-gray-900 dark:text-white">
        {editId ? "글 수정" : "새 글 작성"}
      </h1>

      <div className="mt-5 space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.07] dark:bg-[#16162a]">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력해주세요"
            maxLength={100}
            disabled={submitting}
            className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            내용
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력해주세요"
            rows={10}
            disabled={submitting}
            className="mt-1.5 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          />
        </div>

        {/* 이미지 첨부 — 챌린지는 필수, 그 외에는 선택 */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            {isChallenge ? "인증샷 (필수)" : "이미지 첨부 (선택)"}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={submitting}
            className="mt-1.5 block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white file:hover:bg-violet-700 dark:text-gray-300"
          />
          {imageDataUrl && (
            <div className="relative mt-3 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageDataUrl}
                alt="미리보기"
                className="max-h-72 rounded-lg border border-gray-200 object-contain dark:border-white/10"
              />
              <button
                type="button"
                onClick={() => setImageDataUrl(null)}
                disabled={submitting}
                className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-black/90 disabled:opacity-50"
              >
                이미지 제거
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href={`/board/${boardType}`}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.05]"
          >
            취소
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? "저장 중..." : editId ? "수정" : "작성"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
