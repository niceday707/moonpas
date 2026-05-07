"use client";

// 천천히 흐르는 보라-시안-파란 오로라 그라데이션 배경
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* 베이스 다크 톤 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#1a1230_0%,#0f0f1a_55%,#08080f_100%)]" />

      {/* 오로라 블롭들 — 각자 다른 속도로 흐름 */}
      <div
        className="aurora-blob"
        style={{
          background: "#7c3aed",
          width: "55vw",
          height: "55vw",
          top: "-10%",
          left: "-10%",
          animationDelay: "0s",
        }}
      />
      <div
        className="aurora-blob"
        style={{
          background: "#06b6d4",
          width: "50vw",
          height: "50vw",
          top: "20%",
          right: "-15%",
          animationDelay: "-6s",
          animationDuration: "22s",
        }}
      />
      <div
        className="aurora-blob"
        style={{
          background: "#3b82f6",
          width: "60vw",
          height: "60vw",
          bottom: "-25%",
          left: "20%",
          animationDelay: "-12s",
          animationDuration: "26s",
          opacity: 0.45,
        }}
      />

      {/* 노이즈 / 비네팅 — 살짝 깊이감 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}
