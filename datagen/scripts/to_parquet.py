#!/usr/bin/env python3
"""Convert a generator output directory (JSONL.gz shards) to Parquet.

  python scripts/to_parquet.py <out-dir> [--rows-per-file 500000]

Writes <out-dir>/parquet/decisions-*.parquet, hands.parquet, truth.parquet.
Decision records are flattened to columns; nested lists are kept as Parquet list
columns (tiles as int8 kinds, actions as strings). Features are kept as a JSON
string per row for now (they are per-candidate lists); promote to columns once the
feature set is frozen.
"""
import sys, json, gzip, glob, os
import pyarrow as pa, pyarrow.parquet as pq

def read_jsonl_gz(path):
    with gzip.open(path, 'rt', encoding='utf-8') as fh:
        for line in fh:
            if line.strip():
                yield json.loads(line)

DEC_SCHEMA = pa.schema([
    ('g', pa.int32()), ('h', pa.int16()), ('d', pa.int16()), ('seed', pa.int64()),
    ('k', pa.string()), ('t', pa.int16()), ('p', pa.int8()), ('dl', pa.int8()), ('w', pa.int8()),
    ('sc', pa.list_(pa.int32())), ('ch', pa.list_(pa.int32())), ('rem', pa.int16()),
    ('me_hand', pa.list_(pa.int8())), ('me_drawn', pa.int8()), ('me_bonus', pa.list_(pa.int8())), ('me_melds', pa.list_(pa.list_(pa.int8()))),
    ('pub_discards', pa.list_(pa.list_(pa.int16()))), ('pub_melds', pa.list_(pa.list_(pa.list_(pa.int8())))), ('pub_bonus', pa.list_(pa.list_(pa.int8()))),
    ('legal', pa.list_(pa.string())), ('sel', pa.string()), ('bot', pa.string()), ('features_json', pa.string()),
])
def dec_row(r):
    return {
        'g': r['g'], 'h': r['h'], 'd': r['d'], 'seed': r['seed'], 'k': r['k'], 't': r['t'], 'p': r['p'], 'dl': r['dl'], 'w': r['w'],
        'sc': r['sc'], 'ch': r['ch'], 'rem': r['rem'],
        'me_hand': r['me']['h'], 'me_drawn': -1 if r['me']['dr'] is None else r['me']['dr'], 'me_bonus': r['me']['b'], 'me_melds': r['me']['m'],
        'pub_discards': r['pub']['dl'], 'pub_melds': r['pub']['m'], 'pub_bonus': r['pub']['b'],
        'legal': r['legal'], 'sel': r['sel'], 'bot': r['bot'], 'features_json': json.dumps(r['f'], separators=(',', ':')),
    }

def write_batches(rows_iter, schema, out_pattern, rows_per_file, row_fn):
    buf, n, part, total = [], 0, 0, 0
    def flush():
        nonlocal buf, part
        if not buf: return
        tbl = pa.Table.from_pylist(buf, schema=schema)
        pq.write_table(tbl, out_pattern % part, compression='zstd')
        part += 1; buf = []
    for r in rows_iter:
        buf.append(row_fn(r)); n += 1; total += 1
        if n >= rows_per_file: flush(); n = 0
    flush()
    return total, part

def main():
    d = sys.argv[1]; rpf = 500_000
    if '--rows-per-file' in sys.argv: rpf = int(sys.argv[sys.argv.index('--rows-per-file') + 1])
    os.makedirs(os.path.join(d, 'parquet'), exist_ok=True)
    dec_files = sorted(glob.glob(os.path.join(d, 'decisions-*.jsonl.gz')))
    def all_dec():
        for f in dec_files:
            yield from read_jsonl_gz(f)
    n, parts = write_batches(all_dec(), DEC_SCHEMA, os.path.join(d, 'parquet', 'decisions-%04d.parquet'), rpf, dec_row)
    print(f'decisions: {n} rows -> {parts} files')
    hands = [r for f in sorted(glob.glob(os.path.join(d, 'hands-*.jsonl.gz'))) for r in read_jsonl_gz(f)]
    for r in hands: r['acts'] = json.dumps(r['acts'], separators=(',', ':')); r['cnt'] = json.dumps(r['cnt'], separators=(',', ':'))
    if hands:
        pq.write_table(pa.Table.from_pylist(hands), os.path.join(d, 'parquet', 'hands.parquet'), compression='zstd'); print(f'hands: {len(hands)} rows')
    truth = [r for f in sorted(glob.glob(os.path.join(d, 'truth-*.jsonl.gz'))) for r in read_jsonl_gz(f)]
    if truth:
        pq.write_table(pa.Table.from_pylist(truth), os.path.join(d, 'parquet', 'truth.parquet'), compression='zstd'); print(f'truth: {len(truth)} rows')

    evals = [r for f in sorted(glob.glob(os.path.join(d, 'evals-*.jsonl.gz'))) for r in read_jsonl_gz(f)]
    if evals:
        rows = []
        for e in evals:
            for a in e['actions']:
                rows.append({'g': e['g'], 'h': e['h'], 'd': e['d'], 'k': e['k'], 't': e.get('t', -1), 'seat': e['seat'], 'bot': e['bot'], 'sel': e['sel'], 'mode': e['mode'], 'policy': e['policy'],
                             'action': a['a'], 'ev': a['ev'], 'sd': a['sd'], 'win': a['win'], 'dealin': a['dealin'], 'draw': a['draw'], 'n': a['n'], 'is_best': a['a'] == e['best'], 'is_selected': a['a'] == e['sel'], 'regret_of_selected': e['regret']})
        pq.write_table(pa.Table.from_pylist(rows), os.path.join(d, 'parquet', 'evals.parquet'), compression='zstd'); print(f'evals: {len(rows)} action rows from {len(evals)} decisions')

if __name__ == '__main__':
    main()
