/**
 * How a quiz pack is cut into shards, shared by the builder that writes them and the app that
 * reads them.
 *
 * A pack of ten thousand questions is fifteen megabytes, and the Train tab used to parse the whole
 * of it before it could show one question - three and a half seconds of frozen screen on a laptop,
 * and a great deal longer on a phone. So a pack is now a directory: an index of a few kilobytes that
 * says what each shard holds, and a hundred-odd shard files of about a hundred questions each. The
 * app reads the index, picks a shard that can serve the current filters, and fetches only that.
 *
 * WHICH SHARD A QUESTION LIVES IN is decided by hashing its id, and that choice is the reason this
 * file exists. The obvious alternatives both cost something real. A qid-to-shard map in the index
 * is ten thousand entries and about 160KB, which is most of the budget the sharding was meant to
 * save. Renaming questions after their shard would orphan every mistake card and log entry already
 * sitting in somebody's browser, because those store the pack and the question id. Hashing keeps
 * the id exactly as it was - the run's `game:hand:decision` - and lets the Review tab find the shard
 * for a stored card from the id and one integer in the index, with nothing to look up.
 *
 * The cost is that shards are about a hundred questions each rather than exactly a hundred, which
 * nothing depends on.
 *
 * Both sides must agree on the hash, so it lives here and nowhere else. The pack index records the
 * modulus it was built with, and a reader must use THAT rather than counting the shards it can see:
 * a cut-down build (the single-file page) lists only the shards it carries, and a stored card's
 * shard is still where the full build put it.
 */

/** the shard a question id lands in, for a pack cut into `modulo` shards - FNV-1a, 32 bit */
export function shardOf(qid: string, modulo: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < qid.length; i++) {
    h ^= qid.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % modulo;
}

/** the file a shard is written to, inside the pack's directory: `000.json`, `001.json`, ... */
export const shardFile = (shard: number): string => `${String(shard).padStart(3, '0')}.json`;

/** what the index says about one shard, enough to know whether it can serve a filter without fetching it */
export interface ShardIx {
  file: string;
  /** questions in the shard */
  n: number;
  /** questions by decision kind - `discard`, `claim`, `self` */
  kinds: Record<string, number>;
  /** questions by the cause their seat's own throw showed, for the ones that were a real mistake */
  causes: Record<string, number>;
}

/** `quiz/<pack>/index.json` - the second index, inside the pack; `quiz/index.json` lists the packs */
export interface PackIndex {
  run: string;
  money: boolean;
  unit: string;
  table: { wildcards: number; minimumTai: number };
  questions: number;
  /** how question ids were assigned to shards; `modulo` is what `shardOf` must be called with */
  placement: { by: 'fnv1a32'; modulo: number };
  shards: ShardIx[];
}
