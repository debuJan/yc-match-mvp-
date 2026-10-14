# YC Match

Upload your resume → get ranked YC startup matches → find founders → send outreach.

**Live:** https://yc-match-mvp.vercel.app

YC Match reads your resume (projects *and* work experience), ranks **6,295 Y Combinator startups**
by how well they fit you, and helps you reach the right person at each one — with a
personalized outreach draft for every company. Optionally, AI reads your resume properly
and re-ranks with evidence-based reasoning.

## Screens

1. **Upload** — drop a resume PDF (parsed entirely in your browser) or paste resume text.
   Name, target role, and headline are auto-detected but editable.
2. **Matches** — ranked startup list with match %, keyword chips, and *why* each company
   matches (via your project / via your work at X). Filters: industry, batch year,
   location, young companies (2023+), open source only. Sort: best match / newest first.
3. **Company** — company details, open-source badge (with GitHub stars, links straight to
   the repo), founder finder (LinkedIn), email finder (Mailmeteor), and an editable,
   personalized outreach draft with copy button.

## How matching works

All matching runs **in the browser** — no server, no uploads.

- **Resume parsing** (`lib/match.js`): extracts name, projects (handles both clean and
  merged PDF text), and work experience (company, title, dates, seniority — with an
  inline-text fallback for pdf.js output). Strips noisy sections (extracurriculars).
- **TF-IDF + cosine similarity**: the resume becomes a TF-IDF vector (precomputed index in
  `public/data/tfidf.json`, built with the same tokenizer) compared against every company.
- **Project/experience-aware scoring**: each project and each job is scored separately;
  final score = **55% overall fit + 45% best project/job fit**. Every ranking is
  explainable — the UI shows the overlapping keywords and which project/job drove it.
- **Experience-aware drafts** (`lib/draft.js`): seniority is detected from the resume —
  an SDE-2 gets "a Software Development Engineer at Amazon", not "an early-career
  engineer". Junk keywords are filtered; missing projects never produce fake references.
- **✨ AI deep read** (optional, `lib/ai.js`): TF-IDF is word-matching — it can't truly
  *read*. "Deep read with AI" sends your resume + top 30 companies to Gemini, which
  re-ranks with one-line, evidence-based reasons per company. "Rewrite with AI" writes a
  genuinely personalized cold email from your actual experience. Bring your own free key
  ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) — it stays in your
  browser's localStorage; requests go straight from your browser to Google's API.

## Data

- **6,295 YC companies** (Summer 2005 → Summer 2027) in `public/data/companies.json` —
  every company collected, none skipped, deduplicated, sorted chronologically.
  Fields: `id, batch, year, season, name, tagline, industries, location`.
- **TF-IDF index** in `public/data/tfidf.json` (vocabulary, IDF weights, document vectors).
- **Open-source badges** in `public/data/opensource.json` — 175 YC startups verified as
  open source via [yc-oss](https://yc-oss.github.io) data, 174 with canonical GitHub repo
  URLs and star counts. Matched against the company database by normalized name + batch.

## Run it

Needs **Node 18+**.

```bash
npm install
npm run dev
```

Open http://localhost:3000

Production build (fully static — no server needed afterwards):

```bash
npm run build
npx serve out
```

Deploy to Vercel:

```bash
npx vercel --prod
```

## Project structure

```
app/
  page.js            # upload screen + resume parsing + matching
  matches/page.js    # ranked results, filters, sort, AI deep read
  company/page.js    # company detail, outreach draft, founder/email/GitHub links
  components/
    key-modal.js     # Gemini API key entry modal
  globals.css        # styles
  layout.js
lib/
  match.js           # TF-IDF matching, resume parsing (projects, experience, name)
  draft.js           # outreach draft generator + external search links
  ai.js              # Gemini deep-rank + draft rewrite (bring-your-own key)
  data.js            # loads companies.json + tfidf.json + opensource.json
  pdf.js             # in-browser PDF text extraction (pdfjs-dist)
public/data/
  companies.json     # 6,295 YC companies
  tfidf.json         # precomputed TF-IDF index
  opensource.json    # open-source badges {companyId: {repo, stars, website, yc_url}}
```

## Privacy

- Your resume **never leaves your browser**. No uploads, no servers, no storage —
  matching happens entirely on your machine.
- The optional AI features send your resume text **only to Google's Gemini API**,
  directly from your browser, using *your* API key. Nothing goes through any other server.

## Limitations (MVP)

- "Young startup" is approximated by batch year (2023+) — real headcount data isn't in
  the dataset.
- Founder names aren't embedded; the app opens a targeted LinkedIn/Google search.
- Email discovery is intentionally manual (free Mailmeteor tool, one profile at a time) —
  no scraping, no paid enrichment API.
- Matching uses company tagline/industry/location/batch + your resume — not live hiring status.
- `next@14.2.13` has a published security advisory — upgrade Next.js before any
  production use beyond this demo.

## License

MIT — see [LICENSE](LICENSE).
