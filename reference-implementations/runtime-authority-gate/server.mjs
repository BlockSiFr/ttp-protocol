import http from 'node:http';
import crypto from 'node:crypto';

const PORT = process.env.PORT || 8080;
const grants = new Map();
const receipts = [];

const seedGrant = {
  grantId: 'grant-local-001',
  expiresAt: '2030-01-01T00:00:00Z',
  scope: ['github.workflow.run:org/repo', 'pipeline.deploy:prod']
};
grants.set(seedGrant.grantId, seedGrant);

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function evaluateTrust(request) {
  const trustScore = Number(request.context?.trustScore ?? 0);

  if (!request.authorityGrant) {
    return { decision: 'ESCALATE', reason: 'Missing AuthorityGrant', constraints: ['require-grant'] };
  }

  const grant = grants.get(request.authorityGrant.grantId);
  if (!grant) {
    return { decision: 'DENY', reason: 'Unknown AuthorityGrant', constraints: ['request-new-grant'] };
  }

  const now = Date.now();
  if (Date.parse(grant.expiresAt) <= now) {
    return { decision: 'DENY', reason: 'AuthorityGrant expired', constraints: ['renew-grant'] };
  }

  const requestedScope = `${request.action}:${request.resource?.id ?? 'unknown'}`;
  if (!grant.scope.includes(requestedScope)) {
    return { decision: 'CONSTRAIN', reason: 'Scope mismatch', constraints: ['limit-to-grant-scope'] };
  }

  if (trustScore < 0.4) {
    return { decision: 'DENY', reason: 'Trust below deny threshold', constraints: ['halt-action'] };
  }

  if (trustScore < 0.7) {
    return { decision: 'STEP_UP', reason: 'Trust requires additional assurance', constraints: ['require-human-approver'] };
  }

  return { decision: 'PERMIT', reason: 'Trust and grant validated', constraints: [] };
}

function buildReceipt(request, decisionResult) {
  const prevChainHash = receipts.length ? receipts[receipts.length - 1].chainHash : null;
  const timestamp = new Date().toISOString();
  const receiptId = crypto.randomUUID();

  const decisionPayload = {
    receiptId,
    requestId: request.requestId,
    decision: decisionResult.decision,
    reason: decisionResult.reason,
    timestamp,
    prevChainHash,
    evidenceDigest: crypto
      .createHash('sha256')
      .update(JSON.stringify({ principal: request.principal, action: request.action, resource: request.resource, context: request.context }))
      .digest('hex')
  };

  const chainHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(decisionPayload))
    .digest('hex');

  return { ...decisionPayload, chainHash };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    return json(res, 200, { status: 'ok', service: 'runtime-authority-gate' });
  }

  if (req.method === 'POST' && req.url === '/re/authorize') {
    try {
      const request = await readBody(req);
      const decisionResult = evaluateTrust(request);
      const receipt = buildReceipt(request, decisionResult);
      receipts.push(receipt);

      return json(res, 200, {
        decision: decisionResult.decision,
        reason: decisionResult.reason,
        constraints: decisionResult.constraints,
        receipt
      });
    } catch {
      return json(res, 400, { error: 'invalid_request' });
    }
  }

  return json(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
  console.log(`runtime-authority-gate listening on :${PORT}`);
});
