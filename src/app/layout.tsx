import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

const SITE_URL = "https://moonpas.kr";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "문파스 MoonPas - 문태고등학교 커뮤니티",
    template: "%s · 문파스 MoonPas",
  },
  description:
    "문태고등학교 학생 커뮤니티 플랫폼. 자유게시판, 익명게시판, 공지사항, 대입정보, 학교생활",
  keywords: ["문파스", "moonpas", "문태고", "문태고등학교", "학교 커뮤니티"],
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/icon-512.png" },
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: "문파스 MoonPas",
    title: "문파스 MoonPas - 문태고등학교 커뮤니티",
    description:
      "문태고등학교 학생 커뮤니티 플랫폼. 자유게시판, 익명게시판, 공지사항, 대입정보, 학교생활",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "문파스 MoonPas" }],
  },
  twitter: {
    card: "summary",
    title: "문파스 MoonPas - 문태고등학교 커뮤니티",
    description:
      "문태고등학교 학생 커뮤니티 플랫폼. 자유게시판, 익명게시판, 공지사항, 대입정보, 학교생활",
    images: ["/icon-512.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f1a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
