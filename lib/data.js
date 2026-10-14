// Loads the company database + TF-IDF index (fetched once, cached).
import { buildIndex } from './match';

let cache = null;

export async function loadData() {
  if (cache) return cache;
  const [companies, tfidf, oss] = await Promise.all([
    fetch('/data/companies.json').then((r) => {
      if (!r.ok) throw new Error('companies.json failed to load');
      return r.json();
    }),
    fetch('/data/tfidf.json').then((r) => {
      if (!r.ok) throw new Error('tfidf.json failed to load');
      return r.json();
    }),
    fetch('/data/opensource.json').then((r) => (r.ok ? r.json() : {})),
  ]);
  cache = { companies, index: buildIndex(tfidf), oss };
  return cache;
}

export function topIndustries(companies, n = 24) {
  const counts = {};
  for (const c of companies) {
    for (const ind of c.industries) counts[ind] = (counts[ind] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map((e) => e[0]);
}
