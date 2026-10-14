'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadData } from '../../lib/data';
import { makeDraft, MAILMETEOR_URL, linkedInSearchUrl } from '../../lib/draft';
import { rewriteDraft, getApiKey } from '../../lib/ai';
import KeyModal from '../components/key-modal';

function CompanyInner() {
  const fmtStars = (n) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : `${n}`);
  const router = useRouter();
  const params = useSearchParams();
  const id = Number(params.get('id'));
  const [company, setCompany] = useState(null);
  const [matchInfo, setMatchInfo] = useState(null);
  const [ossInfo, setOssInfo] = useState(null);
  const [session, setSession] = useState(null);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiError, setAiError] = useState('');

  async function aiRewrite(apiKey) {
    const key = apiKey || getApiKey();
    if (!key) { setShowKeyModal(true); return; }
    setAiRunning(true);
    setAiError('');
    try {
      const out = await rewriteDraft(key, {
        resumeText: session.resume || '',
        company,
        name: session.name,
        headline: session.headline,
        role: session.role,
      });
      if (out.body) setDraft(out.subject ? `Subject: ${out.subject}\n\n${out.body}` : out.body);
      else setAiError('Empty response from the model. Try again.');
    } catch (e) {
      setAiError(e.message || 'AI rewrite failed.');
    } finally {
      setAiRunning(false);
    }
  }

  useEffect(() => {
    const raw = sessionStorage.getItem('ycm');
    if (!raw) { router.push('/'); return; }
    const s = JSON.parse(raw);
    setSession(s);
    loadData().then(({ companies, oss }) => {
      const c = companies.find((x) => x.id === id);
      if (!c) { router.push('/matches'); return; }
      setCompany(c);
      setOssInfo((oss && oss[c.id]) || null);
      const mi = s.results.find((r) => r.id === id);
      setMatchInfo(mi || null);
      setDraft(makeDraft({
        company: c,
        name: s.name,
        headline: s.headline,
        role: s.role,
        signal: mi?.signal,
        signalKind: mi?.signalKind,
        signalCompany: mi?.signalCompany,
        keywords: mi?.keywords,
      }));
    });
  }, [id, router]);

  function copy(text, what) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(''), 2000);
    });
  }

  if (!company) return <div className="loading"><div className="spinner" /><p>Loading…</p></div>;

  return (
    <div className="container">
      <Link href="/matches" className="back">← Back to matches</Link>

      <div className="card">
        <div className="detail-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>{company.name}</h1>
            {matchInfo && <div className="score" style={{ minWidth: 56, height: 48 }}>{matchInfo.match}%</div>}
          </div>
          <div style={{ marginTop: 8 }}>
            <span className="pill">{company.batch}</span>
            {company.location && <span className="pill">{company.location}</span>}
            {ossInfo && (
              <a
                className="pill oss"
                href={ossInfo.repo || ossInfo.website || ossInfo.yc_url}
                target="_blank"
                rel="noreferrer"
                title={ossInfo.stars ? `${Number(ossInfo.stars).toLocaleString()} GitHub stars` : 'Verified open-source YC startup — click to visit'}
              >
                🌱 Open source{ossInfo.stars ? ` · ${fmtStars(ossInfo.stars)}★` : ''}
              </a>
            )}
          </div>
        </div>
        <p style={{ fontSize: 16, margin: '12px 0' }}>
          {company.tagline || <i style={{ color: '#9ca3af' }}>No description listed</i>}
        </p>
        <div className="chips">
          {(company.industries || []).map((i) => <span className="chip ind" key={i}>{i}</span>)}
        </div>

        {matchInfo && (
          <div className="note" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
            <b>Why this matches you:</b>{' '}
            {matchInfo.keywords.slice(0, 5).join(', ')}
            {matchInfo.signal && matchInfo.signalKind === 'job' && <> — via your work at <b>{matchInfo.signalCompany}</b></>}
            {matchInfo.signal && matchInfo.signalKind !== 'job' && <> — via your project <b>{matchInfo.signal}</b></>}
            {matchInfo.industries.length > 0 && <> · industry overlap: {matchInfo.industries.join(', ')}</>}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Reach the right person</h2>
        <p className="muted">
          For young startups, the founders are the hiring managers. Find them, then find their email.
        </p>
        <div className="action-row">
          <a className="btn small" href={linkedInSearchUrl(company.name)} target="_blank" rel="noreferrer">
            🔍 Find founder on LinkedIn
          </a>
          <a className="btn small secondary" href={MAILMETEOR_URL} target="_blank" rel="noreferrer">
            ✉️ Find email from LinkedIn URL
          </a>
        </div>
        <div className="note">
          Copy the founder's LinkedIn profile URL, paste it into the Mailmeteor tool —
          it finds their verified work email for free. One profile at a time.
        </div>
      </div>

      <div className="card">
        <h2>Outreach draft</h2>
        <p className="muted">Personalized for this company. Edit it, then copy and send it yourself.</p>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 260 }} />
        {aiError && <p style={{ color: '#dc2626', fontSize: 13 }}>{aiError}</p>}
        <div className="action-row">
          <button className="btn small" onClick={() => copy(draft, 'draft')}>
            {copied === 'draft' ? '✓ Copied!' : '📋 Copy draft'}
          </button>
          <button className="btn small secondary" onClick={() => aiRewrite()} disabled={aiRunning}>
            {aiRunning ? '⏳ AI is writing…' : '✨ Rewrite with AI'}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          Rewrite lets AI read your full resume and write a genuinely personalized email for this company. Needs a free Gemini key.
        </p>
      </div>
      {showKeyModal && (
        <KeyModal
          onClose={() => setShowKeyModal(false)}
          onSaved={(k) => { setShowKeyModal(false); aiRewrite(k); }}
        />
      )}
    </div>
  );
}

export default function CompanyPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /><p>Loading…</p></div>}>
      <CompanyInner />
    </Suspense>
  );
}
