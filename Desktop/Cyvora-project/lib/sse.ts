import { EventEmitter } from 'events';

export const sseEmitter = new EventEmitter();

export function sendSSEEvent(data: unknown) {
  sseEmitter.emit('message', JSON.stringify(data));
}
