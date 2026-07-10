import { NextRequest } from 'next/server';
import { EventEmitter } from 'events';

const emitter = new EventEmitter();

export function sendSSEEvent(data: any) {
  emitter.emit('message', JSON.stringify(data));
}

export async function GET(req: NextRequest) {
  let controller: ReadableStreamDefaultController | null = null;
  let isClosed = false;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
      const listener = (data: string) => {
        if (!isClosed && controller) {
          try {
            controller.enqueue(`data: ${data}\n\n`);
          } catch {
            // If enqueue fails, the stream is probably closed
            isClosed = true;
            emitter.off('message', listener);
          }
        }
      };

      emitter.on('message', listener);

      // Send initial connection message
      try {
        controller.enqueue(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connected' })}\n\n`);
      } catch {
        isClosed = true;
      }

      // Clean up when the request is aborted (client disconnects)
      req.signal.addEventListener('abort', () => {
        isClosed = true;
        emitter.off('message', listener);
        if (controller) {
          try {
            controller.close();
          } catch {}
          controller = null;
        }
      });
    },
    cancel() {
      isClosed = true;
      controller = null;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

export { emitter };
