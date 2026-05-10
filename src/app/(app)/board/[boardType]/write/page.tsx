"use client";

// 글 쓰기 / 수정 — /board/[boardType]/write?id=xxx (id 있으면 수정 모드)
// 본체는 ./WriteShell.tsx 에 있으며, /board/challenge/write 라우트도 같은 컴포넌트를 공유한다.

import { BoardWriteShell } from "./WriteShell";

export default function BoardWritePage() {
  return <BoardWriteShell />;
}
