// Matching engine: TF-IDF cosine similarity + project-aware scoring.
// Runs fully in the browser. Mirrors the Python tokenizer used to build tfidf.json.

const STOP = new Set(
  'a an and are as at be by for from has he in is it its of on that the to was were will with been have had has this that these those they them their then than or but not no nor so such can could should would may might must shall do does did done over under into out up down off again once here there when where which who whom whose what why how all any both each few more most other some only own same too very just don ll re ve isn aren wasn weren hasn haven hadn doesn didn won wouldn shan shouldn couldn mustn need ought via per vs etc eg ie within without between through during including until while since also well much many get got getting make made using use used build built based new ii iii his her hers him she our ours your yours my mine me you we us i'.split(' ')
);

export function tokenize(text) {
  const toks = (String(text).toLowerCase().match(/[a-z0-9]+/g) || []);
  return toks.filter((t) => t.length >= 2 && !STOP.has(t));
}

export function buildIndex(tfidf) {
  const vocabIndex = {};
  tfidf.vocab.forEach((t, i) => { vocabIndex[t] = i; });
  const docNorms = tfidf.docs.map((vec) => {
    let s = 0;
    for (const pair of vec) s += pair[1] * pair[1];
    return Math.sqrt(s);
  });
  return { vocab: tfidf.vocab, idf: tfidf.idf, docs: tfidf.docs, vocabIndex, docNorms };
}

export function textVector(text, idx) {
  const tf = {};
  for (const t of tokenize(text)) tf[t] = (tf[t] || 0) + 1;
  const vec = {};
  let norm = 0;
  for (const t of Object.keys(tf)) {
    const i = idx.vocabIndex[t];
    if (i === undefined) continue;
    const w = (1 + Math.log(tf[t])) * idx.idf[i];
    vec[i] = w;
    norm += w * w;
  }
  return { vec, norm: Math.sqrt(norm) };
}

function dotSparse(qvec, doc) {
  let s = 0;
  for (const pair of doc) {
    const q = qvec[pair[0]];
    if (q) s += q * pair[1];
  }
  return s;
}

const SECTION_WORDS = /education|experience|skills|certifications?|achievements|summary|objective|profile|interests|languages|extra-?curricular|activities|leadership|volunteer|hobbies|awards|publications|references/i;
const SECTION_WORDS_CAPS = /EDUCATION|EXPERIENCE|SKILLS|CERTIFICATIONS?|ACHIEVEMENTS|SUMMARY|OBJECTIVE|PROFILE|INTERESTS|LANGUAGES|EXTRA-?CURRICULAR|ACTIVITIES|LEADERSHIP|VOLUNTEER|HOBBIES|AWARDS|PUBLICATIONS|REFERENCES/;

// Sections like extracurriculars add noise to matching — drop them from the query text.
export function stripNoisySections(resumeText) {
  return String(resumeText).replace(/extra-?curricular[\s\S]*$/i, '');
}

// Generic filler words that sometimes surface as "keywords" but say nothing.
const JUNK_KW = new Set(
  'across low high new also well much many using used use built build based team work working daily every large small first last one two three get got make made take took even still back per via etc within between around along another every own'.split(' ')
);

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const DATE_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\s*[–—\-]\s*(present|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4}))/i;
const TITLE_RE = /^(software development engineer|software engineer|sde\s*-?\s*[123]?|senior software engineer|senior sde|member of technical staff|engineering intern|software engineering intern|backend engineer|frontend engineer|full[\s-]?stack engineer|devops engineer|data engineer|machine learning engineer|ai engineer|mobile engineer|engineering manager|intern)\b/i;

function titleize(t) {
  return t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bSde\b/g, 'SDE').replace(/\bAi\b/g, 'AI');
}

// Cut an inline (single-line) section tail at the next section header.
function cutInlineTail(tail) {
  const m = tail.match(/\.\s+(SKILLS|Skills|EDUCATION|Education|PROJECTS|Projects|CERTIFICATIONS|Certifications)\b/);
  if (m) return tail.slice(0, m.index + 1);
  const m2 = tail.match(SECTION_WORDS_CAPS);
  return m2 ? tail.slice(0, m2.index) : tail;
}

export function extractExperience(resumeText) {
  const text = String(resumeText);
  const lines = text.split('\n');
  let tail = null;
  let multiline = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(work\s+)?experience\s*$/i.test(lines[i].trim())) {
      const rest = lines.slice(i + 1);
      let end = rest.length;
      for (let j = 0; j < rest.length; j++) {
        const l = rest[j].trim();
        if (l.length > 0 && l.length < 40 && /^[A-Z][A-Z\s&/\-()]{2,}$/.test(l) && SECTION_WORDS.test(l) && !/experience/i.test(l)) {
          end = j;
          break;
        }
      }
      tail = rest.slice(0, end).join('\n');
      multiline = true;
      break;
    }
  }
  if (tail == null) {
    // Inline fallback (pdf.js single-line text): locate the header if possible,
    // otherwise scan the whole text for "Company — Title … date range" patterns.
    const hm = text.match(/(?:^|\.\s+|\n)\s*(work experience|experience|employment)\b/i);
    const scanText = hm ? text.slice(hm.index + hm[0].length) : text;
    tail = cutInlineTail(scanText);
  }
  const trimmed = tail.trim();
  if (!trimmed) return { jobs: [], totalMonths: 0, current: null };

  // Split into jobs on "Company — Title" boundaries. The lookbehind ensures we
  // only split at the START of a company name (after a sentence/bullet boundary),
  // not before every capitalized word inside it.
  const BOUND = '(?<=^|[.?!:\n•\\-]\\s+)';
  let parts = trimmed.split(new RegExp(`${BOUND}(?=[A-Z][\\w&.,'() ]{2,60}\\s+[—–]\\s+)`)).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2 && multiline) {
    parts = trimmed.split(/(?=^[A-Z][^\n]{2,80}—)/m).map((p) => p.trim()).filter(Boolean);
  }
  const now = new Date();
  const jobs = [];
  for (const part of parts) {
    const dash = part.search(/[—–]/);
    if (dash === -1) continue;
    const company = part.slice(0, dash).trim().replace(/\s+/g, ' ');
    if (!company || company.length > 60 || /\d{4}/.test(company)) continue;
    const rest = part.slice(dash + 1).trim();
    const tm = rest.match(TITLE_RE);
    const dm = rest.match(DATE_RE);
    // In the inline fallback there is no section context — require a date
    // range AND a recognizable job title so stray dashes in bullets or
    // project names ("AgentGuard – ...") don't become fake jobs.
    if (!multiline && (!dm || !tm)) continue;
    let months = 0;
    let isCurrent = false;
    if (dm) {
      const sm = MONTHS[dm[1].slice(0, 3).toLowerCase()];
      const sy = Number(dm[2]);
      let em, ey;
      if (/present/i.test(dm[3])) {
        em = now.getMonth();
        ey = now.getFullYear();
        isCurrent = true;
      } else {
        em = MONTHS[dm[4].slice(0, 3).toLowerCase()];
        ey = Number(dm[5]);
      }
      months = Math.max(0, (ey - sy) * 12 + (em - sm));
    }
    jobs.push({
      company,
      title: tm ? titleize(tm[1]) : '',
      months,
      isCurrent,
      text: part,
    });
  }
  const totalMonths = jobs.reduce((s, j) => s + j.months, 0);
  const current = jobs.find((j) => j.isCurrent) || jobs[0] || null;
  return { jobs, totalMonths, current };
}

// One-line professional headline for the outreach draft.
export function headlineFor(exp) {
  const cur = exp.current;
  if (cur && cur.title && /intern/i.test(cur.title)) return 'an early-career engineer';
  if (cur && cur.title && exp.totalMonths >= 12) {
    const art = /^[aeiou]/i.test(cur.title) ? 'an' : 'a';
    return `${art} ${cur.title}${cur.company ? ` at ${cur.company}` : ''}`;
  }
  if (exp.totalMonths >= 18) return 'a software engineer';
  return 'an early-career engineer';
}

export function suggestedRoleFor(resumeText) {
  return /machine learning|\bml\b|llm|rag\b|deep learning|pytorch|tensorflow|langchain|generative ai/i.test(String(resumeText))
    ? 'AI/ML Engineer'
    : 'Software Engineer';
}

function splitProjectChunks(section) {
  return section
    .split(
      /\n\s*\n|\r?\n(?=\s*[•\-\*]\s)|\n(?=[A-Z][A-Za-z0-9\s&'()–-]{2,50}\.\s)|(?<=\))\s+(?=[A-Z][A-Za-z0-9\s&'()–-]{2,40}\.\s)/
    )
    .map((c) => c.trim())
    .filter((c) => c.length > 40);
}

function chunksToProjects(chunks) {
  return chunks.slice(0, 6).map((c) => {
    const firstLine = c.split('\n')[0].replace(/^[•\-\*]\s*/, '').trim();
    return { title: firstLine.slice(0, 90), text: c };
  });
}

export function extractProjects(resumeText) {
  const text = String(resumeText);
  const lines = text.split('\n');

  // Tier 1: standalone "PROJECTS" header line (clean text extraction).
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*projects?\s*$/i.test(lines[i].trim())) { start = i + 1; break; }
  }
  if (start !== -1) {
    const rest = lines.slice(start);
    let end = rest.length;
    for (let i = 0; i < rest.length; i++) {
      const l = rest[i].trim();
      if (l.length > 0 && l.length < 40 && /^[A-Z][A-Z\s&/\-()]{2,}$/.test(l) && SECTION_WORDS.test(l)) {
        end = i;
        break;
      }
    }
    const chunks = splitProjectChunks(rest.slice(0, end).join('\n').trim());
    if (chunks.length) return chunksToProjects(chunks);
  }

  // Tier 2: inline ALL-CAPS "PROJECTS" header (pdf.js often merges lines).
  const m = text.match(/\bPROJECTS\b/);
  if (m) {
    let tail = text.slice(m.index + m[0].length);
    const endM = tail.match(SECTION_WORDS_CAPS);
    if (endM) tail = tail.slice(0, endM.index);
    const chunks = splitProjectChunks(tail.trim());
    if (chunks.length) return chunksToProjects(chunks);
  }

  return [{ title: 'Your profile', text: stripNoisySections(text).slice(0, 3000) }];
}

export function extractName(resumeText) {
  const lines = String(resumeText).split('\n').map((l) => l.trim()).filter((l) => l.length > 1);
  for (const line of lines.slice(0, 6)) {
    // Strip phone numbers, emails, URLs, handles and separators — keep the leading name part.
    let cleaned = line
      .split(/\+?\d[\d\s().\-]{7,}|@|https?:|linkedin\.com|github\.com|⋄|\||\//)[0]
      .trim()
      .replace(/[,;]+$/, '');
    if (!cleaned || /\d/.test(cleaned)) continue;
    // Drop a trailing lowercase username/handle glued after the name ("Onkar Ojha onkarojha").
    const words = cleaned.split(/\s+/);
    if (words.length >= 2) {
      const last = words[words.length - 1];
      if (/^[a-z][a-z0-9_.-]*$/.test(last) && words.slice(0, -1).every((w) => /^[A-Z]/.test(w))) {
        cleaned = words.slice(0, -1).join(' ');
      }
    }
    if (/^[A-Za-z][A-Za-z\s.'-]{2,40}$/.test(cleaned) && cleaned.split(/\s+/).length <= 4) {
      if (cleaned === cleaned.toUpperCase()) {
        return cleaned.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
      }
      return cleaned;
    }
  }
  return '';
}

export function extractBackground(resumeText) {
  const m = String(resumeText).match(/(summary|objective|profile)\s*\n([\s\S]{20,400}?)(?=\n\s*[A-Z][A-Z\s&/\-()]{2,}\s*\n|\n\s*\n)/i);
  if (m) return m[2].replace(/\s+/g, ' ').trim().slice(0, 240);
  return '';
}

export function matchAll(resumeText, companies, idx) {
  const cleanResume = stripNoisySections(resumeText);
  const q = textVector(cleanResume, idx);
  const projects = extractProjects(resumeText).map((p) => ({ ...p, kind: 'project', v: textVector(p.text, idx) }));
  const exp = extractExperience(resumeText);
  const jobs = exp.jobs.map((j) => ({ kind: 'job', title: j.title, company: j.company, text: j.text, v: textVector(j.text, idx) }));
  const chunks = [...projects, ...jobs];
  const results = [];
  const resumeLower = cleanResume.toLowerCase();
  for (let d = 0; d < companies.length; d++) {
    const doc = idx.docs[d];
    const dn = idx.docNorms[d];
    if (q.norm === 0 || dn === 0) continue;
    const base = dotSparse(q.vec, doc) / (q.norm * dn);
    let best = 0;
    let bestChunk = null;
    for (const p of chunks) {
      if (p.v.norm === 0) continue;
      const s = dotSparse(p.v.vec, doc) / (p.v.norm * dn);
      if (s > best) { best = s; bestChunk = p; }
    }
    const score = 0.55 * base + 0.45 * best;
    if (score <= 0) continue;
    const contrib = [];
    for (const pair of doc) {
      const qw = q.vec[pair[0]];
      if (qw) contrib.push([idx.vocab[pair[0]], qw * pair[1]]);
    }
    contrib.sort((a, b) => b[1] - a[1]);
    const seen = new Set();
    const keywords = [];
    for (const c of contrib) {
      if (JUNK_KW.has(c[0]) || seen.has(c[0])) continue;
      seen.add(c[0]);
      keywords.push(c[0]);
      if (keywords.length >= 6) break;
    }
    const indHit = companies[d].industries.filter((ind) =>
      ind.toLowerCase().split(/[^a-z0-9]+/).some((t) => t.length > 2 && resumeLower.includes(t))
    );
    results.push({
      id: companies[d].id,
      score,
      signal: bestChunk ? (bestChunk.title || (bestChunk.kind === 'job' ? bestChunk.company : null)) : null,
      signalKind: bestChunk ? bestChunk.kind : null,
      signalCompany: bestChunk && bestChunk.kind === 'job' ? bestChunk.company : null,
      keywords,
      industries: indHit,
    });
  }
  results.sort((a, b) => b.score - a.score);
  const max = results.length ? results[0].score : 1;
  const min = results.length ? results[results.length - 1].score : 0;
  const span = max - min || 1;
  results.forEach((r) => { r.match = Math.round(5 + 93 * ((r.score - min) / span)); });
  return {
    results,
    projects: projects.map((p) => p.title),
    name: extractName(resumeText),
    background: extractBackground(resumeText),
    headline: headlineFor(exp),
    suggestedRole: suggestedRoleFor(resumeText),
  };
}
