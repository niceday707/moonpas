// 서버 컴포넌트 — lucide 아이콘 같은 forwardRef 컴포넌트는 client 로 직렬화 불가하므로
// icon prop 은 ComingSoon 의 기본값(Sparkles)을 사용한다.
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata = {
  title: "시간표 · 문파스",
};

export default function TimetablePage() {
  return (
    <ComingSoon
      title="시간표 🗓️"
      subtitle="학년·반별 시간표 기능을 준비하고 있어요. 곧 만나요!"
    />
  );
}
