"use client";

// FCM 클라이언트 — 푸시 알림 토큰 등록 및 권한 요청
//
// 1) isSupported() 로 환경 지원 여부 확인 후 초기화 (SSR/구형 브라우저 안전)
// 2) getToken() 에 앞서 서비스 워커(/firebase-messaging-sw.js)를 직접 등록하여
//    Next.js 가 SW 파일을 바꿀 때도 올바른 스코프를 유지한다.
// 3) 발급된 토큰을 Supabase push_tokens 테이블에 upsert 한다.

import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { supabase } from "@/lib/supabase";

const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "moonpas.firebaseapp.com",
  projectId: "moonpas",
  storageBucket: "moonpas.firebasestorage.app",
  messagingSenderId: "87096316994",
  appId: "1:87096316994:web:c143540037e79305a349db",
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

function getApp_() {
  return getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
}

/**
 * FCM 토큰을 발급받아 push_tokens 테이블에 저장한다.
 * Notification.permission === 'granted' 인 상태에서만 호출해야 한다.
 */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    const supported = await isSupported();
    if (!supported) return;

    // 서비스 워커 등록 (이미 등록돼 있으면 재사용)
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" },
    );

    const messaging = getMessaging(getApp_());
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return;

    const deviceInfo = navigator.userAgent.slice(0, 200);
    await supabase.from("push_tokens").upsert(
      { user_id: userId, token, device_info: deviceInfo },
      { onConflict: "user_id,token", ignoreDuplicates: true },
    );
  } catch (e) {
    console.error("[FCM] 토큰 등록 실패", e);
  }
}

/**
 * 알림 권한을 요청하고 허용 시 토큰을 등록한다.
 * @returns 권한이 허용됐으면 true
 */
export async function requestPermissionAndRegister(userId: string): Promise<boolean> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;
    await registerPushToken(userId);
    return true;
  } catch (e) {
    console.error("[FCM] 권한 요청 실패", e);
    return false;
  }
}
