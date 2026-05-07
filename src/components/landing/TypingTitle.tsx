"use client";

// 한 글자씩 타이핑되는 "문파스" 타이틀
// - "문" 은 기본 흰색
// - "파스" 는 그라데이션 강조 (보라 → 시안)
import { motion } from "framer-motion";

const TEXT = "문파스";
// 그라데이션을 적용할 글자의 시작 인덱스 (1 = "파스")
const GRADIENT_START = 1;

export function TypingTitle() {
  return (
    <h1
      aria-label={TEXT}
      className="text-5xl font-black tracking-tight sm:text-6xl md:text-7xl"
    >
      <span className="sr-only">{TEXT}</span>
      <span aria-hidden className="inline-flex">
        {TEXT.split("").map((ch, i) => (
          <motion.span
            key={`${ch}-${i}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.18 + i * 0.07,
              duration: 0.35,
              ease: "easeOut",
            }}
            className={i >= GRADIENT_START ? "text-gradient" : "text-white"}
          >
            {ch}
          </motion.span>
        ))}
        {/* 깜빡이는 커서 */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{
            delay: 0.18 + TEXT.length * 0.07,
            duration: 1.0,
            repeat: Infinity,
            ease: "linear",
          }}
          className="ml-1 inline-block h-[1em] w-[3px] translate-y-1 rounded-sm bg-cyan-accent align-middle"
        />
      </span>
    </h1>
  );
}
