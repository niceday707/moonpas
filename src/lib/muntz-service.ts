"use client";

// ============================================================================
// 문츠(Muntz) — Supabase 데이터 헬퍼
// ----------------------------------------------------------------------------
// muntz_items 테이블 CRUD. 영상 자체는 저장하지 않으며 youtube_id 와
// 메타데이터만 다룬다. iframe embed 재생 정책은 muntz-data.ts 의 muntzEmbedUrl 참고.
//
// 데이터 흐름:
//  · /muntz 피드:   listVisibleMuntzItems() — visible / auto_approved 만, 최신순.
//  · 학생/교사 등록: createMuntzItem() — RLS 가 source='manual' / review_status='visible' /
//                    created_by=auth.uid() 강제.
//  · 숨김 처리:      hideMuntzItem() — review_status='hidden'. 본인 글은 회수,
//                    admin 은 어느 글이든 가능 (RLS 가 분기).
//
// ⚠️ TODO(검수): 등록된 영상의 실제 내용은 사람이 최종 검수하는 것이 원칙.
//    1차 정책은 "즉시 노출 + 문제시 hidden" — 운영 부담을 줄이는 대신 사후 대응에 의존한다.
// ============================================================================

import { supabase } from "@/lib/supabase";
import type {
  MuntzCategory,
  MuntzItem,
  MuntzReviewStatus,
  TargetGrade,
} from "@/lib/muntz-data";
import {
  TARGET_GRADE_LABEL,
  gradeLabelToKey,
} from "@/lib/muntz-data";

// ─── DB row 타입 ─────────────────────────────────────────────────────────────
export type MuntzItemRow = {
  id: string;
  youtube_id: string;
  youtube_url: string;
  title: string;
  channel_title: string | null;
  author_nickname: string;
  category: string;
  target_grade: string;
  description: string | null;
  safety_note: string | null;
  source: "manual" | "youtube_auto";
  review_status: MuntzReviewStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** 학생/교사 수동 등록 입력 */
export type MuntzCreateInput = {
  youtubeId: string;
  youtubeUrl: string;
  title: string;
  authorNickname: string;
  category: MuntzCategory;
  targetGrade: TargetGrade;
  description?: string;
};

// ─── row ↔ UI 모델 변환 ──────────────────────────────────────────────────────
export function rowToMuntzItem(row: MuntzItemRow): MuntzItem {
  return {
    id: row.id,
    youtubeId: row.youtube_id,
    youtubeUrl: row.youtube_url,
    title: row.title,
    channelTitle: row.channel_title ?? undefined,
    authorNickname: row.author_nickname,
    category: row.category as MuntzCategory,
    targetGrade: gradeLabelToKey(row.target_grade),
    description: row.description ?? "",
    safetyNote: row.safety_note ?? undefined,
    reviewStatus: row.review_status,
  };
}

// ─── 조회 ─────────────────────────────────────────────────────────────────────

/** /muntz 피드 — visible/auto_approved 만 최신 등록순. */
export async function listVisibleMuntzItems(): Promise<MuntzItem[]> {
  const { data, error } = await supabase
    .from("muntz_items")
    .select("*")
    .in("review_status", ["visible", "auto_approved"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[listVisibleMuntzItems] 실패", error);
    return [];
  }
  return ((data ?? []) as MuntzItemRow[]).map(rowToMuntzItem);
}

// ─── 변경 ─────────────────────────────────────────────────────────────────────

export type MuntzCreateResult =
  | { ok: true; item: MuntzItem }
  | { ok: false; reason: "unauthorized" | "network" | "validation"; message: string };

/**
 * 학생/교사 수동 등록.
 * 호출 측에서 미리 muntz-profanity 의 findBannedWordInFields 로 1차 검사 권장.
 * RLS 가 source='manual' / review_status='visible' / created_by=auth.uid() 강제하므로
 * 클라이언트가 이 값을 임의로 바꾸려 해도 거부된다.
 */
export async function createMuntzItem(
  input: MuntzCreateInput,
  authorId: string,
): Promise<MuntzCreateResult> {
  const row = {
    youtube_id: input.youtubeId,
    youtube_url: input.youtubeUrl,
    title: input.title.trim(),
    author_nickname: input.authorNickname.trim(),
    category: input.category,
    target_grade: TARGET_GRADE_LABEL[input.targetGrade] ?? "전 학년",
    description: input.description?.trim() || null,
    source: "manual" as const,
    review_status: "visible" as const,
    created_by: authorId,
  };

  const { data, error } = await supabase
    .from("muntz_items")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    console.error("[createMuntzItem] insert 실패", {
      message: error.message,
      code: (error as unknown as { code?: string }).code,
    });
    // RLS 차단(권한 부족) 은 42501, 위반 메시지에 "row-level security" 포함
    const msg = error.message ?? "";
    if (msg.includes("row-level security") || msg.includes("violates")) {
      return {
        ok: false,
        reason: "unauthorized",
        message: "등록 권한이 없습니다. 다시 로그인 후 시도해주세요.",
      };
    }
    return {
      ok: false,
      reason: "network",
      message: `등록에 실패했습니다.\n${error.message}`,
    };
  }

  return { ok: true, item: rowToMuntzItem(data as MuntzItemRow) };
}

/**
 * 문제 영상 숨김 처리 — review_status='hidden'.
 *  · 본인이 올린 글: 회수 (RLS 통과)
 *  · admin: 어느 글이든 가능 (RLS 통과)
 *  · 그 외: RLS 가 차단 — 호출은 실패 응답 반환
 *
 * ⚠️ TODO(권한 분기): 현재 UI 는 모든 사용자에게 버튼을 노출한다.
 *    "신고" 와 "강제 숨김" 을 분리하려면 호출 측에서 profiles.role 을 보고
 *    admin/teacher 일 때만 hideMuntzItem 을 부르고, 그 외에는 별도 신고 테이블로
 *    보내야 한다. 1차 구현은 RLS 가 실제 권한을 강제하는 방식.
 */
export async function hideMuntzItem(
  id: string,
): Promise<{ ok: boolean; message: string }> {
  const { error } = await supabase
    .from("muntz_items")
    .update({ review_status: "hidden" })
    .eq("id", id);
  if (error) {
    console.error("[hideMuntzItem] 실패", {
      id,
      message: error.message,
      code: (error as unknown as { code?: string }).code,
    });
    return {
      ok: false,
      message: "숨김 처리에 실패했습니다 (권한이 없거나 네트워크 오류).",
    };
  }
  return { ok: true, message: "숨김 처리되었습니다." };
}
