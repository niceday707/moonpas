"use client";

// 쌤 어디계세요? — 선생님 찾기 + 시설 배치도 통합 페이지.
// ---------------------------------------------------------------
// 탭 구성:
//   1) 선생님 찾기: 학교 대표(고정) + 검색창 + 실별 그룹 / 검색 결과 플랫 리스트
//   2) 시설 배치도: 건물 탭 + 층별 카드 그리드 + 범례
// 두 탭은 같은 컴포넌트에 머무르며 state로 전환된다(페이지 새로고침 X).
// 선생님 카드 클릭 → 시설 배치도 탭으로 이동 + 해당 층 scrollIntoView + 카드 펄스.

import { useEffect, useMemo, useState } from "react";
import { teachers, type Teacher } from "@/data/teachers";
import { buildings, type Room, type RoomType } from "@/data/facilityMap";
import { cn } from "@/lib/utils";

// ── 타입별 카드/원 색상 ─────────────────────────────────
const TYPE_CARD: Record<RoomType, string> = {
  교실: "bg-blue-50 border-blue-200",
  교무실: "bg-red-50 border-red-200",
  특별실: "bg-purple-50 border-purple-200",
  행정실: "bg-gray-50 border-gray-300",
  편의시설: "bg-green-50 border-green-200",
  기타: "bg-yellow-50 border-yellow-200",
};

const TYPE_DOT: Record<RoomType, string> = {
  교실: "bg-blue-500",
  교무실: "bg-red-500",
  특별실: "bg-purple-500",
  행정실: "bg-gray-500",
  편의시설: "bg-green-500",
  기타: "bg-yellow-500",
};

// 그룹 표시 순서 (교장실 → 교무실 → 학년실 → … → 이사장실)
// 교장실은 isSchoolHead로 분리되어 상단 카드에만 노출되므로 그룹은 비어 자동 생략됨.
const OFFICE_ORDER = [
  "교장실",
  "교무실",
  "1학년실",
  "2학년실",
  "3학년실",
  "학생인성부실",
  "성적처리실",
  "보건실",
  "상담실",
  "도서관",
  "행정실",
  "이사장실",
];

// "B동 1F" → "B", "1F"  /  "도서관 2F" → "library", "2F"  /  "별관동 2F" → "annex", "2F"
function parseOfficeLocation(loc: string): { buildingId: string; floor: string } | null {
  const m = loc.match(/^(\S+)\s+(\S+)$/);
  if (!m) return null;
  const [, buildingName, floor] = m;
  const building = buildings.find((b) => b.name === buildingName);
  if (!building) return null;
  return { buildingId: building.id, floor };
}

// 교사 → 시설맵 룸 매칭. 우선순위: room === officeRoom → name 포함 관계.
function matchRoom(teacher: Teacher, room: Room): boolean {
  if (room.room && teacher.officeRoom === room.room) return true;
  if (!room.room) {
    // 호실 코드가 없는 실은 이름으로 매칭한다.
    if (room.name === teacher.office) return true;
    if (room.name.includes(teacher.office)) return true;
    if (teacher.office.includes(room.name)) return true;
  }
  return false;
}

export default function SchoolInfoPage() {
  type TabKey = "teachers" | "facility";
  const [activeTab, setActiveTab] = useState<TabKey>("teachers");
  const [query, setQuery] = useState("");

  // 시설 배치도 상태
  const [activeBuilding, setActiveBuilding] = useState<string>("B");
  // 선생님 찾기에서 넘어왔을 때 강조할 룸 (buildingId-floor-room/name)
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  // 스크롤 타겟 층 (반영 후 한 번 사용 후 null)
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);

  // 학교 대표 / 일반 교사 분리
  const heads = teachers.filter((t) => t.isSchoolHead);
  const regulars = teachers.filter((t) => !t.isSchoolHead);

  // 검색 결과 (이름/과목 부분 일치)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return regulars.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.subject && t.subject.toLowerCase().includes(q))
    );
  }, [query, regulars]);

  // 실별 그룹화 (OFFICE_ORDER 순서대로)
  const grouped = useMemo(() => {
    return OFFICE_ORDER.map((office) => {
      const list = regulars.filter((t) => t.office === office);
      if (list.length === 0) return null;
      const sample = list[0];
      return {
        office,
        room: sample.officeRoom,
        location: sample.officeLocation,
        teachers: list,
      };
    }).filter(Boolean) as Array<{
      office: string;
      room: string;
      location: string;
      teachers: Teacher[];
    }>;
  }, [regulars]);

  // 교사 카드 클릭 → 시설 배치도로 이동
  const goToFacility = (teacher: Teacher) => {
    const parsed = parseOfficeLocation(teacher.officeLocation);
    if (!parsed) return;
    setActiveBuilding(parsed.buildingId);
    // 스크롤/하이라이트 키 (room 코드 우선, 없으면 office 이름)
    const roomKey = teacher.officeRoom || teacher.office;
    setHighlightKey(`${parsed.buildingId}-${parsed.floor}-${roomKey}`);
    setScrollTarget(`${parsed.buildingId}-${parsed.floor}`);
    setActiveTab("facility");
  };

  // 탭 전환 후 스크롤 + 펄스 효과 트리거
  useEffect(() => {
    if (activeTab !== "facility" || !scrollTarget) return;
    // 다음 프레임에서 DOM 준비 후 스크롤
    const id = requestAnimationFrame(() => {
      const el = document.getElementById(scrollTarget);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      setScrollTarget(null);
    });
    return () => cancelAnimationFrame(id);
  }, [activeTab, scrollTarget, activeBuilding]);

  // 하이라이트는 3초 후 제거
  useEffect(() => {
    if (!highlightKey) return;
    const t = setTimeout(() => setHighlightKey(null), 3000);
    return () => clearTimeout(t);
  }, [highlightKey]);

  // 시설맵 카드에서 표시할 교사 수 (해당 실 소속, isSchoolHead 제외)
  const officeTeacherCount = (room: Room) => {
    return regulars.filter((t) => matchRoom(t, room)).length;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* 페이지 제목 */}
      <h1 className="text-2xl font-bold mb-4">🏫 쌤 어디계세요?</h1>

      {/* 탭 */}
      <div className="flex gap-6 border-b mb-6">
        {([
          { key: "teachers", label: "선생님 찾기" },
          { key: "facility", label: "시설 배치도" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "pb-3 text-sm transition",
              activeTab === tab.key
                ? "border-b-2 border-indigo-600 text-indigo-600 font-semibold"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "teachers" ? (
        <TeachersTab
          heads={heads}
          query={query}
          setQuery={setQuery}
          filtered={filtered}
          grouped={grouped}
          onCardClick={goToFacility}
        />
      ) : (
        <FacilityTab
          activeBuilding={activeBuilding}
          setActiveBuilding={setActiveBuilding}
          highlightKey={highlightKey}
          countTeachers={officeTeacherCount}
        />
      )}
    </div>
  );
}

// ───────────────────────────── 선생님 찾기 탭 ─────────────────────────────

interface TeachersTabProps {
  heads: Teacher[];
  query: string;
  setQuery: (v: string) => void;
  filtered: Teacher[];
  grouped: Array<{ office: string; room: string; location: string; teachers: Teacher[] }>;
  onCardClick: (t: Teacher) => void;
}

function TeachersTab({ heads, query, setQuery, filtered, grouped, onCardClick }: TeachersTabProps) {
  return (
    <div className="space-y-6">
      {/* 학교 대표 (항상 가로 2칸) */}
      <div className="grid grid-cols-2 gap-3">
        {heads.map((t) => (
          <button
            key={t.name}
            onClick={() => onCardClick(t)}
            className="text-left bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4 hover:shadow-md transition"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
                {t.role}
              </span>
            </div>
            <div className="text-lg font-bold text-gray-900">{t.name}</div>
            <div className="text-xs text-gray-500 mt-1">
              📍 {t.office} · {t.officeLocation}
            </div>
          </button>
        ))}
      </div>

      {/* 검색창 */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="선생님 이름 또는 과목을 검색하세요"
          className="w-full pl-10 pr-4 py-3 rounded-xl border shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
        />
      </div>

      {/* 결과 */}
      {query.trim() ? (
        <SearchResults query={query} list={filtered} onCardClick={onCardClick} />
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.office}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-semibold text-gray-800">{group.office}</h2>
                <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5">
                  {group.room} · {group.location}
                </span>
                <span className="text-xs text-gray-400">{group.teachers.length}명</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.teachers.map((t) => (
                  <TeacherCard key={t.name} teacher={t} onClick={() => onCardClick(t)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResults({
  query,
  list,
  onCardClick,
}: {
  query: string;
  list: Teacher[];
  onCardClick: (t: Teacher) => void;
}) {
  if (list.length === 0) {
    return (
      <p className="text-center text-gray-400 py-12 text-sm">
        🔍 &lsquo;{query}&rsquo;에 해당하는 선생님을 찾을 수 없습니다
      </p>
    );
  }
  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">
        &lsquo;<span className="font-semibold">{query}</span>&rsquo; 검색 결과 {list.length}명
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((t) => (
          <TeacherCard key={t.name} teacher={t} onClick={() => onCardClick(t)} />
        ))}
      </div>
    </div>
  );
}

function TeacherCard({ teacher, onClick }: { teacher: Teacher; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-lg border p-3 hover:shadow-md transition"
    >
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="text-base font-bold text-gray-900">{teacher.name}</span>
        {teacher.role && (
          <span className="bg-amber-100 text-amber-700 text-xs px-1.5 rounded">
            {teacher.role}
          </span>
        )}
      </div>
      {teacher.subject && (
        <span className="inline-block bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full">
          {teacher.subject}
        </span>
      )}
      <div className="text-xs text-gray-400 mt-1">
        📍 {teacher.officeRoom} · {teacher.officeLocation}
      </div>
    </button>
  );
}

// ───────────────────────────── 시설 배치도 탭 ─────────────────────────────

interface FacilityTabProps {
  activeBuilding: string;
  setActiveBuilding: (id: string) => void;
  highlightKey: string | null;
  countTeachers: (room: Room) => number;
}

function FacilityTab({
  activeBuilding,
  setActiveBuilding,
  highlightKey,
  countTeachers,
}: FacilityTabProps) {
  const building = buildings.find((b) => b.id === activeBuilding) ?? buildings[0];

  // 최상층 → 1F 순으로 정렬 (숫자 desc)
  const sortedFloors = useMemo(() => {
    const copy = [...building.floors];
    copy.sort((a, b) => parseInt(b.floor) - parseInt(a.floor));
    return copy;
  }, [building]);

  return (
    <div className="space-y-6">
      {/* 건물 선택 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {buildings.map((b) => (
          <button
            key={b.id}
            onClick={() => setActiveBuilding(b.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm whitespace-nowrap transition",
              activeBuilding === b.id
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            {b.name}
          </button>
        ))}
      </div>

      {/* 층별 섹션 */}
      <div className="space-y-8">
        {sortedFloors.map((floor) => (
          <section key={floor.floor} id={`${building.id}-${floor.floor}`}>
            <h3 className="font-semibold text-gray-700 border-b pb-2 mb-3">
              {building.name} {floor.floor}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {floor.rooms.map((room, idx) => {
                const roomKey = room.room || room.name;
                const isHighlighted = highlightKey === `${building.id}-${floor.floor}-${roomKey}`;
                const showTeacherBadge = (room.type === "교무실" || room.name.includes("학년실"));
                const teacherCount = showTeacherBadge ? countTeachers(room) : 0;
                return (
                  <div
                    key={`${room.room}-${room.name}-${idx}`}
                    className={cn(
                      "rounded-lg border p-3 text-center relative",
                      TYPE_CARD[room.type],
                      room.highlight && "ring-2 ring-indigo-400",
                      isHighlighted && "ring-4 ring-indigo-500 animate-pulse"
                    )}
                  >
                    {room.room && (
                      <div className="text-xs text-gray-400">{room.room}</div>
                    )}
                    <div className="text-sm font-medium text-gray-800">{room.name}</div>
                    {teacherCount > 0 && (
                      <span className="absolute top-1 right-1 bg-red-100 text-red-600 text-xs rounded-full px-1.5">
                        {teacherCount}명
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-4 justify-center py-4 text-sm text-gray-500 border-t">
        {(Object.keys(TYPE_DOT) as RoomType[]).map((type) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={cn("w-2.5 h-2.5 rounded-full inline-block", TYPE_DOT[type])} />
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}
