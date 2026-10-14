'use client';

import { useState } from 'react';
import { getApiKey, setApiKey } from '../../lib/ai';

// Modal that collects the user's free Gemini API key. The key is stored only
// in this browser's localStorage and is sent only to Google's API.
export default function KeyModal({ onClose, onSaved }) {
  const [key, setKey] = useState(getApiKey());
  const [err, setErr] = useState('');

  function save() {
    if (!key.trim()) { setErr('Paste your API key first.'); return; }
    setApiKey(key);
    onSaved(key.trim());
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>✨ Enable AI deep read</h2>
        <p className="muted">
          Paste a free Gemini API key. Get one in a minute here:{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>
        </p>
        <input
          type="password"
          placeholder="AIza…"
          value={key}
          onChange={(e) => { setKey(e.target.value); setErr(''); }}
          style={{ width: '100%', marginBottom: 8 }}
        />
        {err && <p style={{ color: '#dc2626', fontSize: 13 }}>{err}</p>}
        <p className="muted" style={{ fontSize: 12 }}>
          Your key stays in this browser only. Requests go straight from your browser to Google's API —
          your resume is never uploaded to any other server.
        </p>
        <div className="action-row">
          <button className="btn small" onClick={save}>Save &amp; continue</button>
          <button className="btn small secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
