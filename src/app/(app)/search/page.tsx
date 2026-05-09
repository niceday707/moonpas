// /search?q=키워드
//
// 실시간 검색어 카드 등에서 들어오는 통합 검색 진입점.
// 현재는 자유게시판 검색 결과로 서버사이드 redirect — 검색 UI 통합 시
// 이 페이지를 실제 검색 결과 페이지로 발전시킨다.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string | string[] };
}) {
  const raw = searchParams.q;
  const q = Array.isArray(raw) ? raw[0] : raw;
  const keyword = (q ?? "").trim();
  if (!keyword) {
    redirect("/dashboard");
  }
  redirect(`/board/free?search=${encodeURIComponent(keyword)}`);
}
