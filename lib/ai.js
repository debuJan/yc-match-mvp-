// Optional "deep read" layer: after TF-IDF shortlists candidates, an LLM reads
// the resume carefully and re-ranks with real reasoning. Bring-your-own free
// Gemini key — the key lives only in this browser's localStorage and requests
// go straight from the browser to Google's API. Nothing touches our servers
// (there are none — this app is fully static).

const GEMINI_MODEL = 'gemini-2.0-flash';
const KEY_NAME = 'ycm_gemini_key';

export function getApiKey() {
  try { return localStorage.getItem(KEY_NAME) || ''; } catch { return ''; }
}
export function setApiKey(k) {
  try { localStorage.setItem(KEY_NAME, (k || '').trim()); } catch {}
}
export function clearApiKey() {
  try { localStorage.removeItem(KEY_NAME); } catch {}
}

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    });
  } catch {
    throw new Error('Network error — check your connection and try again.');
  }
  if (res.status === 400) throw new Error('Invalid API key. Double-check the key you pasted.');
  if (res.status === 403) throw new Error('API key rejected (403). Make sure the Generative Language API is enabled for it.');
  if (res.status === 429) throw new Error('Quota exceeded (429) — free tier limit hit. Wait a bit and retry.');
  if (!res.ok) throw new Error(`Gemini API error (${res.status}). Try again.`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) throw new Error('Empty response from the model. Try again.');
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Could not parse the model response. Try again.');
  }
}

// Re-rank the TF-IDF shortlist with genuine reading of the resume.
// Returns: { [companyId]: { score, reason } }
export async function deepRank(apiKey, resumeText, companies) {
  const resume = String(resumeText).replace(/\s+/g, ' ').trim().slice(0, 5000);
  const list = companies.map((c) => ({
    id: c.id,
    name: c.name,
    tagline: (c.tagline || '').slice(0, 140),
    industries: (c.industries || []).slice(0, 3),
    batch: c.batch,
  }));
  const prompt =
    'You are an expert technical recruiter. Read the candidate resume CAREFULLY — understand what they actually built ' +
    '(projects, jobs, scale, technologies), not just keywords.\n\n' +
    'Rank these STARTUPS by fit for this candidate (0-100). Consider: skill overlap, domain relevance, seniority match ' +
    '(do not recommend senior roles to interns, nor junior roles to experienced engineers), and whether their hands-on ' +
    'experience transfers to what the company does.\n\n' +
    'Return ONLY JSON: {"ranked":[{"id":<n>,"score":<0-100>,"reason":"<one sharp line citing specific resume evidence>"}]}\n' +
    'Be strict: most scores should be 20-70. Only genuinely strong fits go above 80.\n\n' +
    'RESUME:\n---\n' + resume + '\n---\n\nSTARTUPS:\n' + JSON.stringify(list);
  const out = await callGemini(apiKey, prompt);
  const map = {};
  for (const r of out.ranked || []) {
    if (r && typeof r.id !== 'undefined') map[r.id] = { score: Number(r.score) || 0, reason: String(r.reason || '').slice(0, 220) };
  }
  return map;
}

// Write a genuinely personalized cold email — the model reads the resume and
// picks ONE specific, relevant proof point. Returns { subject, body }.
export async function rewriteDraft(apiKey, { resumeText, company, name, headline, role }) {
  const resume = String(resumeText).replace(/\s+/g, ' ').trim().slice(0, 5000);
  const prompt =
    'You are the candidate writing a cold email to a startup founder. Read the resume carefully and write a SHORT ' +
    '(under 120 words), human, specific email.\n\nRules:\n' +
    '- Open with who you are: ' + headline + '.\n' +
    '- Reference ONE specific thing from the resume (a project or job) that genuinely relates to what the company does. ' +
    'Quote a concrete detail (a metric, a technology, scale).\n' +
    '- State plainly you want to contribute as ' + role + ' and ask for a quick chat.\n' +
    '- No placeholders, no buzzword salad, no flattery. Sound like a real person.\n' +
    '- Sign with the first name: ' + String(name || '').split(/\s+/)[0] + '.\n\n' +
    'Return ONLY JSON: {"subject":"<short subject line>","body":"<email body, use \\n\\n between paragraphs>"}\n\n' +
    'RESUME:\n---\n' + resume + '\n---\n\nCOMPANY: ' + company.name + ' — ' + (company.tagline || '') +
    ' (' + (company.industries || []).join(', ') + ', ' + company.batch + ')';
  const out = await callGemini(apiKey, prompt);
  return { subject: String(out.subject || ''), body: String(out.body || '') };
}
