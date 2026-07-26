import React, { useRef, useState } from 'react';
import { DropOffInsight } from '../../types';

export const DropOffPanel: React.FC<{
  existing?: DropOffInsight | null;
  onParsed: (dropOff: DropOffInsight | null) => void;
}> = ({ existing, onParsed }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const text = await file.text();
      const rows = parseRetentionCsv(text);
      if (rows.length < 2) {
        throw new Error('Need at least two rows of minute,retention');
      }
      const res = await fetch('/api/dropoff-from-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'CSV parse failed');
      onParsed(data.dropOff);
    } catch (err: any) {
      setError(err.message || 'Failed to read CSV');
      onParsed(null);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section className="border border-line rounded-lg bg-white/80 p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Drop-off (optional)</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Upload your retention CSV — captioned as your data, not a platform forecast.
          </p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border border-line text-ink-muted">
          Your data
        </span>
      </div>

      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      <button
        type="button"
        disabled={loading}
        onClick={() => fileRef.current?.click()}
        className="text-sm px-3 py-1.5 border border-line rounded hover:bg-paper-2 disabled:opacity-50"
      >
        {loading ? 'Reading…' : 'Upload retention CSV'}
      </button>
      <p className="text-[11px] text-ink-muted">
        Format: minute,retention (header optional). Try{' '}
        <a className="text-accent underline" href="/sample-retention.csv" download>
          sample-retention.csv
        </a>
        .
      </p>

      {error && <p className="text-sm text-amber-800">{error}</p>}

      {existing && (
        <div className="text-sm space-y-1 pt-2 border-t border-line">
          <p className="text-ink">
            Dip at minute <strong>{existing.dipMinute}</strong> · retention{' '}
            <strong>{existing.retentionAtDip}</strong>
          </p>
          <p className="text-ink-muted">{existing.linkedBeat}</p>
          <p className="text-ink-muted">{existing.reason}</p>
        </div>
      )}
    </section>
  );
};

function parseRetentionCsv(text: string): Array<{ minute: number; retention: number }> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: Array<{ minute: number; retention: number }> = [];
  for (const line of lines) {
    if (/minute/i.test(line) && /retention/i.test(line)) continue;
    const parts = line.split(/[,;\t]/).map((p) => p.trim());
    if (parts.length < 2) continue;
    const minute = Number(parts[0]);
    const retention = Number(parts[1]);
    if (Number.isFinite(minute) && Number.isFinite(retention)) {
      rows.push({ minute, retention });
    }
  }
  return rows;
}
