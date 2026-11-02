import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json());

const PUBLIC_DIR = path.resolve(__dirname, 'public');
const FORECAST_DATA_DIR = path.resolve(PUBLIC_DIR, 'forecast_data');

let pipelineRunning = false;
let lastPipelineOutput = 'Pipeline ready for scheduled execution.';
let lastPipelineRunTime: string | null = null;
let activeNgcKey = process.env.NGC_API_KEY || '';

// API: Get forecast config
app.get('/api/forecast-config', (_req, res) => {
  const configPath = path.join(FORECAST_DATA_DIR, 'forecast_config.json');
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to parse forecast_config.json', details: e.message });
    }
  }
  return res.status(404).json({ error: 'forecast_config.json not found' });
});

// API: Get storm alert
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

// API: Toggle/simulate Cyclone Warning in Bay of Bengal for live testing
app.post('/api/storm-alert/simulate', (req, res) => {
  const { enableCyclone } = req.body;
  const alertPath = path.join(FORECAST_DATA_DIR, 'storm_alert.json');

  const simulated = {
    alert_active: Boolean(enableCyclone),
    severity: enableCyclone ? 'CYCLONIC_STORM' : 'NORMAL_MONSOON',
    region: 'Bay of Bengal & Coastal Myanmar (Rakhine/Ayeyarwady)',
    region_mm: 'ဘင်္ဂလားပင်လယ်အော်နှင့် မြန်မာ့ကမ်းရိုးတန်း ရေပြင်',
    max_sustained_wind_kmh: enableCyclone ? 78.4 : 24.0,
    threshold_kmh: 65.0,
    coordinates: {
      lat: 15.75,
      lon: 93.25,
    },
    timestamp: new Date().toISOString(),
    lead_hour: 18,
    advisory_en: enableCyclone
      ? 'Cyclone Warning: Sustained winds in the Bay of Bengal exceed 65 km/h (measured 78.4 km/h). Deep depression approaching Ayeyarwady & Rakhine coast. Coastal navigation must cease.'
      : 'Bay of Bengal wind conditions are within normal limits (below 65 km/h threshold).',
    advisory_mm: enableCyclone
      ? 'ဆိုင်ကလုန်းမုန်တိုင်း အရေးပေါ် သတိပေးချက် - ဘင်္ဂလားပင်လယ်အော်တွင် လေတိုက်နှုန်း ၆၅ ကီလိုမီတာ/နာရီကျော် (အမြင့်ဆုံး ၇၈.၄ km/h) ဖြင့် မုန်တိုင်းငယ်စတင်ဖြစ်ပေါ်နေသဖြင့် ကမ်းရိုးတန်းနှင့် ပင်လယ်ပြင် ရေယာဉ်များ ချက်ချင်းတိမ်းရှောင်ကြပါရန်။'
      : 'ဘင်္ဂလားပင်လယ်အော် လေတိုက်နှုန်းမှာ ပုံမှန်အခြေအနေတွင် ရှိပါသည် (၆၅ ကီလိုမီတာ/နာရီအောက်)။',
    generated_at: new Date().toISOString(),
  };

  fs.writeFileSync(alertPath, JSON.stringify(simulated, null, 2), 'utf-8');
  return res.json({ success: true, alert: simulated });
});

// API: Pipeline status
app.get('/api/pipeline/status', (_req, res) => {
  return res.json({
    running: pipelineRunning,
    lastRun: lastPipelineRunTime,
    lastOutput: lastPipelineOutput,
    hasApiKey: Boolean(activeNgcKey || process.env.NGC_API_KEY),
    scheduleInterval: 'Every 6 Hours (03:30, 09:30, 15:30, 21:30 UTC)',
    nimEndpoint: 'https://ai.api.nvidia.com/v1/genai/nvidia/fourcastnet-v2',
  });
});

// API: Set NGC API Key dynamically
app.post('/api/pipeline/set-key', (req, res) => {
  const { apiKey } = req.body;
  if (apiKey && typeof apiKey === 'string') {
    activeNgcKey = apiKey.trim();
    process.env.NGC_API_KEY = activeNgcKey;
    return res.json({ success: true, message: 'NGC API Key successfully configured for FourCastNet pipeline.' });
  }
  return res.status(400).json({ error: 'Valid apiKey string required.' });
});

// API: Trigger Pipeline Run
app.post('/api/pipeline/trigger', async (req, res) => {
  if (pipelineRunning) {
    return res.status(409).json({ error: 'Pipeline is already executing.' });
  }

  const { simulateCyclone } = req.body;
  pipelineRunning = true;
  lastPipelineOutput = 'Pipeline initiated...';

  // Execute pipeline
  const pythonScript = path.resolve(__dirname, 'backend', 'fourcastnet_pipeline.py');
  const tsScript = path.resolve(__dirname, 'scripts', 'generate_layers.ts');

  const runProcess = () => {
    return new Promise<{ success: boolean; output: string }>((resolve) => {
      // Check if python3 is available
      const args = [pythonScript];
      if (simulateCyclone) args.push('--simulate-cyclone');
      if (activeNgcKey) args.push('--api-key', activeNgcKey);

      let stdout = '';
      let stderr = '';

      const proc = spawn('python3', args, {
        cwd: __dirname,
        env: { ...process.env, NGC_API_KEY: activeNgcKey },
      });

      proc.stdout?.on('data', (d) => {
        stdout += d.toString();
      });
      proc.stderr?.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('error', () => {
        // Fallback to tsx script
        const fallback = spawn('npx', ['tsx', tsScript], { cwd: __dirname });
        let fbOut = '';
        fallback.stdout?.on('data', (d) => {
          fbOut += d.toString();
        });
        fallback.on('close', (code) => {
          resolve({ success: code === 0, output: fbOut });
        });
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          // If python failed, run TypeScript generator fallback
          const fallback = spawn('npx', ['tsx', tsScript], { cwd: __dirname });
          let fbOut = '';
          fallback.stdout?.on('data', (d) => {
            fbOut += d.toString();
          });
          fallback.on('close', () => {
            resolve({ success: true, output: stdout + '\n' + fbOut });
          });
        }
      });
    });
  };

  try {
    const result = await runProcess();
    lastPipelineRunTime = new Date().toISOString();
    lastPipelineOutput = result.output;
    pipelineRunning = false;
    return res.json({
      success: true,
      output: result.output,
      executedAt: lastPipelineRunTime,
    });
  } catch (err: any) {
    pipelineRunning = false;
    lastPipelineOutput = `Pipeline error: ${err.message}`;
    return res.status(500).json({ error: err.message });
  }
});

// In development, integrate Vite middlewares
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
    console.log(`[Server] NVIDIA FourCastNet server listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error]', err);
});
