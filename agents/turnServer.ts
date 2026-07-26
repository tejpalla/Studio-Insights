/**
 * Stateless HTTP agent sidecar for Docker Compose isolation.
 * POST /turn { TurnRequest } → TurnResponse
 * Each request is isolated: only the persona in that payload is used.
 */

import express from 'express';
import dotenv from 'dotenv';
import { generateArenaTurnJson } from '../src/lib/arenaLlm.ts';
import type { TurnRequest, TurnResponse } from '../src/lib/agentProtocol.ts';

dotenv.config();

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.AGENT_PORT || 4101);
const AGENT_NAME = process.env.AGENT_NAME || `agent-${process.pid}`;

app.get('/health', (_req, res) => {
  res.json({ ok: true, role: 'arena-agent', name: AGENT_NAME });
});

app.post('/turn', async (req, res) => {
  const body = req.body as TurnRequest;
  if (!body?.requestId || !body?.system || !body?.user || !body?.agent) {
    return res.status(400).json({ ok: false, error: 'Invalid TurnRequest' });
  }
  try {
    const rawJson = await generateArenaTurnJson(body.system, body.user);
    const out: TurnResponse = {
      requestId: body.requestId,
      ok: true,
      rawJson,
      isolation: 'http_container',
    };
    console.log(`[${AGENT_NAME}] turn ok u/${body.agent.username} r${body.round}`);
    return res.json(out);
  } catch (err: any) {
    const out: TurnResponse = {
      requestId: body.requestId,
      ok: false,
      error: err?.message || 'turn failed',
      isolation: 'http_container',
    };
    return res.status(500).json(out);
  }
});

app.listen(PORT, () => {
  console.log(`[${AGENT_NAME}] isolated agent listening on :${PORT}`);
});
