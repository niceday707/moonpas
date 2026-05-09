import { Cake } from "lucide-react";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata = {
  title: "오늘의 생일 · 문파스",
};

export default function BirthdayPage() {
  return (
    <ComingSoon
      title="오늘의 생일 🎂"
      subtitle="문태 친구들의 생일을 함께 축하할 공간을 준비하고 있어요!"
      icon={Cake}
    />
  );
}
