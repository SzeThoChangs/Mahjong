/** JSONL.gz shard writer: buffers lines, gzips in chunks (multi-member gzip is valid), appends synchronously. */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname } from 'node:path';

export class JsonlGzWriter {
  private buf: string[] = []; private bytes = 0; lines = 0;
  constructor(readonly path: string, private chunkBytes = 4 << 20) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, ''); }
  write(obj: unknown) { const s = JSON.stringify(obj) + '\n'; this.buf.push(s); this.bytes += s.length; this.lines++; if (this.bytes >= this.chunkBytes) this.flush(); }
  flush() { if (!this.buf.length) return; appendFileSync(this.path, gzipSync(this.buf.join(''), { level: 4 })); this.buf = []; this.bytes = 0; }
  close() { this.flush(); }
}
