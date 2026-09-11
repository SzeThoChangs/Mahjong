import path from 'node:path'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Where the site will live. "/" for a dev server and for a host that serves it at a domain root;
  // set BASE_PATH=/which-tile/ for a host that puts it under a folder, such as a GitHub Pages
  // project site. Everything the app fetches or shows goes through `lib/asset.ts`, which reads it.
  base: process.env.BASE_PATH ?? '/',
  build: {
    // Every file the build emits, by name, at dist/files.json. The service worker reads it at
    // install to cache the tabs that load on demand, which index.html does not name. A plain name
    // rather than Vite's `.vite/manifest.json`: a directory starting with a dot is the kind of
    // thing a static host may decline to serve, and the worker would fail quietly without it.
    manifest: 'files.json',
    // SINGLE_FILE=1 folds the on-demand tabs back into the one script, for tools/singlefile.mjs:
    // a page opened from a phone's downloads has no server to fetch a second file from.
    rollupOptions: process.env.SINGLE_FILE ? { output: { inlineDynamicImports: true } } : {},
  },
  plugins: [react(), tailwindcss(), {
    name: 'list-workers',
    /**
     * A Web Worker's chunk is not in the manifest Vite writes. The service worker precaches the
     * bundle from that list, so without this the Challenge button's play-outs would be the one
     * part of the app a phone could not use offline until it had pressed the button once on wifi.
     * The chunk is named `<name>.worker-<hash>.js`, and it goes in as another entry, in the shape
     * the service worker already reads.
     */
    closeBundle() {
      const dist = path.resolve(__dirname, 'dist');
      const manifest = path.join(dist, 'files.json');
      if (!existsSync(manifest)) return;                   // a build that wrote no manifest has nothing to add to
      const files = JSON.parse(readFileSync(manifest, 'utf8')) as Record<string, { file: string }>;
      for (const f of readdirSync(path.join(dist, 'assets')).filter((n) => /\.worker-[\w-]+\.js$/.test(n))) {
        const name = f.replace(/-[\w-]+\.js$/, '');
        files[`worker:${name}`] = { file: `assets/${f}`, name, isWorker: true } as { file: string };
      }
      writeFileSync(manifest, JSON.stringify(files, null, 2));
    },
  }, {
    name: 'stamp-sw',                         // the worker's bytes must change with the bundle's, or a phone never learns of a deploy
    closeBundle() {
      // A hash of the emitted file names, which Vite already hashes by content, so any change to
      // the app changes the stamp. The public directory has been copied to dist by this point.
      const dist = path.resolve(__dirname, 'dist');
      const stamp = createHash('sha1').update(readdirSync(path.join(dist, 'assets')).sort().join('\n')).digest('hex').slice(0, 8);
      const sw = path.join(dist, 'sw.js');
      const src = readFileSync(sw, 'utf8');
      if (!src.includes("const BUILD = 'dev';")) throw new Error('public/sw.js has no BUILD line to stamp');
      writeFileSync(sw, src.replace("const BUILD = 'dev';", `const BUILD = '${stamp}';`));
    },
  }],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // The repo path contains a ':' ("My Games:Learn"), which Vite's file-serving allow list cannot
  // match - it resolves the allow root to the repo correctly and then still refuses a file inside
  // it with a 403. `strict: false` turns the check off for the dev server, which is local-only.
  server: { fs: { allow: ['..'], strict: false } },
})
