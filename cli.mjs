#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import './scorer.js';

const scorer = globalThis.MeetingScorer;
const defaultDataset = fileURLToPath(new URL('./data/cases.json', import.meta.url));

async function readJson(path, maxBytes) {
  const info = await stat(path);
  if (!info.isFile()) throw new Error('Expected a regular JSON file: ' + path);
  if (info.size > maxBytes) throw new Error('JSON file exceeds the ' + maxBytes + '-byte input limit.');
  const source = await readFile(path, 'utf8');
  if (Buffer.byteLength(source, 'utf8') > maxBytes) throw new Error('JSON file exceeds the input limit.');
  try { return JSON.parse(source); }
  catch { throw new Error('Could not parse JSON in ' + path + '.'); }
}

function print(value) { process.stdout.write(JSON.stringify(value, null, 2) + '\n'); }

async function main() {
  const args = process.argv.slice(2);
  let datasetPath = defaultDataset;
  const datasetFlag = args.indexOf('--dataset');
  if (datasetFlag !== -1) {
    if (!args[datasetFlag + 1]) throw new Error('--dataset requires a JSON path.');
    datasetPath = args[datasetFlag + 1];
    args.splice(datasetFlag, 2);
  }
  const [command, value] = args;
  if (!['validate', 'prompt', 'reference', 'score'].includes(command) ||
      (command === 'validate' ? args.length !== 1 : args.length !== 2)) {
    throw new Error('Usage: node cli.mjs validate | prompt <case_id> | reference <case_id> | score <answer.json> [--dataset <cases.json>]');
  }
  const dataset = await readJson(datasetPath, 8 * 1024 * 1024);
  const validation = scorer.validateDataset(dataset);
  if (command === 'validate') { print(validation); process.exitCode = validation.valid ? 0 : 2; return; }
  if (!validation.valid) { print(validation); process.exitCode = 2; return; }
  let answer;
  let caseId = value;
  if (command === 'score') {
    answer = await readJson(value, scorer.limits.answerBytes);
    if (answer && typeof answer === 'object' && !Array.isArray(answer) && !Object.prototype.hasOwnProperty.call(answer, 'mode'))
      throw new Error('Raw extraction answers need human mapping and semantic review before scoring. Import the raw answer into the browser exercise or prepare the documented reviewed-answer format.');
    caseId = answer && answer.case_id;
  }
  const c = dataset.cases.find(item => item.id === caseId);
  if (!c) throw new Error('Unknown case ID: ' + String(caseId));
  if (command === 'prompt') process.stdout.write(scorer.makePrompt(c) + '\n');
  else if (command === 'reference') print(scorer.makeReferenceAnswer(c));
  else {
    const result = scorer.scoreCase(c, answer);
    print(result);
    process.exitCode = result.outcome === 'reference_agreement' ? 0 : result.outcome === 'needs_changes' ? 1 : 2;
  }
}

main().catch(error => { process.stderr.write('Error: ' + error.message + '\n'); process.exitCode = 2; });
