'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loadData, topIndustries } from '../../lib/data';
import { deepRank, getApiKey } from '../../lib/ai';
import KeyModal from '../components/key-modal';

const PAGE = 60;
const AI_N = 30;

function MatchesInner() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [industry, setIndustry] = useState('');
  const [minYear, setMinYear] = useState('');
  const [loc, setLoc] = useState('');
  const [youngOnly, setYoungOnly] = useState(false);
  const [ossOnly, setOssOnly] = useState(false);
  const [oss, setOss] = useState({});
  const [shown, setShown] = useState(PAGE);
  const [sort, setSort] = useState('fit');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiMap, setAiMap] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('ycm');
    if (!raw) { router.push('/'); return; }
    setSession(JSON.parse(raw));
    loadData().then(({ companies, oss }) => {
      setCompanies(companies);
      setIndustries(topIndustries(companies));
      setOss(oss || {});
    });
  }, [router]);

  const byId = useMemo(() => {
    const m = {};
    companies.forEach((c) => { m[c.id] = c; });
    return m;
  }, [companies]);

  const filtered = useMemo(() => {
    if (!session) return [];
    let list = session.results;
    if (industry) list = list.filter((r) => (byId[r.id]?.industries || []).includes(industry));
    if (minYear) list = list.filter((r) => (byId[r.id]?.year || 0) >= Number(minYear));
    if (youngOnly) list = list.filter((r) => (byId[r.id]?.year || 0) >= 2023);
    if (ossOnly) list = list.filter((r) => oss[r.id]);
    if (loc.trim()) {
      const q = loc.trim().toLowerCase();
      list = list.filter((r) => (byId[r.id]?.location || '').toLowerCase().includes(q));
    }
    if (aiMap) {
      list = [...list].sort((a, b) => ((aiMap[b.id]?.score ?? -1) - (aiMap[a.id]?.score ?? -1)));
    } else if (sort === 'newest') {
      const seasonRank = (b) => /fall/i.test(b || '') ? 4 : /summer/i.test(b || '') ? 3 : /spring/i.test(b || '') ? 2 : 1;
      list = [...list].sort((a, b) => {
        const ca = byId[a.id], cb = byId[b.id];
        return (cb?.year || 0) - (ca?.year || 0) || seasonRank(cb?.batch) - seasonRank(ca?.batch);
      });
    }
    return list;
  }, [session, byId, industry, minYear, loc, youngOnly, ossOnly, oss, aiMap, sort]);

  async function runDeepRead(apiKey) {
    const key = apiKey || getApiKey();
    if (!key) { setShowKeyModal(true); return; }
    setAiRunning(true);
    setAiError('');
    try {
      const top = session.results.slice(0, AI_N);
      const map = await deepRank(key, session.resume || '', top.map((r) => byId[r.id]).filter(Boolean));
      setAiMap(map);
      setShown(PAGE);
    } catch (e) {
      setAiError(e.message || 'AI ranking failed.');
    } finally {
      setAiRunning(false);
    }
  }

  if (!session) return <div className="loading"><div className="spinner" /><p>Loading…</p></div>;

  return (
    <div className="container">
      <header className="top">
        <div className="logo">YC<span>Match</span></div>
        <Link href="/" className="btn secondary small">↩ New resume</Link>
      </header>

      <div className="card">
        <h1>Top matches for {session.name || 'you'}</h1>
        <p className="muted">
          Ranked from {session.total.toLocaleString()} YC startups by fit with your skills
          {session.projects.length ? <> and projects ({session.projects.slice(0, 3).join(' · ')})</> : null}.
        </p>
        <div className="action-row" style={{ marginBottom: 12 }}>
          <button className="btn small" onClick={() => runDeepRead()} disabled={aiRunning}>
            {aiRunning ? '⏳ AI is reading your resume…' : aiMap ? '↻ Re-run AI ranking' : '✨ Deep read with AI'}
          </button>
          {!aiRunning && (
            <span className="muted" style={{ fontSize: 12 }}>
              {aiMap
                ? `AI re-ranked your top ${AI_N} — sorted by AI fit. Free Gemini key needed.`
                : `Let AI read your resume properly and re-rank the top ${AI_N}. Needs a free Gemini key.`}
            </span>
          )}
        </div>
        {aiError && <p style={{ color: '#dc2626', fontSize: 13 }}>{aiError}</p>}
        <div className="filters">
          <div className="f">
            <label>Industry</label>
            <select value={industry} onChange={(e) => { setIndustry(e.target.value); setShown(PAGE); }}>
              <option value="">All industries</option>
              {industries.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="f">
            <label>Batch year</label>
            <select value={minYear} onChange={(e) => { setMinYear(e.target.value); setShown(PAGE); }}>
              <option value="">Any year</option>
              <option value="2024">2024 and later</option>
              <option value="2022">2022 and later</option>
              <option value="2020">2020 and later</option>
              <option value="2018">2018 and later</option>
            </select>
          </div>
          <div className="f">
            <label>Location contains</label>
            <input type="text" placeholder="e.g. remote, india, SF" value={loc} onChange={(e) => { setLoc(e.target.value); setShown(PAGE); }} />
          </div>
          <div className="f">
            <label>Sort by</label>
            <select value={sort} onChange={(e) => { setSort(e.target.value); setShown(PAGE); }}>
              <option value="fit">Best match</option>
              <option value="newest">Newest first</option>
            </select>
          </div>
          <div className="check">
            <input type="checkbox" id="young" checked={youngOnly} onChange={(e) => { setYoungOnly(e.target.checked); setShown(PAGE); }} />
            <label htmlFor="young">Young companies only (2023+ batches)</label>
          </div>
          <div className="check">
            <input type="checkbox" id="ossonly" checked={ossOnly} onChange={(e) => { setOssOnly(e.target.checked); setShown(PAGE); }} />
            <label htmlFor="ossonly">🌱 Open source only</label>
          </div>
        </div>
      </div>

      <div className="count">{filtered.length} matches</div>

      <div className="card" style={{ paddingTop: 8, paddingBottom: 8 }}>
        {filtered.slice(0, shown).map((r) => {
          const c = byId[r.id];
          if (!c) return null;
          return (
            <div className="match-row" key={r.id} onClick={() => router.push(`/company?id=${r.id}`)}>
              <div className="score">{r.match}%</div>
              <div>
                <div className="co-name">{c.name}</div>
                <div className="co-meta">{c.batch}{c.location ? ` · ${c.location}` : ''}</div>
                <div className="co-tag">{c.tagline || <i style={{ color: '#9ca3af' }}>No description listed</i>}</div>
                <div className="chips">
                  {r.keywords.slice(0, 4).map((k) => <span className="chip hot" key={k}>{k}</span>)}
                  {(c.industries || []).slice(0, 2).map((i) => <span className="chip ind" key={i}>{i}</span>)}
                  {oss[r.id] && <span className="chip oss">🌱 Open source</span>}
                </div>
                {aiMap?.[r.id] && (
                  <div className="why ai">✨ <b>{aiMap[r.id].score}% AI fit</b> — {aiMap[r.id].reason}</div>
                )}
                {r.signal && r.signalKind === 'job' && <div className="why">via your work at <b>{r.signalCompany}</b></div>}
                {r.signal && r.signalKind !== 'job' && <div className="why">via your project <b>{r.signal}</b></div>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="muted" style={{ padding: 16 }}>No matches with these filters — try widening them.</p>}
      </div>

      {filtered.length > shown && (
        <button className="btn secondary" onClick={() => setShown(shown + PAGE)}>Show more</button>
      )}
      {showKeyModal && (
        <KeyModal
          onClose={() => setShowKeyModal(false)}
          onSaved={(k) => { setShowKeyModal(false); runDeepRead(k); }}
        />
      )}
    </div>
  );
}

export default function MatchesPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /><p>Loading…</p></div>}>
      <MatchesInner />
    </Suspense>
  );
}
