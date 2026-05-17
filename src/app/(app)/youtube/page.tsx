// 문튜브(/youtube)는 문츠와 함께 "문태 미디어"(/moontube)로 통합되었다.
// 기존 URL/북마크 호환을 위해 서버단에서 즉시 리다이렉트한다.
import { redirect } from "next/navigation";

export default function YoutubeRedirect() {
  redirect("/moontube");
}
