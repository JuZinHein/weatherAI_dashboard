import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

const PUBLIC_DIR = path.resolve(__dirname, 'public');
const FORECAST_DATA_DIR = path.resolve(PUBLIC_DIR, 'forecast_data');

// Bundled default storm alert (zip uploads override this in the browser)
app.get('/api/storm-alert', (_req, res) => {
  const alertPath = path.join(FORECAST_DATA_DIR, 'storm_alert.json');
  if (fs.existsSync(alertPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(alertPath, 'utf-8'));
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to parse storm_alert.json', details: e.message });
    }
  }
  return res.json({ alert_active: false, severity: 'NORMAL', max_sustained_wind_kmh: 0 });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: HOST,
        port: PORT,
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

  app.listen(PORT, HOST, () => {
    console.log(`[Server] FourCastNet showcase listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error]', err);
});
