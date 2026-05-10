// GET /api/admin/users
//
//   회원 관리(admin/users) 페이지 전용 — auth.users 의 email/이름을 profiles 에 머지해서 반환.
//
//   인증: Authorization: Bearer <JWT>
//     → 호출자의 profiles.role='admin' 여부를 service_role 키로 직접 확인.
//
//   응답:
//     { ok: true, users: { id, nickname, role, created_at, email, name }[] }
//
//   참고: profiles 테이블에는 email/실명 컬럼이 없다. auth.users 는 RLS 로
//        클라이언트에서 직접 조회 불가능하므로 service_role 키를 가진
//        서버 라우트가 supabase.auth.admin.listUsers() 로 페이징해 가져와 머지한다.
//        500명 규모를 가정하고 한 번에 모두 반환 — 클라이언트가 검색/페이징 처리.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

type AdminUserRow = {
  id: string;
  nickname: string;
  role: "student" | "teacher" | "parent" | "alumni" | "admin";
  created_at: string;
  email: string | null;
  name: string | null;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!SERVICE_KEY) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  // 1) Bearer 토큰 추출
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "unauthorized: Bearer 토큰 없음" },
      { status: 401 },
    );
  }

  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);

  // 2) JWT 검증
  const {
    data: { user },
    error: authError,
  } = await serviceClient.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized: JWT 무효" },
      { status: 401 },
    );
  }

  // 3) 호출자의 admin 권한 확인 (서비스 키로 RLS 우회 조회)
  const { data: meRow, error: meErr } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (meErr) {
    console.error("[/api/admin/users] role 조회 실패", meErr);
    return NextResponse.json(
      { ok: false, error: meErr.message },
      { status: 500 },
    );
  }
  if (meRow?.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "forbidden: admin 권한이 필요합니다" },
      { status: 403 },
    );
  }

  // 4) profiles 전체 조회
  const { data: profiles, error: profErr } = await serviceClient
    .from("profiles")
    .select("id, nickname, role, created_at")
    .order("created_at", { ascending: false });
  if (profErr) {
    console.error("[/api/admin/users] profiles 조회 실패", profErr);
    return NextResponse.json(
      { ok: false, error: profErr.message },
      { status: 500 },
    );
  }

  // 5) auth.users 페이징 fetch (이메일 + raw_user_meta_data)
  //    listUsers 는 기본 page=1 perPage=50. 모두 끌어올 때까지 페이징.
  const emailMap = new Map<string, { email: string | null; name: string | null }>();
  const PER_PAGE = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error) {
      console.error("[/api/admin/users] auth.users 조회 실패", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
    const users = data?.users ?? [];
    for (const u of users) {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const fullName = typeof meta.full_name === "string" ? meta.full_name : null;
      const altName = typeof meta.name === "string" ? meta.name : null;
      emailMap.set(u.id, {
        email: u.email ?? null,
        name: fullName ?? altName ?? null,
      });
    }
    // 마지막 페이지 도달 — perPage 미만이면 종료
    if (users.length < PER_PAGE) break;
  }

  // 6) 머지
  const merged: AdminUserRow[] = (profiles ?? []).map((p) => {
    const extra = emailMap.get(p.id) ?? { email: null, name: null };
    return {
      id: p.id as string,
      nickname: p.nickname as string,
      role: p.role as AdminUserRow["role"],
      created_at: p.created_at as string,
      email: extra.email,
      name: extra.name,
    };
  });

  return NextResponse.json({ ok: true, users: merged });
}
