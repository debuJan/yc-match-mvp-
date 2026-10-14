'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadData } from '../lib/data';
import { matchAll } from '../lib/match';

async function extractPdfText(file) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(' ') + '\n';
  }
  return text;
}

export default function UploadPage() {
  const router = useRouter();
  const [fileName, setFileName] = useState('');
  const [pasted, setPasted] = useState('');
  const [usePaste, setUsePaste] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file) {
    if (!file) return;
    setError('');
    if (!/\.pdf$/i.test(file.name)) {
      setError('Please upload a PDF resume.');
      return;
    }
    setBusy(true);
    try {
      const text = await extractPdfText(file);
      if (text.trim().length < 50) {
        setError('Could not read enough text from this PDF. Try pasting your resume text instead.');
        setBusy(false);
        return;
      }
      runMatch(text, file.name);
    } catch (e) {
      setError('Could not read this PDF. Try pasting your resume text instead.');
      setBusy(false);
    }
  }

  async function runMatch(resumeText, label) {
    setBusy(true);
    setError('');
    try {
      const { companies, index } = await loadData();
      // let the UI paint before the heavy compute
      await new Promise((r) => setTimeout(r, 30));
      const out = matchAll(resumeText, companies, index);
      const finalName = name.trim() || out.name;
      sessionStorage.setItem(
        'ycm',
        JSON.stringify({
          results: out.results.slice(0, 500),
          projects: out.projects,
          name: finalName,
          background: out.background,
          role: role.trim() || out.suggestedRole,
          headline: out.headline,
          resume: resumeText,
          label,
          total: companies.length,
          at: Date.now(),
        })
      );
      router.push('/matches');
    } catch (e) {
      setError('Something went wrong while matching. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <header className="top">
        <div className="logo">YC<span>Match</span></div>
      </header>

      <div className="card">
        <h1>Find startups that match your resume</h1>
        <p className="muted">
          Upload your resume. We rank 6,295 YC startups by how well they fit your
          skills and projects — then help you reach the right people.
        </p>

        {!usePaste ? (
          <div
            className={'drop' + (dragOver ? ' over' : '')}
            onClick={() => document.getElementById('resume-file').click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          >
            <input
              id="resume-file"
              type="file"
              accept="application/pdf"
              onChange={(e) => handleFile(e.target.files[0])}
            />
            <div style={{ fontSize: 40 }}>📄</div>
            <p><b>{fileName || 'Drop your resume PDF here'}</b></p>
            <p className="muted" style={{ margin: 0 }}>or click to browse</p>
          </div>
        ) : (
          <div>
            <textarea
              placeholder="Paste your resume text here…"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              style={{ minHeight: 180 }}
            />
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setUsePaste(!usePaste); setError(''); }}
            style={{ fontSize: 14 }}
          >
            {usePaste ? '← back to PDF upload' : 'PDF not working? Paste resume text instead'}
          </a>
        </div>

        <div className="row">
          <div>
            <label className="field">Your name</label>
            <input type="text" placeholder="Auto-detected from resume" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="field">Role you want</label>
            <input type="text" placeholder="Auto-detected from resume" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
        </div>

        {error && <div className="note">{error}</div>}

        {usePaste && (
          <button
            className="btn"
            disabled={busy || pasted.trim().length < 50}
            onClick={() => runMatch(pasted, 'pasted text')}
          >
            {busy ? 'Matching…' : 'Find my matches →'}
          </button>
        )}
        {busy && !usePaste && <div className="loading"><div className="spinner" /><p>Reading resume…</p></div>}
      </div>

      <div className="card">
        <h2>🔒 Privacy</h2>
        <p className="muted" style={{ margin: 0 }}>
          Your resume never leaves this browser. No uploads, no servers, no storage —
          matching happens entirely on your machine.
        </p>
      </div>
    </div>
  );
}
