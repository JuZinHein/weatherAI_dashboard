import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const venvPython = process.platform === 'win32'
  ? path.join(root, '.venv', 'Scripts', 'python.exe')
  : path.join(root, '.venv', 'bin', 'python');
const python = process.env.PYTHON || (existsSync(venvPython) ? venvPython : 'python');
const server = spawn(python, [path.join(root, 'backend', 'zarr_field_server.py')], {
  cwd: root,
  env: { ...process.env, ZARR_API_PORT: process.env.ZARR_API_PORT || '8767' },
  stdio: 'inherit',
});

server.on('error', (error) => {
  console.error(`Failed to start Zarr API with "${python}": ${error.message}`);
  process.exitCode = 1;
});

server.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
