// 서버 컴포넌트 — lucide 아이콘 같은 forwardRef 컴포넌트는 client 로 직렬화 불가하므로
// icon prop 은 ComingSoon 의 기본값(Sparkles)을 사용한다.
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata = {
  title: "오늘의 생일 · 문파스",
};

export default function BirthdayPage() {
  return (
    <ComingSoon
      title="오늘의 생일 🎂"
      subtitle="문태 친구들의 생일을 함께 축하할 공간을 준비하고 있어요!"
    />
  );
}
