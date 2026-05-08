"use client";

// D-Day 이벤트 — Supabase 데이터 헬퍼
//   · dday_events 테이블 CRUD
//   · 활성 이벤트는 누구나 읽기, 쓰기는 admin 전용 (RLS)

import { supabase } from "@/lib/supabase";

export type DdayEvent = {
  id: string;
  title: string;
  target_date: string; // YYYY-MM-DD (DATE 컬럼)
  description: string | null;
  is_active: boolean;
  order_index: number;
  created_at: string;
  created_by: string | null;
};

export type DdayEventInput = {
  title: string;
  target_date: string;
  description?: string | null;
  is_active?: boolean;
  order_index?: number;
};

// ── 조회 ──────────────────────────────────────────────────

/** 활성 이벤트 — 대시보드 카드용 */
export async function listActiveDdayEvents(): Promise<DdayEvent[]> {
  const { data, error } = await supabase
    .from("dday_events")
    .select("*")
    .eq("is_active", true)
    .order("order_index", { ascending: true })
    .order("target_date", { ascending: true });
  if (error) {
    console.error("[listActiveDdayEvents] 실패", error);
    return [];
  }
  return (data ?? []) as DdayEvent[];
}

/** 전체 이벤트 — 관리자 페이지용 (비활성 포함) */
export async function listAllDdayEvents(): Promise<DdayEvent[]> {
  const { data, error } = await supabase
    .from("dday_events")
    .select("*")
    .order("order_index", { ascending: true })
    .order("target_date", { ascending: true });
  if (error) {
    console.error("[listAllDdayEvents] 실패", error);
    return [];
  }
  return (data ?? []) as DdayEvent[];
}

// ── 변경 ──────────────────────────────────────────────────

export async function createDdayEvent(
  input: DdayEventInput,
  authorId: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("dday_events")
    .insert({
      title: input.title,
      target_date: input.target_date,
      description: input.description ?? null,
      is_active: input.is_active ?? true,
      order_index: input.order_index ?? 0,
      created_by: authorId,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[createDdayEvent] insert 실패", error);
    return { id: null, error: error.message };
  }
  return { id: data?.id ?? null, error: null };
}

export async function updateDdayEvent(
  id: string,
  patch: Partial<DdayEventInput>,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("dday_events")
    .update({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.target_date !== undefined ? { target_date: patch.target_date } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
      ...(patch.order_index !== undefined ? { order_index: patch.order_index } : {}),
    })
    .eq("id", id);
  if (error) {
    console.error("[updateDdayEvent] 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

export async function deleteDdayEvent(
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("dday_events").delete().eq("id", id);
  if (error) {
    console.error("[deleteDdayEvent] 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

export async function toggleDdayEventActive(
  id: string,
  next: boolean,
): Promise<{ error: string | null }> {
  return updateDdayEvent(id, { is_active: next });
}
