import path from 'node:path'
import { execFile } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'challenge-api',                    // dev-only: re-judge a quiz position with more play-outs (spawns the datagen evaluator)
    configureServer(server) {
      server.middlewares.use('/api/challenge', (req, res) => {
        const u = new URL(req.url ?? '', 'http://localhost');
        const run = (u.searchParams.get('run') ?? '').replace(/[^\w.-]/g, '');
        const id = (u.searchParams.get('id') ?? '').replace(/[^\d:]/g, '');
        const hand = (u.searchParams.get('hand') ?? '').replace(/[^\d,]/g, '');
        const rollouts = String(Math.min(2048, Number(u.searchParams.get('rollouts') ?? 512)));
        const datagen = path.resolve(__dirname, '../datagen');
        execFile('npx', ['tsx', 'src/challenge.ts', '--dir', `../data/gen/${run}`, '--id', id, '--hand', hand, '--rollouts', rollouts],
          { cwd: datagen, timeout: 180000, maxBuffer: 10 << 20 }, (err, stdout) => {
            res.setHeader('content-type', 'application/json');
            if (err && !stdout) { res.statusCode = 500; res.end(JSON.stringify({ error: String(err) })); return; }
            const line = stdout.trim().split('\n').pop() ?? '{}';
            res.end(line);
          });
      });
    },
  }],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { fs: { allow: ['..'] } },
})
