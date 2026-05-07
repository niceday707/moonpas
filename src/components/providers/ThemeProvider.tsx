"use client";

// next-themes 기반 다크/라이트 테마 프로바이더
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: Props) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange={false}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
