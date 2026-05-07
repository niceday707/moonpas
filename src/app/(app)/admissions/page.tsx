// 구 경로 호환을 위한 리다이렉트 — 정식 경로는 /admission
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/admission");
}
