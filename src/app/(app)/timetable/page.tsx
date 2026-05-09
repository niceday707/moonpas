import { CalendarDays } from "lucide-react";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata = {
  title: "시간표 · 문파스",
};

export default function TimetablePage() {
  return (
    <ComingSoon
      title="시간표"
      subtitle="학년·반별 시간표 기능을 준비하고 있어요. 곧 만나요!"
      icon={CalendarDays}
    />
  );
}
