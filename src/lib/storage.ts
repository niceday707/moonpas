"use client";

// Supabase Storage 'images' 버킷에 압축된 JPEG 으로 업로드하고 public URL 을 돌려준다.
// 사용처: 글 작성/수정 시 첨부 이미지 처리.

import { supabase } from "@/lib/supabase";

const BUCKET = "images";

/**
 * 클라이언트에서 Canvas 로 이미지 리사이즈 + JPEG 재압축 후 Blob 반환.
 * 사용자 업로드 사진의 크기/용량을 줄여 Storage 비용과 전송 시간을 절감한다.
 */
async function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.7,
): Promise<Blob> {
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
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("toBlob 변환 실패"));
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error("이미지 로드 실패"));
    };
    img.src = objUrl;
  });
}

/** 파일명에서 안전하지 않은 문자를 _ 로 치환 (확장자는 강제로 .jpg) */
function safeBaseName(originalName: string): string {
  const noExt = originalName.replace(/\.[^.]+$/, "").normalize("NFC");
  const cleaned = noExt.replace(/[^\p{L}\p{N}._-]/gu, "_");
  return cleaned || "image";
}

/**
 * 이미지 업로드 — 압축 → Supabase Storage 업로드 → public URL 반환.
 * 실패 시 console.error 후 null 반환.
 */
export async function uploadImage(
  file: File,
  userId: string,
): Promise<string | null> {
  try {
    const blob = await compressImage(file);
    const path = `${userId}/${Date.now()}_${safeBaseName(file.name)}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("[uploadImage] Storage upload 실패", {
        path,
        message: uploadError.message,
        raw: uploadError,
      });
      return null;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      console.error("[uploadImage] getPublicUrl 결과가 비어있음", { path });
      return null;
    }
    console.log("[uploadImage] 업로드 성공", { path, url: data.publicUrl });
    return data.publicUrl;
  } catch (err) {
    console.error("[uploadImage] 처리 중 예외", err);
    return null;
  }
}
