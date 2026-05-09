// POST /api/push
//
//   FCM 푸시 알림 발송 엔드포인트.
//
//   요청 (JSON):
//     { userIds: string[], title: string, body: string, link?: string }
//
//   처리 흐름:
//     1) Authorization: Bearer <token> 으로 Supabase 사용자 인증 — 미인증 요청 거부
//     2) SUPABASE_SERVICE_ROLE_KEY 로 push_tokens 테이블 조회 (RLS 우회)
//     3) Firebase Admin SDK 로 sendEach() 호출 (최대 500건)
//     4) 만료된 토큰(registration-token-not-registered) 자동 삭제

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as admin from "firebase-admin";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const FB_SA_KEY     = process.env.FIREBASE_SERVICE_ACCOUNT_KEY ?? "";

function getAdminApp(): admin.app.App {
  if (admin.apps.length) return admin.apps[0]!;
  if (!FB_SA_KEY) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY 미설정");
  const serviceAccount = JSON.parse(FB_SA_KEY) as admin.ServiceAccount;
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1) 인증
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2) 본문 파싱
  let body: { userIds?: unknown; title?: unknown; body?: unknown; link?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const userIds = Array.isArray(body.userIds) ? (body.userIds as string[]) : [];
  const title   = typeof body.title === "string" ? body.title : "문파스";
  const bodyStr = typeof body.body  === "string" ? body.body  : "새 알림이 있습니다";
  const link    = typeof body.link  === "string" ? body.link  : "/dashboard";

  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // 3) push_tokens 조회 (service role — RLS 우회)
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY || SUPABASE_ANON);
  const { data: rows, error: dbErr } = await serviceClient
    .from("push_tokens")
    .select("id, user_id, token")
    .in("user_id", userIds);

  if (dbErr) {
    console.error("[/api/push] push_tokens 조회 실패", dbErr);
    return NextResponse.json({ ok: false, error: dbErr.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // 4) Firebase Admin 발송
  let messaging: admin.messaging.Messaging;
  try {
    messaging = admin.messaging(getAdminApp());
  } catch (e) {
    console.error("[/api/push] Firebase Admin 초기화 실패", e);
    return NextResponse.json({ ok: false, error: "firebase init failed" }, { status: 500 });
  }

  type TokenRow = { id: string; user_id: string; token: string };
  const tokenRows = rows as TokenRow[];

  // sendEach 는 최대 500 건
  const messages: admin.messaging.Message[] = tokenRows.map((r) => ({
    token: r.token,
    notification: { title, body: bodyStr },
    webpush: {
      notification: {
        title,
        body: bodyStr,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
      },
      fcmOptions: { link },
    },
  }));

  const response = await messaging.sendEach(messages);

  // 5) 만료 토큰 자동 삭제
  const expiredTokens: string[] = [];
  response.responses.forEach((r, i) => {
    if (
      !r.success &&
      r.error?.code === "messaging/registration-token-not-registered"
    ) {
      expiredTokens.push(tokenRows[i].token);
    }
  });

  if (expiredTokens.length > 0) {
    await serviceClient
      .from("push_tokens")
      .delete()
      .in("token", expiredTokens);
  }

  return NextResponse.json({
    ok: true,
    sent: response.successCount,
    failed: response.failureCount,
  });
}
