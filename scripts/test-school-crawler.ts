// 실제 학교 사이트에서 3 source 를 fetch + parse 해서 결과를 출력하는 검증 스크립트.
// 실행: npx tsx scripts/test-school-crawler.ts

import { crawlSource, ALL_SOURCES } from "../src/lib/schoolNotices";

async function main() {
  for (const src of ALL_SOURCES) {
    try {
      const { parsed, url, html } = await crawlSource(src);
      console.log(
        `[${src}] ${url} html.length=${html.length} parsed=${parsed.length}`,
      );
      parsed.slice(0, 5).forEach((p, i) => {
        console.log(
          `  ${i + 1}. ${p.date} | ntt_sn=${p.ntt_sn} | ${p.title}`,
        );
      });
    } catch (e) {
      console.error(`[${src}] ERROR:`, e instanceof Error ? e.message : e);
    }
  }
}

void main();
