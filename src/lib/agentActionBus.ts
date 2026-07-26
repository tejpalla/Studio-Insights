/**
 * In-memory ActionBus: turn_request → turn_result.
 * Used for observability; WorkerPool is the real dispatcher.
 */

import type { TurnRequest, TurnResponse } from './agentProtocol';

type BusListener = (event: { kind: 'turn_request' | 'turn_result'; payload: TurnRequest | TurnResponse }) => void;

const listeners = new Set<BusListener>();

export function subscribeActionBus(fn: BusListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(kind: 'turn_request' | 'turn_result', payload: TurnRequest | TurnResponse) {
  for (const fn of listeners) {
    try {
      fn({ kind, payload });
    } catch {
      /* ignore */
    }
  }
}

export function busTurnRequest(req: TurnRequest) {
  emit('turn_request', req);
}

export function busTurnResult(res: TurnResponse) {
  emit('turn_result', res);
}
