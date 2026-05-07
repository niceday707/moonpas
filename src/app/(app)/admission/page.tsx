"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  X,
  Search,
  ExternalLink,
  ArrowRight,
  GraduationCap,
  Plus,
  FileText,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Building2,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

// ─── 1. 핵심 변화 5가지 ────────────────────────────────────────────────────────

type CoreChange = {
  id: number;
  emoji: string;
  title: string;
  summary: string;
  detail: string;
  color: string;
};

const CORE_CHANGES: CoreChange[] = [
  {
    id: 1,
    emoji: "📝",
    title: "통합형 수능",
    summary: "선택과목 폐지, 전 학생 동일 시험",
    color: "#7c3aed",
    detail:
      "2028학년도부터 모든 수험생이 동일한 시험 범위로 응시합니다. 사회탐구·과학탐구의 선택과목이 사라지고 통합사회·통합과학이 필수화됩니다. '심화수학'이 신설되어 이공계 지망생의 수학 심화 학습이 더욱 중요해집니다. 선택과목 간 유불리 논란이 해소되고, 고교학점제와 연계된 다양한 진로 과목 이수가 평가에 반영됩니다.",
  },
  {
    id: 2,
    emoji: "📊",
    title: "내신 5등급제",
    summary: "9등급→5등급, 상위 10% A등급",
    color: "#06b6d4",
    detail:
      "기존 9등급 상대평가에서 5등급제로 전환됩니다. A(상위 10%), B(다음 24%), C(다음 32%), D(다음 24%), E(하위 10%) 구조로 변경됩니다. 절대평가 방식의 성취평가제가 병행 도입되어 내신 경쟁 압박이 완화됩니다. 단, 상위 대학 지원 시 A등급 내 세부 변별을 위해 대학별 서류·면접 비중이 높아질 수 있습니다.",
  },
  {
    id: 3,
    emoji: "📈",
    title: "수시 비중 확대",
    summary: "학생부위주 전형 증가",
    color: "#10b981",
    detail:
      "대학들이 수시 학생부종합전형·학생부교과전형 비중을 지속적으로 늘리는 추세입니다. 3년간의 학교생활 전반(교과, 세특, 비교과)이 중요해집니다. 특히 세부능력특기사항(세특) 기재가 핵심 경쟁력으로, 수업 중 깊이 있는 탐구 활동과 이를 연결하는 자기주도적 학습 기록이 당락을 결정할 수 있습니다.",
  },
  {
    id: 4,
    emoji: "📋",
    title: "정시 학생부 반영",
    summary: "정시에서도 학생부 중요",
    color: "#f59e0b",
    detail:
      "기존 정시는 순수 수능 점수만으로 선발했지만, 2028학년도부터 일부 대학에서 정시에도 학생부(내신)를 일정 비율 반영합니다. '수능=정시'라는 공식이 깨지며, 수시·정시 모두 내신 관리가 필수입니다. 정시에서 학생부를 반영하는 비율과 반영 방식은 대학별로 상이하므로 지망 대학의 모집 요강을 꼭 확인해야 합니다.",
  },
  {
    id: 5,
    emoji: "🎯",
    title: "대학별 권장과목",
    summary: "전공 연계 과목 이수 필수",
    color: "#ec4899",
    detail:
      "각 대학과 모집단위(학과)별로 '권장과목'을 지정합니다. 해당 과목을 이수하지 않으면 입학 후 교육과정 이수에 불이익이 있거나 전형에서 감점될 수 있습니다. 공대 지망생은 미적분Ⅱ·기하·물리학Ⅱ 이수가 강력히 권장되고, 의대·약대는 화학Ⅱ·생명과학Ⅱ까지 필요합니다. 1학년 때부터 진로를 고려해 과목을 선택해야 합니다.",
  },
];

// ─── 2. 대학별 정보 ────────────────────────────────────────────────────────────

type UnivCategory = "서울권" | "수도권" | "지방국립대" | "의약계열";

type University = {
  id: number;
  name: string;
  initials: string;
  color: string;
  category: UnivCategory;
  susi: number;
  jeongsi: number;
  majors: string[];
  recommended: string[];
};

const UNIVERSITIES: University[] = [
  { id: 1, name: "서울대학교", initials: "서울", color: "#0057b8", category: "서울권", susi: 80, jeongsi: 20, majors: ["일반전형 (학종)", "지역균형 (교과)"], recommended: ["미적분Ⅱ", "기하", "물리학Ⅱ", "화학Ⅱ"] },
  { id: 2, name: "연세대학교", initials: "연세", color: "#002d72", category: "서울권", susi: 63, jeongsi: 37, majors: ["활동우수형 (학종)", "추천형 (교과)", "논술전형"], recommended: ["미적분Ⅱ", "기하", "화학Ⅱ"] },
  { id: 3, name: "고려대학교", initials: "고려", color: "#981b1b", category: "서울권", susi: 65, jeongsi: 35, majors: ["학업우수형 (학종)", "계열적합형 (학종)", "논술전형"], recommended: ["미적분Ⅱ", "물리학Ⅱ"] },
  { id: 4, name: "성균관대학교", initials: "성균관", color: "#1a6b00", category: "서울권", susi: 58, jeongsi: 42, majors: ["탐구형 (학종)", "기회균형 (학종)", "논술전형"], recommended: ["미적분Ⅱ", "화학Ⅱ", "생명과학Ⅱ"] },
  { id: 5, name: "한양대학교", initials: "한양", color: "#cc0000", category: "서울권", susi: 70, jeongsi: 30, majors: ["일반전형 (학종)", "지역균형 (교과)"], recommended: ["미적분Ⅱ", "물리학Ⅱ"] },
  { id: 6, name: "서강대학교", initials: "서강", color: "#0e4fab", category: "서울권", susi: 60, jeongsi: 40, majors: ["종합형 (학종)", "교과우수자 (교과)"], recommended: ["미적분Ⅱ", "기하"] },
  { id: 7, name: "이화여자대학교", initials: "이화", color: "#8b0000", category: "서울권", susi: 65, jeongsi: 35, majors: ["미래인재 (학종)", "고교추천 (교과)", "논술전형"], recommended: ["미적분Ⅱ", "화학Ⅱ"] },
  { id: 8, name: "중앙대학교", initials: "중앙", color: "#003f87", category: "서울권", susi: 62, jeongsi: 38, majors: ["다빈치형 (학종)", "탐구형 (학종)", "논술전형"], recommended: ["미적분Ⅱ"] },
  { id: 9, name: "경희대학교", initials: "경희", color: "#6d4b99", category: "서울권", susi: 64, jeongsi: 36, majors: ["네오르네상스 (학종)", "고교연계 (교과)", "논술전형"], recommended: ["미적분Ⅱ", "생명과학Ⅱ"] },
  { id: 10, name: "한국외국어대학교", initials: "외대", color: "#005fa3", category: "서울권", susi: 67, jeongsi: 33, majors: ["학생부종합 (학종)", "학생부교과 (교과)"], recommended: ["제2외국어", "세계사"] },
  { id: 11, name: "인하대학교", initials: "인하", color: "#1a5276", category: "수도권", susi: 58, jeongsi: 42, majors: ["인하미래인재 (학종)", "학교장추천 (교과)"], recommended: ["미적분Ⅱ", "물리학Ⅱ"] },
  { id: 12, name: "아주대학교", initials: "아주", color: "#003087", category: "수도권", susi: 60, jeongsi: 40, majors: ["ACE전형 (학종)", "학교추천 (교과)"], recommended: ["미적분Ⅱ", "화학Ⅱ"] },
  { id: 13, name: "단국대학교", initials: "단국", color: "#005c99", category: "수도권", susi: 65, jeongsi: 35, majors: ["DKU인재 (학종)", "학생부교과 (교과)"], recommended: ["미적분Ⅱ"] },
  { id: 14, name: "경기대학교", initials: "경기", color: "#7c3aed", category: "수도권", susi: 70, jeongsi: 30, majors: ["KGU학생부종합 (학종)", "교과성적우수자 (교과)"], recommended: ["사회·문화"] },
  { id: 15, name: "부산대학교", initials: "부산", color: "#cc7000", category: "지방국립대", susi: 65, jeongsi: 35, majors: ["학생부종합 (학종)", "지역인재 (교과)"], recommended: ["미적분Ⅱ", "화학Ⅱ"] },
  { id: 16, name: "경북대학교", initials: "경북", color: "#003399", category: "지방국립대", susi: 62, jeongsi: 38, majors: ["일반학생 (학종)", "지역인재 (교과)"], recommended: ["미적분Ⅱ", "물리학Ⅱ"] },
  { id: 17, name: "전남대학교", initials: "전남", color: "#006600", category: "지방국립대", susi: 68, jeongsi: 32, majors: ["고교생활우수자 (학종)", "지역인재 (교과)"], recommended: ["미적분Ⅱ", "생명과학Ⅱ"] },
  { id: 18, name: "충남대학교", initials: "충남", color: "#990066", category: "지방국립대", susi: 65, jeongsi: 35, majors: ["PRISM인재 (학종)", "지역인재 (교과)"], recommended: ["미적분Ⅱ", "화학Ⅱ"] },
  { id: 19, name: "강원대학교", initials: "강원", color: "#005c3a", category: "지방국립대", susi: 63, jeongsi: 37, majors: ["미래인재 (학종)", "지역인재 (교과)"], recommended: ["미적분Ⅱ"] },
  { id: 20, name: "가톨릭대 의대", initials: "가톨릭", color: "#b30000", category: "의약계열", susi: 75, jeongsi: 25, majors: ["학교장추천 (교과)", "가톨릭지도자추천 (학종)"], recommended: ["미적분Ⅱ", "기하", "화학Ⅱ", "생명과학Ⅱ"] },
  { id: 21, name: "연세대 의대", initials: "연세의", color: "#002d72", category: "의약계열", susi: 60, jeongsi: 40, majors: ["활동우수형 (학종)", "추천형 (교과)"], recommended: ["미적분Ⅱ", "기하", "물리학Ⅱ", "화학Ⅱ", "생명과학Ⅱ"] },
  { id: 22, name: "성균관대 약학", initials: "성균약", color: "#1a6b00", category: "의약계열", susi: 55, jeongsi: 45, majors: ["탐구형 (학종)", "논술전형"], recommended: ["미적분Ⅱ", "화학Ⅱ", "생명과학Ⅱ"] },
  { id: 23, name: "전남대 의대", initials: "전남의", color: "#006600", category: "의약계열", susi: 70, jeongsi: 30, majors: ["고교생활우수자 (학종)", "지역인재 (교과)"], recommended: ["미적분Ⅱ", "화학Ⅱ", "생명과학Ⅱ"] },
];

// ─── 3. 과목 추천 데이터 ───────────────────────────────────────────────────────

type Stream = "인문" | "자연" | "예체능" | "의약";

type MajorPath = {
  name: string;
  general: string[];
  advanced: string[];
  fusion: string[];
};

const STREAM_MAJORS: Record<Stream, MajorPath[]> = {
  인문: [
    { name: "경영·경제학", general: ["대수", "미적분Ⅰ", "확률과 통계", "사회·문화"], advanced: ["경제수학", "정치와 법"], fusion: ["실용 통계", "인문학과 경제"] },
    { name: "사회·역사학", general: ["세계사", "사회·문화", "정치와 법", "한국지리"], advanced: ["역사로 탐구하는 현대세계", "윤리와 사상"], fusion: ["사회문제 탐구"] },
    { name: "국어국문학", general: ["화법과 언어", "독서와 작문", "문학"], advanced: ["주제탐구 독서", "문학과 영상"], fusion: ["독서 토론과 글쓰기"] },
    { name: "심리학", general: ["사회·문화", "생명과학Ⅰ", "확률과 통계"], advanced: ["인간과 철학", "정치와 법"], fusion: ["사회문제 탐구"] },
    { name: "법학", general: ["정치와 법", "사회·문화", "한국지리"], advanced: ["현대사회와 윤리", "역사로 탐구하는 현대세계"], fusion: ["사회문제 탐구"] },
  ],
  자연: [
    { name: "컴퓨터·SW공학", general: ["대수", "미적분Ⅰ", "정보", "물리학Ⅰ"], advanced: ["미적분Ⅱ", "인공지능 수학", "정보과학"], fusion: ["데이터 과학"] },
    { name: "기계공학", general: ["대수", "미적분Ⅰ", "물리학Ⅰ", "화학Ⅰ"], advanced: ["미적분Ⅱ", "기하", "물리학Ⅱ"], fusion: ["공학 수학"] },
    { name: "전기·전자공학", general: ["대수", "미적분Ⅰ", "물리학Ⅰ", "정보"], advanced: ["미적분Ⅱ", "기하", "물리학Ⅱ", "인공지능 수학"], fusion: ["공학 수학", "전자기와 양자"] },
    { name: "화학공학", general: ["대수", "미적분Ⅰ", "화학Ⅰ", "물리학Ⅰ"], advanced: ["미적분Ⅱ", "화학Ⅱ", "물리학Ⅱ"], fusion: ["화학반응의 세계"] },
    { name: "수학·통계학", general: ["대수", "미적분Ⅰ", "확률과 통계", "기하"], advanced: ["미적분Ⅱ", "기하", "인공지능 수학"], fusion: ["실용 통계", "수학과 문화"] },
  ],
  예체능: [
    { name: "음악학", general: ["음악", "음악 감상과 비평"], advanced: ["음악 연주와 창작"], fusion: ["음악과 미디어"] },
    { name: "미술·디자인", general: ["미술", "미술 감상과 비평", "정보"], advanced: ["미술 창작"], fusion: ["미술과 매체"] },
    { name: "체육학", general: ["체육", "스포츠 생활Ⅰ", "생명과학Ⅰ"], advanced: ["스포츠 생활Ⅱ", "운동과 건강"], fusion: ["스포츠 과학"] },
    { name: "영화·영상학", general: ["미술", "문학", "정보"], advanced: ["문학과 영상", "미술 창작"], fusion: ["미술과 매체", "음악과 미디어"] },
  ],
  의약: [
    { name: "의학", general: ["대수", "미적분Ⅰ", "화학Ⅰ", "생명과학Ⅰ", "물리학Ⅰ"], advanced: ["미적분Ⅱ", "기하", "물리학Ⅱ", "화학Ⅱ", "생명과학Ⅱ"], fusion: ["세포와 물질대사", "생명과학과 인류문명"] },
    { name: "치의학", general: ["대수", "미적분Ⅰ", "화학Ⅰ", "생명과학Ⅰ"], advanced: ["미적분Ⅱ", "화학Ⅱ", "생명과학Ⅱ"], fusion: ["세포와 물질대사"] },
    { name: "약학", general: ["대수", "미적분Ⅰ", "화학Ⅰ", "생명과학Ⅰ"], advanced: ["미적분Ⅱ", "화학Ⅱ", "생명과학Ⅱ"], fusion: ["화학반응의 세계", "세포와 물질대사"] },
    { name: "간호학", general: ["대수", "화학Ⅰ", "생명과학Ⅰ", "사회·문화"], advanced: ["생명과학Ⅱ", "화학Ⅱ"], fusion: ["세포와 물질대사"] },
  ],
};

const STREAM_META: Record<Stream, { emoji: string; color: string }> = {
  인문: { emoji: "📚", color: "#06b6d4" },
  자연: { emoji: "🔬", color: "#7c3aed" },
  예체능: { emoji: "🎨", color: "#ec4899" },
  의약: { emoji: "🏥", color: "#10b981" },
};

// ─── 4. 교사 브리핑 ────────────────────────────────────────────────────────────

type Briefing = {
  id: number;
  title: string;
  author: string;
  date: string;
  content: string;
  tags: string[];
};

const INITIAL_BRIEFINGS: Briefing[] = [
  {
    id: 1,
    title: "2028 수능 변경 핵심 사항 정리",
    author: "진로진학부",
    date: "2026-05-01",
    content:
      "2028학년도부터 수능 선택과목이 폐지되고 통합형으로 전환됩니다. 통합사회·통합과학 필수화, 심화수학 신설이 주요 변경사항입니다. 재학생들에게 1학년부터 과목 선택 전략을 세울 수 있도록 적극 안내 바랍니다.",
    tags: ["수능변경", "통합형수능", "심화수학"],
  },
  {
    id: 2,
    title: "대입 설명회 일정 안내 (학부모 대상)",
    author: "교무부",
    date: "2026-04-25",
    content:
      "5월 20일(수) 오후 7시, 학교 강당에서 2028 대입 설명회를 개최합니다. 학부모 및 3학년 학생은 필참 바랍니다. 진로진학 담당 교사가 직접 설명드릴 예정입니다.",
    tags: ["설명회", "학부모", "3학년"],
  },
  {
    id: 3,
    title: "4월 모의고사 성적 분석 자료",
    author: "3학년부",
    date: "2026-04-18",
    content:
      "4월 모의고사 성적 분석 결과를 공유합니다. 전반적으로 수학 영역 성취도가 향상되었으나, 통합사회 영역 대비가 부족한 학생이 다수 확인되었습니다. 담임 선생님께서 개별 상담 시 활용해 주시기 바랍니다.",
    tags: ["모의고사", "성적분석", "통합사회"],
  },
];

// ─── 애니메이션 ────────────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

const UNIV_CATEGORIES: ("전체" | UnivCategory)[] = [
  "전체",
  "서울권",
  "수도권",
  "지방국립대",
  "의약계열",
];

// ─── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function AdmissionPage() {
  // 모달
  const [selectedChange, setSelectedChange] = useState<CoreChange | null>(null);
  const [selectedUniv, setSelectedUniv] = useState<University | null>(null);
  const [selectedBriefing, setSelectedBriefing] = useState<Briefing | null>(null);

  // 대학 검색·필터
  const [univSearch, setUnivSearch] = useState("");
  const [univFilter, setUnivFilter] = useState<"전체" | UnivCategory>("전체");

  // 과목 추천 스텝
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [selectedMajor, setSelectedMajor] = useState<MajorPath | null>(null);

  // 교사 브리핑
  const [briefings, setBriefings] = useState<Briefing[]>(INITIAL_BRIEFINGS);
  const [showBriefingForm, setShowBriefingForm] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false); // TODO: 실제 Supabase auth 연동
  const [briefingForm, setBriefingForm] = useState({ title: "", content: "", tags: "" });

  const filteredUnivs = useMemo(
    () =>
      UNIVERSITIES.filter(
        (u) =>
          u.name.includes(univSearch) &&
          (univFilter === "전체" || u.category === univFilter),
      ),
    [univSearch, univFilter],
  );

  const submitBriefing = () => {
    if (!briefingForm.title.trim() || !briefingForm.content.trim()) return;
    const tags = briefingForm.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setBriefings((prev) => [
      {
        id: Date.now(),
        title: briefingForm.title,
        author: "선생님",
        date: new Date().toISOString().slice(0, 10),
        content: briefingForm.content,
        tags,
      },
      ...prev,
    ]);
    setBriefingForm({ title: "", content: "", tags: "" });
    setShowBriefingForm(false);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-16">
      {/* ── 섹션 1: 히어로 + 핵심 변화 카드 ─────────────────────── */}
      <motion.section variants={containerVariants} initial="hidden" animate="show">
        <motion.div variants={itemVariants} className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent ring-1 ring-accent/25">
            <GraduationCap className="h-4 w-4" />
            2028 대입 정보 센터
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
            <span className="text-gradient">2028 대입</span>,<br />
            이것만 알면 된다
          </h1>
          <p className="mt-4 text-base text-foreground/60 md:text-lg">
            핵심 변화 5가지를 클릭해서 자세히 알아보세요
          </p>
        </motion.div>

        {/* 가로 스크롤 카드 5개 */}
        <div className="flex gap-4 overflow-x-auto pb-3">
          {CORE_CHANGES.map((change) => (
            <motion.button
              key={change.id}
              variants={itemVariants}
              onClick={() => setSelectedChange(change)}
              className="flex min-w-[200px] flex-col gap-3 rounded-2xl p-5 text-left transition-all"
              style={{
                background: `linear-gradient(135deg, ${change.color}20 0%, ${change.color}08 100%)`,
                border: `1px solid ${change.color}30`,
              }}
              whileHover={{
                y: -5,
                boxShadow: `0 14px 38px ${change.color}30`,
                transition: { type: "spring", stiffness: 300, damping: 22 },
              }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="text-3xl">{change.emoji}</span>
              <div>
                <p className="font-bold" style={{ color: change.color }}>
                  {change.title}
                </p>
                <p className="mt-0.5 text-xs text-foreground/60">{change.summary}</p>
              </div>
              <div
                className="mt-auto flex items-center gap-1 text-xs"
                style={{ color: change.color }}
              >
                자세히 보기 <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </motion.button>
          ))}
        </div>
      </motion.section>

      {/* ── 섹션 2: 대학별 입시 정보 ──────────────────────────────── */}
      <section>
        <div className="mb-5 flex items-center gap-3">
          <Building2 className="h-5 w-5 text-cyan-accent" />
          <h2 className="text-xl font-bold">대학별 입시 정보</h2>
        </div>

        {/* 검색 + 필터 */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <input
              value={univSearch}
              onChange={(e) => setUnivSearch(e.target.value)}
              placeholder="대학명으로 검색..."
              className="w-full rounded-2xl bg-foreground/5 py-2.5 pl-9 pr-4 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-accent/50"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {UNIV_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setUnivFilter(cat)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                  univFilter === cat
                    ? "bg-accent text-white"
                    : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 대학 카드 그리드 */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredUnivs.map((univ) => (
              <motion.button
                key={univ.id}
                variants={itemVariants}
                layout
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                onClick={() => setSelectedUniv(univ)}
                className="glass flex flex-col gap-3 rounded-2xl p-4 text-left transition-all"
                whileHover={{
                  y: -4,
                  boxShadow: `0 10px 32px ${univ.color}28`,
                  transition: { type: "spring", stiffness: 300, damping: 22 },
                }}
                whileTap={{ scale: 0.97 }}
              >
                <div
                  className="grid h-11 w-11 place-items-center rounded-xl text-xs font-bold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${univ.color} 0%, ${univ.color}bb 100%)`,
                  }}
                >
                  {univ.initials.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-bold leading-snug">{univ.name}</p>
                  <span
                    className={cn(
                      "mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                      univ.category === "서울권" && "bg-accent/10 text-accent",
                      univ.category === "수도권" && "bg-cyan-accent/10 text-cyan-accent",
                      univ.category === "지방국립대" && "bg-success/10 text-success",
                      univ.category === "의약계열" && "bg-warning/10 text-warning",
                    )}
                  >
                    {univ.category}
                  </span>
                </div>
                <div className="mt-auto w-full">
                  <div className="mb-1 flex justify-between text-[11px] text-foreground/45">
                    <span>수시 {univ.susi}%</span>
                    <span>정시 {univ.jeongsi}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-cyan-accent"
                      style={{ width: `${univ.susi}%` }}
                    />
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>

        {filteredUnivs.length === 0 && (
          <div className="py-14 text-center text-sm text-foreground/40">
            검색 결과가 없습니다.
          </div>
        )}
      </section>

      {/* ── 섹션 3: 과목 추천 도구 ─────────────────────────────────── */}
      <section>
        <div className="mb-5 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-accent" />
          <h2 className="text-xl font-bold">나의 진로에 맞는 과목 찾기</h2>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="mb-5 flex items-center gap-2">
          {([1, 2, 3] as const).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all",
                  step >= s ? "bg-accent text-white" : "bg-foreground/10 text-foreground/40",
                )}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={cn(
                    "h-px w-8 transition-all",
                    step > s ? "bg-accent" : "bg-foreground/15",
                  )}
                />
              )}
            </div>
          ))}
          <span className="ml-2 text-sm text-foreground/50">
            {step === 1 ? "계열 선택" : step === 2 ? "관심 학과 선택" : "권장 이수 과목"}
          </span>
        </div>

        <GlassCard interactive={false} className="ring-1 ring-white/10">
          <AnimatePresence mode="wait">
            {/* 스텝 1: 계열 선택 */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.22 }}
              >
                <p className="mb-4 font-bold text-foreground/80">
                  Step 1. 희망 계열을 선택하세요
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(Object.keys(STREAM_META) as Stream[]).map((stream) => {
                    const meta = STREAM_META[stream];
                    return (
                      <motion.button
                        key={stream}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          setSelectedStream(stream);
                          setSelectedMajor(null);
                          setStep(2);
                        }}
                        className="flex flex-col items-center gap-2 rounded-2xl py-5 text-sm font-semibold transition-all"
                        style={{
                          background: `linear-gradient(135deg, ${meta.color}18 0%, ${meta.color}08 100%)`,
                          border: `1px solid ${meta.color}30`,
                          color: meta.color,
                        }}
                      >
                        <span className="text-2xl">{meta.emoji}</span>
                        {stream}계열
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* 스텝 2: 학과 선택 */}
            {step === 2 && selectedStream && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.22 }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-bold text-foreground/80">
                    Step 2. 관심 학과를 선택하세요
                  </p>
                  <button
                    onClick={() => {
                      setStep(1);
                      setSelectedStream(null);
                    }}
                    className="text-xs text-foreground/40 hover:text-foreground/70"
                  >
                    ← 계열 다시 선택
                  </button>
                </div>
                <div className="relative mb-4">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const found = STREAM_MAJORS[selectedStream].find(
                        (m) => m.name === e.target.value,
                      );
                      setSelectedMajor(found ?? null);
                    }}
                    className="w-full appearance-none rounded-2xl bg-foreground/5 px-4 py-3 text-sm outline-none ring-1 ring-white/10 focus:ring-accent/50"
                  >
                    <option value="" disabled>
                      학과를 선택하세요
                    </option>
                    {STREAM_MAJORS[selectedStream].map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                </div>
                <Button
                  onClick={() => selectedMajor && setStep(3)}
                  disabled={!selectedMajor}
                  className="w-full"
                >
                  결과 보기 <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            )}

            {/* 스텝 3: 결과 플로차트 */}
            {step === 3 && selectedMajor && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.22 }}
              >
                <div className="mb-5 flex items-center justify-between">
                  <p className="font-bold">
                    <span className="text-gradient">{selectedMajor.name}</span> 권장 이수 과목
                  </p>
                  <button
                    onClick={() => {
                      setStep(1);
                      setSelectedStream(null);
                      setSelectedMajor(null);
                    }}
                    className="text-xs text-foreground/40 hover:text-foreground/70"
                  >
                    처음으로
                  </button>
                </div>

                {/* 플로차트: 일반선택 → 진로선택 → 융합선택 */}
                <div className="flex flex-col gap-3 md:flex-row md:items-start">
                  {[
                    { label: "일반선택", color: "#06b6d4", subjects: selectedMajor.general },
                    { label: "진로선택", color: "#7c3aed", subjects: selectedMajor.advanced },
                    { label: "융합선택", color: "#10b981", subjects: selectedMajor.fusion },
                  ].map((col, idx) => (
                    <div
                      key={col.label}
                      className="flex items-center gap-3 md:flex-col md:items-stretch"
                    >
                      <div
                        className="flex min-w-[150px] flex-1 flex-col gap-2 rounded-2xl p-4 md:flex-none"
                        style={{
                          background: `${col.color}12`,
                          border: `1px solid ${col.color}25`,
                        }}
                      >
                        <p className="text-xs font-bold" style={{ color: col.color }}>
                          {col.label}
                        </p>
                        {col.subjects.map((s) => (
                          <span
                            key={s}
                            className="rounded-xl px-2.5 py-1.5 text-xs font-medium text-foreground/80"
                            style={{ background: `${col.color}1a` }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      {idx < 2 && (
                        <ArrowRight className="h-5 w-5 shrink-0 text-foreground/25 md:rotate-90 md:self-center" />
                      )}
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-xs text-foreground/35">
                  * 2028 고교학점제 권장 이수 체계를 기반으로 작성된 가이드입니다. 실제 대학별
                  요강을 반드시 확인하세요.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </section>

      {/* ── 섹션 4: 교사 입시 브리핑 게시판 ──────────────────────── */}
      <section>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-warning" />
            <h2 className="text-xl font-bold">입시 브리핑</h2>
            <span className="rounded-full bg-role-teacher/10 px-2.5 py-0.5 text-xs font-semibold text-role-teacher ring-1 ring-role-teacher/25">
              교사 전용 작성
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 개발 중 모드 토글 — Supabase auth 연동 후 제거 */}
            <button
              onClick={() => setIsTeacher((v) => !v)}
              className="text-[11px] text-foreground/25 hover:text-foreground/45"
            >
              {isTeacher ? "[교사 모드]" : "[학생 모드]"}
            </button>
            <AnimatePresence>
              {isTeacher && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowBriefingForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-role-teacher/12 px-3 py-2 text-xs font-semibold text-role-teacher ring-1 ring-role-teacher/30 transition-all hover:bg-role-teacher/22"
                >
                  {showBriefingForm ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {showBriefingForm ? "닫기" : "브리핑 작성"}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 브리핑 작성 폼 */}
        <AnimatePresence>
          {showBriefingForm && isTeacher && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="mb-4 overflow-hidden"
            >
              <GlassCard interactive={false} className="ring-1 ring-role-teacher/25">
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-bold text-role-teacher">입시 브리핑 작성</p>
                  <input
                    value={briefingForm.title}
                    onChange={(e) => setBriefingForm((v) => ({ ...v, title: e.target.value }))}
                    placeholder="제목"
                    className="w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-role-teacher/40"
                  />
                  <textarea
                    value={briefingForm.content}
                    onChange={(e) =>
                      setBriefingForm((v) => ({ ...v, content: e.target.value }))
                    }
                    placeholder="내용을 입력하세요..."
                    rows={4}
                    className="w-full resize-none rounded-xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-role-teacher/40"
                  />
                  <input
                    value={briefingForm.tags}
                    onChange={(e) => setBriefingForm((v) => ({ ...v, tags: e.target.value }))}
                    placeholder="태그 (쉼표로 구분, 예: 수능변경, 설명회)"
                    className="w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-role-teacher/40"
                  />
                  <button
                    onClick={submitBriefing}
                    className="w-full rounded-xl bg-role-teacher py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    게시하기
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 브리핑 목록 */}
        <motion.ul
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-3"
        >
          {briefings.map((b) => (
            <motion.li key={b.id} variants={itemVariants}>
              <GlassCard onClick={() => setSelectedBriefing(b)} className="cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{b.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-foreground/60">{b.content}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge role="teacher" />
                      <span className="text-xs text-foreground/50">
                        {b.author} · {b.date}
                      </span>
                      {b.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] text-foreground/50"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-foreground/30" />
                </div>
              </GlassCard>
            </motion.li>
          ))}
        </motion.ul>
      </section>

      {/* ── 섹션 5: 대교협 외부 링크 ──────────────────────────────── */}
      <section>
        <GlassCard
          interactive={false}
          className="flex flex-col items-center gap-4 sm:flex-row sm:text-left"
          style={{
            background:
              "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(6,182,212,0.08) 100%)",
          }}
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/15">
            <ExternalLink className="h-6 w-6 text-accent" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="font-bold">대교협 대입정보포털 (adiga.kr)</p>
            <p className="mt-0.5 text-sm text-foreground/60">
              공식 수시·정시 모집 요강, 대학별 입시 일정, 입학처 연결 정보를 확인하세요.
            </p>
          </div>
          <a
            href="https://adiga.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)] transition-opacity hover:opacity-90"
          >
            바로가기 <ExternalLink className="h-4 w-4" />
          </a>
        </GlassCard>
      </section>

      {/* ── 모달: 핵심 변화 상세 ──────────────────────────────────── */}
      <AnimatePresence>
        {selectedChange && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedChange(null)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="glass relative w-full max-w-md rounded-3xl p-6"
            >
              <button
                onClick={() => setSelectedChange(null)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground/50 transition-colors hover:bg-foreground/20"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mb-4 flex items-center gap-3">
                <span className="text-4xl">{selectedChange.emoji}</span>
                <div>
                  <p className="text-lg font-bold" style={{ color: selectedChange.color }}>
                    {selectedChange.title}
                  </p>
                  <p className="text-sm text-foreground/55">{selectedChange.summary}</p>
                </div>
              </div>
              <p className="leading-relaxed text-foreground/75">{selectedChange.detail}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 모달: 대학 상세 ────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedUniv && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedUniv(null)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="glass relative w-full max-w-md rounded-3xl p-6"
            >
              <button
                onClick={() => setSelectedUniv(null)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground/50 transition-colors hover:bg-foreground/20"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-5 flex items-center gap-4">
                <div
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-sm font-bold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${selectedUniv.color} 0%, ${selectedUniv.color}bb 100%)`,
                  }}
                >
                  {selectedUniv.initials.slice(0, 2)}
                </div>
                <div>
                  <p className="text-lg font-bold leading-snug">{selectedUniv.name}</p>
                  <span className="text-sm text-foreground/55">{selectedUniv.category}</span>
                </div>
              </div>

              {/* 수시/정시 비율 */}
              <div className="mb-5 rounded-2xl bg-foreground/5 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  수시 / 정시 비율
                </p>
                <div className="mb-2 flex justify-between text-sm font-bold">
                  <span className="text-accent">수시 {selectedUniv.susi}%</span>
                  <span className="text-cyan-accent">정시 {selectedUniv.jeongsi}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-cyan-accent"
                    style={{ width: `${selectedUniv.susi}%` }}
                  />
                </div>
              </div>

              {/* 주요 전형 */}
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  주요 전형
                </p>
                <ul className="flex flex-col gap-1.5">
                  {selectedUniv.majors.map((m) => (
                    <li key={m} className="flex items-center gap-2 text-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 권장 이수 과목 */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  권장 이수 과목
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedUniv.recommended.map((r) => (
                    <span
                      key={r}
                      className="rounded-xl bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 모달: 브리핑 상세 ──────────────────────────────────────── */}
      <AnimatePresence>
        {selectedBriefing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedBriefing(null)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="glass relative w-full max-w-md rounded-3xl p-6"
            >
              <button
                onClick={() => setSelectedBriefing(null)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground/50 transition-colors hover:bg-foreground/20"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mb-1 flex items-center gap-2">
                <Badge role="teacher" />
                <span className="text-xs text-foreground/50">
                  {selectedBriefing.author} · {selectedBriefing.date}
                </span>
              </div>
              <h3 className="mb-3 mt-2 text-lg font-bold">{selectedBriefing.title}</h3>
              <p className="leading-relaxed text-foreground/75">{selectedBriefing.content}</p>
              {selectedBriefing.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedBriefing.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-foreground/5 px-2.5 py-1 text-xs text-foreground/50"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
