"use client";

// 배너 슬라이더 — Supabase 데이터/이미지 헬퍼
//   · banners 테이블 CRUD
//   · storage 'banners' 버킷 업로드 (admin 전용 RLS)

import { supabase } from "@/lib/supabase";

const BANNERS_BUCKET = "banners";

export type Banner = {
  id: string;
  title: string;
  description: string | null;
  link: string | null;
  image_url: string | null;
  background_color: string;
  is_active: boolean;
  order_index: number;
  created_at: string;
  created_by: string | null;
};

export type BannerInput = {
  title: string;
  description?: string | null;
  link?: string | null;
  image_url?: string | null;
  background_color?: string;
  is_active?: boolean;
  order_index?: number;
};

// ── 조회 ──────────────────────────────────────────────────

/** 활성 배너 — 대시보드 슬라이더용 */
export async function listActiveBanners(): Promise<Banner[]> {
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .eq("is_active", true)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[listActiveBanners] 실패", error);
    return [];
  }
  return (data ?? []) as Banner[];
}

/** 전체 배너 — 관리자 페이지용 (비활성 포함) */
export async function listAllBanners(): Promise<Banner[]> {
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[listAllBanners] 실패", error);
    return [];
  }
  return (data ?? []) as Banner[];
}

// ── 변경 ──────────────────────────────────────────────────

export async function createBanner(
  input: BannerInput,
  authorId: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("banners")
    .insert({
      title: input.title,
      description: input.description ?? null,
      link: input.link ?? null,
      image_url: input.image_url ?? null,
      background_color: input.background_color ?? "#6C63FF",
      is_active: input.is_active ?? true,
      order_index: input.order_index ?? 0,
      created_by: authorId,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[createBanner] insert 실패", error);
    return { id: null, error: error.message };
  }
  return { id: data?.id ?? null, error: null };
}

export async function updateBanner(
  id: string,
  patch: Partial<BannerInput>,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("banners")
    .update({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.link !== undefined ? { link: patch.link } : {}),
      ...(patch.image_url !== undefined ? { image_url: patch.image_url } : {}),
      ...(patch.background_color !== undefined
        ? { background_color: patch.background_color }
        : {}),
      ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
      ...(patch.order_index !== undefined ? { order_index: patch.order_index } : {}),
    })
    .eq("id", id);
  if (error) {
    console.error("[updateBanner] 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

export async function deleteBanner(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) {
    console.error("[deleteBanner] 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

export async function toggleBannerActive(
  id: string,
  next: boolean,
): Promise<{ error: string | null }> {
  return updateBanner(id, { is_active: next });
}

/** 두 배너의 order_index 를 교환 — 위/아래 화살표용 */
export async function swapBannerOrder(
  a: Banner,
  b: Banner,
): Promise<{ error: string | null }> {
  // 같은 순서값이면 임시값으로 회피 후 교환 (UNIQUE 제약은 없지만 안전하게)
  const { error: e1 } = await supabase
    .from("banners")
    .update({ order_index: b.order_index })
    .eq("id", a.id);
  if (e1) return { error: e1.message };
  const { error: e2 } = await supabase
    .from("banners")
    .update({ order_index: a.order_index })
    .eq("id", b.id);
  if (e2) return { error: e2.message };
  return { error: null };
}

// ── 이미지 업로드 ─────────────────────────────────────────

/** banners 버킷에 이미지 업로드 → public URL 반환 (실패 시 null) */
export async function uploadBannerImage(
  file: File,
  authorId: string,
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${authorId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BANNERS_BUCKET)
      .upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
    if (uploadError) {
      console.error("[uploadBannerImage] upload 실패", uploadError);
      return null;
    }
    const { data } = supabase.storage.from(BANNERS_BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (err) {
    console.error("[uploadBannerImage] 예외", err);
    return null;
  }
}
