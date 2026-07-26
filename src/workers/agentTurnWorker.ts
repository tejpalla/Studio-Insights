/**
 * Worker-thread entry for one isolated agent turn.
 * Built to dist/agentTurnWorker.cjs — no shared SubState, only TurnRequest.
 */

import { parentPort, workerData } from 'worker_threads';
import { generateArenaTurnJson } from '../lib/arenaLlm';
import type { TurnRequest, TurnResponse } from '../lib/agentProtocol';

async function main() {
  const data = workerData as { type: string; request: TurnRequest };
  if (!parentPort || data?.type !== 'turn' || !data.request) {
    throw new Error('Invalid worker payload');
  }
  const req = data.request;
  try {
    const rawJson = await generateArenaTurnJson(req.system, req.user);
    const res: TurnResponse = {
      requestId: req.requestId,
      ok: true,
      rawJson,
      isolation: 'worker_thread',
    };
    parentPort.postMessage(res);
  } catch (err: any) {
    const res: TurnResponse = {
      requestId: req.requestId,
      ok: false,
      error: err?.message || 'worker turn failed',
      isolation: 'worker_thread',
    };
    parentPort.postMessage(res);
  }
}

main();
