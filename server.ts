import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Dedicated local-showcase port — keep away from the normal app on :3000
const PORT = Number(process.env.PORT) || 5180;
const HOST = '0.0.0.0';
const ZARR_API_PORT = Number(process.env.ZARR_API_PORT) || 8767;
const ZARR_API_ORIGIN = `http://127.0.0.1:${ZARR_API_PORT}`;

let zarrChild: ChildProcess | null = null;

function probeZarrApi(): Promise<'unavailable' | 'compatible' | 'foreign'> {
  return new Promise((resolve) => {
    const req = http.get(`${ZARR_API_ORIGIN}/api/health`, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        if ((res.statusCode || 500) >= 500) {
          resolve('unavailable');
          return;
        }
        try {
          const health = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
            project_root?: string;
          };
          resolve(
            health.project_root && path.resolve(health.project_root).toLowerCase() === __dirname.toLowerCase()
              ? 'compatible'
              : 'foreign',
          );
        } catch {
          resolve('foreign');
        }
      });
    });
    req.on('error', () => resolve('unavailable'));
    req.setTimeout(800, () => {
      req.destroy();
    });
  });
}

async function startZarrSidecar() {
  const apiStatus = await probeZarrApi();
  if (apiStatus === 'compatible') {
    console.log(`[zarr-api] Already running at ${ZARR_API_ORIGIN}`);
    return;
  }
  if (apiStatus === 'foreign') {
    throw new Error(
      `Port ${ZARR_API_PORT} is serving a different or incompatible Zarr API. ` +
      'Stop that service or set ZARR_API_PORT to an unused port.',
    );
  }
  const script = path.resolve(__dirname, 'backend', 'zarr_field_server.py');
  const venvPython = process.platform === 'win32'
    ? path.resolve(__dirname, '.venv', 'Scripts', 'python.exe')
    : path.resolve(__dirname, '.venv', 'bin', 'python');
  const py = process.env.PYTHON || (existsSync(venvPython) ? venvPython : 'python');
  console.log(`[zarr-api] Starting ${py} ${script} on :${ZARR_API_PORT}`);
  zarrChild = spawn(py, [script], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ZARR_API_PORT: String(ZARR_API_PORT) },
  });
  zarrChild.stdout?.on('data', (buf) => {
    process.stdout.write(`[zarr-api] ${buf}`);
  });
  zarrChild.stderr?.on('data', (buf) => {
    process.stderr.write(`[zarr-api] ${buf}`);
  });
  zarrChild.on('exit', (code, signal) => {
    console.warn(`[zarr-api] exited code=${code} signal=${signal}`);
    zarrChild = null;
  });
}

function proxyToZarr(req: express.Request, res: express.Response) {
  // Use originalUrl so this works whether or not Express has stripped the mount path.
  const original = req.originalUrl || req.url || '/api/zarr';
  const suffix = original.replace(/^\/api\/zarr/, '') || '/';
  const targetPath = `/api${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
  const opts: http.RequestOptions = {
    hostname: '127.0.0.1',
    port: ZARR_API_PORT,
    path: targetPath,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${ZARR_API_PORT}` },
  };

  const upstream = http.request(opts, (up) => {
    res.status(up.statusCode || 502);
    for (const [k, v] of Object.entries(up.headers)) {
      if (v != null) res.setHeader(k, v);
    }
    up.pipe(res);
  });
  upstream.on('error', (err) => {
    res.status(503).json({
      error: 'Zarr field API unavailable',
      detail: String(err.message || err),
      hint: `Start backend/zarr_field_server.py on port ${ZARR_API_PORT}, with supported stores under models/.`,
    });
  });
  req.pipe(upstream);
}

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  // Proxy before Vite so /api/zarr/* never falls through to the SPA
  app.use('/api/zarr', proxyToZarr);

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: HOST,
        port: PORT,
        watch: {
          ignored: ['**/*.zarr/**'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  if (process.env.SKIP_ZARR_SIDECAR !== '1') {
    await startZarrSidecar();
  }

  const httpServer = app.listen(PORT, HOST, () => {
    console.log(`[LOCAL showcase] Open http://localhost:${PORT}  (normal app stays on :3000)`);
    console.log(`[LOCAL showcase] Zarr API proxied at /api/zarr/* → ${ZARR_API_ORIGIN}`);
  });
  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    console.error(`[Server] Failed to listen on ${PORT}: ${err.message}`);
    process.exit(1);
  });
}

const shutdown = () => {
  if (zarrChild && !zarrChild.killed) {
    zarrChild.kill();
  }
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer().catch((err) => {
  console.error('[Server Error]', err);
});
