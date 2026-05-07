/** @type {import('next').NextConfig} */
const nextConfig = {
  // Supabase Storage 도메인 — public 이미지 URL 호출용
  // 현재 코드는 <img> 태그를 사용하지만, 추후 next/image 로 전환 시 필요.
  images: {
    remotePatterns: [
      { hostname: "fzmarprssobkdqmrydad.supabase.co" },
    ],
  },

  // 기존 더미 게시판 경로 → 새 /board/[boardType] 경로로 통합 리다이렉트.
  // 페이지 파일은 그대로 유지하지만, 라우팅 단계에서 가로채서 새 경로로 보낸다.
  async redirects() {
    return [
      // 커뮤니티
      { source: "/feed", destination: "/board/free", permanent: false },
      { source: "/notices", destination: "/board/notice", permanent: false },
      { source: "/lost", destination: "/board/lost", permanent: false },
      { source: "/market", destination: "/board/market", permanent: false },
      { source: "/debate", destination: "/board/debate", permanent: false },
      // 재학생
      { source: "/admission", destination: "/board/college", permanent: false },
      { source: "/curriculum", destination: "/board/curriculum", permanent: false },
      { source: "/council", destination: "/board/council", permanent: false },
      { source: "/qna", destination: "/board/qa", permanent: false },
      // 문태생활
      { source: "/youtube", destination: "/board/youtube", permanent: false },
      { source: "/resources", destination: "/board/resources", permanent: false },
      { source: "/study", destination: "/board/study", permanent: false },
      { source: "/news", destination: "/board/news", permanent: false },
      // 문태교우
      { source: "/alumni", destination: "/board/alumni", permanent: false },
      { source: "/reviews", destination: "/board/senior", permanent: false },
    ];
  },
};

export default nextConfig;
