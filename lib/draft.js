// Personalized outreach draft generator.

export function makeDraft({ company, name, headline, role, signal, signalKind, signalCompany, keywords }) {
  const displayName = (name || '').trim() || 'there';
  const first = displayName.split(/\s+/)[0] || 'there';
  const hd = (headline || '').trim() || 'an early-career engineer';
  const cleanTag = (company.tagline || '').replace(/…$/, '').trim().slice(0, 110);
  const kw = (keywords || []).slice(0, 3).join(', ');

  const hook = cleanTag
    ? `${company.name}'s work on "${cleanTag}" stood out to me`
    : `${company.name} stood out to me`;

  let ref = '';
  let exLine = '';
  if (signalKind === 'job' && signalCompany) {
    ref = ` — closely related to my work at ${signalCompany}`;
    if (kw) exLine = `For example, at ${signalCompany} I worked hands-on with ${kw}.\n\n`;
  } else if (signalKind === 'project' && signal) {
    ref = ` — it connects directly with my project "${signal}"`;
    if (kw) exLine = `For example, in "${signal}" I worked hands-on with ${kw}.\n\n`;
  } else if (kw) {
    ref = ` — it aligns with my background in ${kw}`;
  }

  return (
    `Hi ${company.name} team,\n\n` +
    `I'm ${displayName}, ${hd}. ${hook}${ref}.\n\n` +
    exLine +
    `I'd love to contribute to ${company.name} as ${role || 'an engineer'}. My resume is attached — would you be open to a quick chat?\n\n` +
    `Best,\n${first}`
  );
}

export const MAILMETEOR_URL = 'https://mailmeteor.com/tools/linkedin-email-finder';

export function linkedInSearchUrl(companyName) {
  // Google site-search is far more reliable than LinkedIn's own people-search
  // URL (which often fails for logged-out users or returns empty results).
  return `https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in "${companyName}" founder`)}`;
}
