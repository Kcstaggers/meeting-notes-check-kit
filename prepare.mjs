import { readFile, writeFile } from 'node:fs/promises';
import './scorer.js';

// Explicit maintenance command. Source data is never changed by this script.
const source = new URL('./data/cases.json', import.meta.url);
const destination = new URL('./data/cases.js', import.meta.url);
const dataset = JSON.parse(await readFile(source, 'utf8'));
const checked = globalThis.MeetingScorer.validateDataset(dataset);
if (!checked.valid || checked.counts.cases !== 20 || checked.counts.pairs !== 10) {
  throw new Error('Expected a valid 20-case, 10-pair kit: ' + JSON.stringify(checked));
}
await writeFile(destination, '// SPDX-License-Identifier: CC-BY-4.0\n// Copyright 2026 Keith Staggers, to the extent applicable rights are held.\n// Generated from cases.json. Do not edit this copy.\nwindow.MEETING_CASES = ' + JSON.stringify(dataset, null, 2) + ';\n');
await writeFile(new URL('./data/cases.jsonl', import.meta.url), dataset.cases.map(item => JSON.stringify(item)).join('\n') + '\n');
process.stdout.write('Generated data/cases.js and data/cases.jsonl from the validated canonical data.\n');
