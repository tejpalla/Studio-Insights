/**
 * Isolated agent turn dispatcher.
 * Modes (ARENA_ISOLATION): auto | http | worker | inline
 * auto: http if ARENA_AGENT_URLS set, else worker if ARENA_USE_WORKERS=1, else inline
 */

import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import type { TurnRequest, TurnResponse } from './agentProtocol';
import { busTurnRequest, busTurnResult } from './agentActionBus';
import { generateArenaTurnJson } from './arenaLlm';

export type IsolationMode = 'auto' | 'http' | 'worker' | 'inline';

function resolveMode(): IsolationMode {
  const raw = (process.env.ARENA_ISOLATION || 'auto').trim().toLowerCase();
  if (raw === 'http' || raw === 'worker' || raw === 'inline') return raw;
  return 'auto';
}

function agentUrls(): string[] {
  return (process.env.ARENA_AGENT_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function workerScriptPath(): string {
  return path.join(process.cwd(), 'dist', 'agentTurnWorker.cjs');
}

let rr = 0;

async function turnViaHttp(req: TurnRequest): Promise<TurnResponse> {
  const urls = agentUrls();
  if (!urls.length) throw new Error('ARENA_AGENT_URLS empty');
  const base = urls[rr++ % urls.length].replace(/\/$/, '');
  const res = await fetch(`${base}/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Agent HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as TurnResponse;
  return { ...data, isolation: 'http_container' };
}

async function turnViaWorker(req: TurnRequest): Promise<TurnResponse> {
  const script = workerScriptPath();
  if (!fs.existsSync(script)) {
    throw new Error(`Worker script missing at ${script} — run npm run build`);
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(script, {
      workerData: { type: 'turn', request: req },
    });
    const timer = setTimeout(() => {
      worker.terminate().catch(() => undefined);
      reject(new Error('Agent worker timeout'));
    }, 120_000);

    worker.on('message', (msg: TurnResponse) => {
      clearTimeout(timer);
      worker.terminate().catch(() => undefined);
      resolve({ ...msg, isolation: 'worker_thread' });
    });
    worker.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    worker.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`Agent worker exited ${code}`));
    });
  });
}

async function turnInline(req: TurnRequest): Promise<TurnResponse> {
  try {
    const rawJson = await generateArenaTurnJson(req.system, req.user);
    return { requestId: req.requestId, ok: true, rawJson, isolation: 'inline' };
  } catch (err: any) {
    return {
      requestId: req.requestId,
      ok: false,
      error: err?.message || 'inline turn failed',
      isolation: 'inline',
    };
  }
}

/** Run one isolated agent turn — only that agent's persona is in the prompt. */
export async function dispatchIsolatedTurn(req: TurnRequest): Promise<TurnResponse> {
  busTurnRequest(req);
  const mode = resolveMode();
  const urls = agentUrls();

  let res: TurnResponse;
  try {
    if (mode === 'http' || (mode === 'auto' && urls.length > 0)) {
      res = await turnViaHttp(req);
    } else if (mode === 'worker' || (mode === 'auto' && process.env.ARENA_USE_WORKERS === '1')) {
      try {
        res = await turnViaWorker(req);
      } catch (err: any) {
        console.warn('Worker turn failed, inline fallback:', err?.message || err);
        res = await turnInline(req);
      }
    } else {
      res = await turnInline(req);
    }
  } catch (err: any) {
    console.warn('Isolated turn failed, inline fallback:', err?.message || err);
    res = await turnInline(req);
  }

  busTurnResult(res);
  return res;
}

export function isolationStatus(): {
  mode: string;
  agentUrls: string[];
  useWorkers: boolean;
} {
  return {
    mode: resolveMode(),
    agentUrls: agentUrls(),
    useWorkers: process.env.ARENA_USE_WORKERS === '1',
  };
}
