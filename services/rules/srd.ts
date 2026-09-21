import type { SrdPage } from '@/types/index';

export const SRD_VERSION = '5.2.1' as const;
export const SRD_URL =
  'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf';
export const SRD_ATTRIBUTION =
  'This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.';
let corpus: Promise<SrdPage[]> | undefined;
export function loadSrd(): Promise<SrdPage[]> {
  return (corpus ??= import('@/data/rules/srd-5.2.1.json').then(
    (m) => m.default.pages,
  ));
}
const STOP = new Set(
  'a an and are as at be by can do for from has have how i in is it my of on or that the their this to use was what when with you your'.split(
    ' ',
  ),
);
const terms = (text: string) =>
  text
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((w) => w.length > 1 && !STOP.has(w)) ?? [];

/** Local ranked search. Never mixes 2014 rules or campaign lore into the SRD. */
export function searchSrd(
  pages: SrdPage[],
  query: string,
  limit = 6,
): SrdPage[] {
  const words = [...new Set(terms(query))];
  if (!words.length) return [];
  const tokens = pages.map((p) => terms(p.text));
  const frequencies = words.map((w) =>
    tokens.reduce((n, t) => n + Number(t.includes(w)), 0),
  );
  return pages
    .map((page, index) => {
      if (page.page < 5) return { page, score: 0 };
      const body = tokens[index];
      const heading = terms(page.headings.join(' '));
      let score = words.reduce((total, w, i) => {
        const count = body.filter((t) => t === w).length;
        const idf = Math.log(
          1 + (pages.length - frequencies[i] + 0.5) / (frequencies[i] + 0.5),
        );
        return (
          total +
          idf *
            ((count * 2.2) /
              (count + 1.2 * (0.25 + (0.75 * body.length) / 550))) +
          (heading.includes(w) ? idf * 3 : 0)
        );
      }, 0);
      const exact = query.trim().toLowerCase();
      if (
        page.headings.some(
          (h) =>
            h.toLowerCase() === exact ||
            h.toLowerCase() === `${exact} [condition]`,
        )
      )
        score += 30;
      if (page.section === 'Rules Glossary') score *= 1.15;
      return { page, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.page.page - b.page.page)
    .slice(0, limit)
    .map((x) => x.page);
}
export function srdLink(page: number): string {
  return `${SRD_URL}#page=${page}`;
}
export function getSrdPages(pages: SrdPage[], numbers: number[]): SrdPage[] {
  return [...new Set(numbers)].map((n) => {
    const page = pages.find((p) => p.page === n);
    if (!page) throw new Error(`Unknown SRD page: ${n}`);
    return page;
  });
}
export function rulesContext(pages: SrdPage[]): string {
  return pages
    .map((p) => `[SRD 5.2.1, page ${p.page}; ${p.section}]\n${p.text}`)
    .join('\n\n');
}
