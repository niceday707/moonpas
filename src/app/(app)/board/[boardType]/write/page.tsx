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
import { uploadImage } from "@/lib/storage";

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
  // 이미지 상태 — 새로 고른 파일은 imageFile, 미리보기는 imagePreview, 수정 모드 시작 시 원본은 originalImageUrl
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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
      setOriginalImageUrl(post.image_url);
      setImagePreview(post.image_url);
      setLoadingExisting(false);
    });
    return () => {
      active = false;
    };
  }, [editId]);

  // 컴포넌트 언마운트 또는 새 파일 선택 시 이전 object URL 메모리 해제
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // 이전 object URL 정리
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    const objUrl = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreview(objUrl);
    setError(null);
  }

  function handleImageRemove() {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
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
    // 챌린지는 이미지 필수 — 새 파일이거나 기존 이미지가 있어야 함
    if (isChallenge && !imageFile && !imagePreview) {
      setError("챌린지 게시판은 인증샷 이미지가 필요해요.");
      return;
    }
    if (!user) {
      setError("로그인이 필요합니다.");
      return;
    }

    // 1) 이미지 처리 — 새 파일이 있으면 업로드, 없으면 기존 값 유지/제거
    let imageUrl: string | null = originalImageUrl;
    if (imageFile) {
      setUploading(true);
      const url = await uploadImage(imageFile, user.id);
      setUploading(false);
      if (!url) {
        setError("이미지 업로드에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      imageUrl = url;
    } else if (imagePreview === null) {
      // 사용자가 기존 이미지를 제거했고 새 파일도 안 골랐을 때
      imageUrl = null;
    }

    setSubmitting(true);

    console.log("[write] 저장 시도", {
      authUserId: user.id,
      profileId: profile?.id,
      boardType,
      editId,
      imageUrl,
    });

    if (editId) {
      const { error: e } = await updatePost(editId, {
        title: title.trim(),
        content: content.trim(),
        imageUrl,
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
        imageUrl,
      });
      setSubmitting(false);
      if (result.error || !result.id) {
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
            disabled={submitting || uploading}
            className="mt-1.5 block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white file:hover:bg-violet-700 dark:text-gray-300"
          />
          {imagePreview && (
            <div className="relative mt-3 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="미리보기"
                className="max-h-72 rounded-lg border border-gray-200 object-contain dark:border-white/10"
              />
              <button
                type="button"
                onClick={handleImageRemove}
                disabled={submitting || uploading}
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
            disabled={submitting || uploading}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(submitting || uploading) && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {uploading
              ? "이미지 업로드 중..."
              : submitting
              ? "저장 중..."
              : editId
              ? "수정"
              : "작성"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
