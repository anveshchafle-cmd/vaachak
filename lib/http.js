const CORS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function binary(body, contentType) {
  return new Response(body, {
    status: 200,
    headers: { ...CORS, 'Content-Type': contentType, 'Cache-Control': 'no-store' },
  });
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

// Wraps a handler so every failure comes back as { error, code } JSON with CORS headers.
export function handle(fn) {
  return async (req) => {
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
      console.error(e);
      return json({ error: 'Something went wrong on the server', code: 'INTERNAL' }, 500);
    }
  };
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'BAD_JSON', 'Request body must be valid JSON');
  }
}

export function isMultipart(req) {
  return (req.headers.get('content-type') || '').includes('multipart/form-data');
}

export function parseJsonField(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
