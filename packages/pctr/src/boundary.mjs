import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { verifyAuthority, createReplayStore } from './authority.mjs';

// THE EFFECT BOUNDARY.
// The requesting agent must not be trusted to enforce its own authority, so the check
// belongs somewhere the agent does not control: a separate process that holds the
// replay state and the list of signers it will accept.

// Spent nonces must survive a restart, or replay protection lasts only as long as uptime.
export function persistentReplayStore(file) {
  let spent = new Set();
  try { spent = new Set(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { /* first run */ }
  const flush = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify([...spent]));
  };
  return {
    seen: (nonce) => spent.has(nonce),
    spend: (nonce) => { spent.add(nonce); flush(); },
    list: () => [...spent]
  };
}

export function createBoundary({ trustedKeyIds, publicKey, replayStore = createReplayStore(), name = 'pctr.effect-boundary' } = {}) {
  return {
    name,
    verify(authority, execution, { now } = {}) {
      const result = verifyAuthority(authority, execution, { now, publicKey, trustedKeyIds, replayStore });
      return { ...result, boundary: name, verifiedAt: result.verifiedAt ?? new Date().toISOString() };
    },
    replayStore
  };
}

export function startBoundaryServer({ port = 8787, host = '127.0.0.1', boundary = createBoundary(), onDecision } = {}) {
  const server = http.createServer((req, res) => {
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET' && req.url === '/health') {
      return send(200, { ok: true, boundary: boundary.name, spentNonces: boundary.replayStore.list().length });
    }
    if (req.method !== 'POST' || req.url !== '/verify') return send(404, { error: 'POST /verify or GET /health' });

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy(); // an authority is small; anything larger is not one
    });
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch { return send(400, { error: 'invalid JSON' }); }
      const { authority, execution } = parsed ?? {};
      if (!execution) return send(400, { error: 'execution is required: the boundary checks authority against what is actually about to run' });
      const decision = boundary.verify(authority, execution);
      onDecision?.(decision, { authority, execution });
      // A denial is a successful verification, so it is still 200 with a decision body.
      return send(200, decision);
    });
  });
  return new Promise((resolve) => {
    server.listen(port, host, () => resolve({ server, url: `http://${host}:${server.address().port}`, close: () => new Promise((r) => server.close(r)) }));
  });
}

// Client side. A network failure is never an allow: if the boundary cannot be reached,
// the execution is denied.
export function remoteBoundary(url, { timeoutMs = 5000 } = {}) {
  return {
    name: url,
    async verify(authority, execution) {
      try {
        const response = await fetch(`${url.replace(/\/$/, '')}/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ authority, execution }),
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (!response.ok) {
          return { allowed: false, decision: 'EXECUTION_DENIED', boundary: url, failures: [{ code: 'BOUNDARY_ERROR', message: `effect boundary returned ${response.status}` }] };
        }
        return { ...(await response.json()), boundary: url };
      } catch (error) {
        return { allowed: false, decision: 'EXECUTION_DENIED', boundary: url, failures: [{ code: 'BOUNDARY_UNREACHABLE', message: `effect boundary at ${url} could not be reached: ${error.message}` }] };
      }
    }
  };
}
