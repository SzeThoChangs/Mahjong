import path from 'node:path'
import { execFile } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Where the site will live. "/" for a dev server and for a host that serves it at a domain root;
  // set BASE_PATH=/which-tile/ for a host that puts it under a folder, such as a GitHub Pages
  // project site. Everything the app fetches or shows goes through `lib/asset.ts`, which reads it.
  base: process.env.BASE_PATH ?? '/',
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
        // tsx by its real path, not through npx: the repo path contains a ':' and npm refuses to
        // put .bin on PATH for it, so `npx tsx` answered "tsx: command not found" and every
        // challenge was a 500.
        const tsx = path.join(datagen, 'node_modules/tsx/dist/cli.mjs');
        execFile(process.execPath, [tsx, 'src/challenge.ts', '--dir', `../data/gen/${run}`, '--id', id, '--hand', hand, '--rollouts', rollouts],
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
  // The repo path contains a ':' ("My Games:Learn"), which Vite's file-serving allow list cannot
  // match - it resolves the allow root to the repo correctly and then still refuses a file inside
  // it with a 403. `strict: false` turns the check off for the dev server, which is local-only.
  server: { fs: { allow: ['..'], strict: false } },
})
