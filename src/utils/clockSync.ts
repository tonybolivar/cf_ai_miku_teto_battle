/** Estimates clock offset between client and server using ping/pong */
export async function estimateClockOffset(ws: WebSocket, samples = 3): Promise<number> {
  const offsets: number[] = [];

  for (let i = 0; i < samples; i++) {
    const offset = await singlePing(ws);
    offsets.push(offset);
    // Small delay between samples
    if (i < samples - 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // Return median offset
  offsets.sort((a, b) => a - b);
  return offsets[Math.floor(offsets.length / 2)];
}

function singlePing(ws: WebSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const timeout = setTimeout(() => reject(new Error("Ping timeout")), 3000);

    const handler = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "pong" && msg.t0 === t0) {
          clearTimeout(timeout);
          ws.removeEventListener("message", handler);
          const t2 = Date.now();
          const latency = (t2 - t0) / 2;
          const offset = msg.t1 - (t0 + latency);
          resolve(offset);
        }
      } catch { /* ignore non-JSON */ }
    };

    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ type: "ping", t0 }));
  });
}
