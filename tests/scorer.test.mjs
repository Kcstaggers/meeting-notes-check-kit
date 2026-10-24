import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import '../scorer.js';

const S = globalThis.MeetingScorer;
const clone = value => JSON.parse(JSON.stringify(value));
const fixture = {
  id: 'test-a', pair_id: 'test-pair', variant: 'a', title: 'PRIVATE_TITLE',
  focus: 'PRIVATE_FOCUS', pair_change: 'PRIVATE_PAIR_CHANGE', meeting_date: '2026-03-09',
  participants: ['Ava', 'Ben', 'Cora'],
  lines: [
    { id: 'L1', speaker: 'Ava', text: 'Ben and I will prepare the revised quote.' },
    { id: 'L2', speaker: 'Ben', text: 'Yes. We will have it ready by March 12, 2026.' },
    { id: 'L3', speaker: 'Cora', text: 'We could redesign the website, but we are not committing to that.' }
  ],
  candidates: [
    { id: 'T1', task: 'PRIVATE_CANDIDATE_ONE', expected: { include: true, owners: ['Ava', 'Ben'], due: '2026-03-12', evidence: ['L1', 'L2'], explanation: 'PRIVATE_EXPLANATION_ONE' } },
    { id: 'T2', task: 'PRIVATE_CANDIDATE_TWO', expected: { include: false, owners: [], due: null, evidence: ['L3'], explanation: 'PRIVATE_EXPLANATION_TWO' } }
  ]
};
const dataset = () => ({ schema_version: '1.0', cases: [clone(fixture), { ...clone(fixture), id: 'test-b', variant: 'b' }] });
const reference = () => S.makeReferenceAnswer(fixture);
const extraction = () => ({ case_id: fixture.id, mode: 'extraction', actions: [{ ...reference().actions[0], task: 'Get the updated quotation ready', semantic_reviewed: true }] });
const errorCodes = result => result.errors.map(x => x.code);

test('valid minimal pair and reference answer pass without mutating input', () => {
  const d = dataset(); const before = JSON.stringify(d);
  assert.deepEqual(S.validateDataset(d), { valid: true, errors: [], counts: { cases: 2, pairs: 1, candidates: 4, included: 2 } });
  const answer = reference(); const aBefore = JSON.stringify(answer);
  const result = S.scoreCase(fixture, answer);
  assert.equal(result.outcome, 'reference_agreement');
  assert.equal(result.complete, true);
  assert.equal(result.selection.precision.value, 1);
  assert.equal(result.selection.recall.value, 1);
  assert.deepEqual(result.fields, { owners: { compared: 1, agreed: 1 }, due: { compared: 1, agreed: 1 }, evidence: { compared: 1, covered: 1 } });
  assert.equal(JSON.stringify(d), before); assert.equal(JSON.stringify(answer), aBefore);
});

test('reviewed paraphrases are matched by the reviewer, not text similarity', () => {
  const answer = extraction(); answer.actions[0].task = 'The two colleagues will get an updated commercial offer ready.';
  assert.equal(S.scoreCase(fixture, answer).outcome, 'reference_agreement');
});

test('joint-owner ordering, case and whitespace do not change meaning', () => {
  const answer = reference(); answer.actions[0].owners = [' ben ', 'AVA'];
  assert.equal(S.scoreCase(fixture, answer).outcome, 'reference_agreement');
});

test('a known but wrong owner is a field disagreement', () => {
  const answer = reference(); answer.actions[0].owners = ['Cora'];
  const result = S.scoreCase(fixture, answer);
  assert.equal(result.outcome, 'needs_changes');
  assert.equal(result.rows[0].owners.status, 'disagree');
  assert(result.rows[0].issues.includes('OWNER_DISAGREEMENT'));
});

test('added owner and deadline remain visible when the reference leaves them unknown', () => {
  const c = clone(fixture); c.candidates[0].expected.owners = []; c.candidates[0].expected.due = null;
  const result = S.scoreCase(c, reference());
  assert.equal(result.outcome, 'needs_changes');
  assert(result.rows[0].issues.includes('ADDED_OWNER'));
  assert(result.rows[0].issues.includes('ADDED_DEADLINE'));
});

test('unknown owner names are schema errors, not inferred aliases or semantic verdicts', () => {
  const answer = reference(); answer.actions[0].owners = ['Ava Smith'];
  const result = S.scoreCase(fixture, answer);
  assert.equal(result.outcome, 'invalid'); assert(errorCodes(result).includes('UNKNOWN_OWNER'));
  assert.equal(result.fields.owners.compared, 0);
});

test('omitting an action reduces recall and cannot produce a clean result', () => {
  const answer = reference(); answer.actions = [];
  const result = S.scoreCase(fixture, answer);
  assert.equal(result.outcome, 'needs_changes');
  assert.deepEqual(result.selection.omitted, ['T1']);
  assert.equal(result.selection.recall.value, 0);
  assert.equal(result.selection.precision.value, null);
});

test('selecting a proposal, canceled action or other excluded candidate is an extra', () => {
  const answer = reference(); answer.actions.push({ candidate_id: 'T2', owners: [], due: null, evidence: ['L3'] });
  const result = S.scoreCase(fixture, answer);
  assert.equal(result.outcome, 'needs_changes');
  assert.deepEqual(result.selection.extra, [1]);
  assert.equal(result.selection.precision.value, 0.5);
  assert.equal(result.rows[1].selection, 'excluded');
});

test('duplicate task mappings cannot earn extra credit or select the better answer', () => {
  const answer = reference(); answer.actions.push(clone(answer.actions[0])); answer.actions[0].owners = ['Cora'];
  const result = S.scoreCase(fixture, answer);
  assert.equal(result.outcome, 'needs_changes');
  assert.deepEqual(result.selection.duplicates, ['T1']);
  assert.equal(result.selection.matched, 1); assert.equal(result.selection.precision.value, 0.5);
  assert.equal(result.fields.owners.compared, 0);
});

test('duplicate canonical owner names are invalid', () => {
  const answer = reference(); answer.actions[0].owners = ['Ava', ' ava '];
  assert(errorCodes(S.scoreCase(fixture, answer)).includes('DUPLICATE_OWNER'));
});

test('unmapped extraction remains awaiting review even with a semantic flag', () => {
  const answer = extraction(); answer.actions[0].candidate_id = null;
  const result = S.scoreCase(fixture, answer);
  assert.equal(result.outcome, 'review_needed'); assert.equal(result.valid, true);
  assert.equal(result.selection.provisional, true); assert.equal(result.fields.owners.compared, 0);
});

test('unknown mapping does not silently disappear or become an automatic unsupported task', () => {
  const answer = extraction(); answer.actions[0].candidate_id = 'UNKNOWN';
  const result = S.scoreCase(fixture, answer);
  assert.equal(result.outcome, 'review_needed'); assert.equal(result.review.unresolved, 1);
  assert(result.rows[0].issues.includes('UNKNOWN_MAPPING')); assert.deepEqual(result.selection.extra, []);
});

test('unreviewed extraction fields are never compared', () => {
  const answer = extraction(); delete answer.actions[0].semantic_reviewed;
  const result = S.scoreCase(fixture, answer);
  assert.equal(result.outcome, 'review_needed'); assert.equal(result.fields.due.compared, 0);
  assert.equal(result.review.reviewed, 0);
});

for (const state of ['uncertain', 'reference_issue']) {
  test('explicit ' + state + ' overrides semantic_reviewed true', () => {
    const answer = extraction(); answer.actions[0].review_state = state;
    const result = S.scoreCase(fixture, answer);
    assert.equal(result.outcome, 'review_needed'); assert.equal(result.complete, false);
    assert.equal(result.review.reference_issues, state === 'reference_issue' ? 1 : 0);
  });
}

test('reviewer-confirmed extra counts only after semantic review', () => {
  const answer = extraction(); answer.actions.push({ candidate_id: '__extra__', task: 'Purchase a new office', owners: [], due: null, evidence: [], semantic_reviewed: true, review_state: 'unsupported' });
  const result = S.scoreCase(fixture, answer);
  assert.equal(result.outcome, 'needs_changes'); assert.deepEqual(result.selection.extra, [1]);
  assert.equal(result.selection.precision.value, 0.5);
  answer.actions[1].semantic_reviewed = false;
  assert.equal(S.scoreCase(fixture, answer).outcome, 'review_needed');
});

test('no candidate matches is a reference issue until explicitly reviewed as unsupported', () => {
  const answer = extraction(); answer.actions[0].candidate_id = '__extra__';
  const result = S.scoreCase(fixture, answer);
  assert.equal(result.outcome, 'review_needed');
  assert.equal(result.review.reference_issues, 1);
  assert.equal(result.rows[0].review_state, 'reference_issue');
  assert.deepEqual(result.selection.extra, []);
});

test('conflicting review and mapping flags are errors', () => {
  const answer = extraction(); answer.actions[0].review_state = 'unsupported';
  assert(errorCodes(S.scoreCase(fixture, answer)).includes('REVIEW_CONFLICT'));
});

test('missing, invented and wrong-type fields are reported, never coerced', () => {
  const answer = reference(); delete answer.actions[0].due; answer.actions[0].priority = 'urgent'; answer.actions[0].owners = 'Ava';
  const result = S.scoreCase(fixture, answer);
  assert.equal(result.outcome, 'invalid');
  for (const code of ['MISSING_FIELD', 'UNKNOWN_FIELD', 'INVALID_ARRAY']) assert(errorCodes(result).includes(code));
});

test('calendar overflow, invalid leap days and date-time strings are rejected', () => {
  for (const value of ['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-01', '0000-01-01', '2026-03-12T00:00:00Z', '03/12/2026']) {
    const answer = reference(); answer.actions[0].due = value;
    assert(errorCodes(S.scoreCase(fixture, answer)).includes('INVALID_DATE'), value);
  }
  for (const value of ['2024-02-29', '2000-02-29', '2026-03-12']) assert.equal(S.validDate(value), true);
  assert.equal(S.validDate('1900-02-29'), false);
});

test('wrong but valid date is a disagreement rather than a format error', () => {
  const answer = reference(); answer.actions[0].due = '2026-03-13';
  const result = S.scoreCase(fixture, answer);
  assert.equal(result.valid, true); assert.equal(result.rows[0].due.status, 'disagree');
});

test('unknown evidence IDs and duplicate citations are invalid', () => {
  const answer = reference(); answer.actions[0].evidence = ['L1', 'L1', 'L99'];
  const result = S.scoreCase(fixture, answer);
  assert(errorCodes(result).includes('UNKNOWN_EVIDENCE')); assert(errorCodes(result).includes('DUPLICATE_EVIDENCE'));
});

test('evidence requires all reference lines; known supersets have coverage, not semantic proof', () => {
  const answer = reference(); answer.actions[0].evidence = ['L1'];
  let result = S.scoreCase(fixture, answer);
  assert.equal(result.outcome, 'needs_changes'); assert.deepEqual(result.rows[0].evidence.missing, ['L2']);
  answer.actions[0].evidence.push('L2', 'L3'); result = S.scoreCase(fixture, answer);
  assert.equal(result.outcome, 'reference_agreement'); assert.equal(result.rows[0].evidence.status, 'covered');
});

test('alternative evidence sets accept either sufficient route without requiring redundant lines', () => {
  const c = clone(fixture); c.candidates[0].expected.evidence_sets = [['L1'], ['L2']];
  const answer = reference();
  for (const ids of [['L1'], ['L2'], ['L1', 'L2', 'L3']]) {
    answer.actions[0].evidence = ids;
    const result = S.scoreCase(c, answer);
    assert.equal(result.outcome, 'reference_agreement');
    assert.deepEqual(result.rows[0].evidence.alternatives, [['L1'], ['L2']]);
  }
  answer.actions[0].evidence = ['L3'];
  const insufficient = S.scoreCase(c, answer);
  assert.equal(insufficient.outcome, 'needs_changes');
  assert.equal(insufficient.factual_agreement, true);
  assert.equal(insufficient.citation_coverage, false);
  assert.deepEqual(insufficient.rows[0].evidence.missing, ['L1']);
});

test('closest evidence alternative is exposed when no accepted set is fully covered', () => {
  const c = clone(fixture); c.candidates[0].expected.evidence_sets = [['L1', 'L2'], ['L3']];
  const answer = reference(); answer.actions[0].evidence = [];
  const result = S.scoreCase(c, answer);
  assert.deepEqual(result.rows[0].evidence.required, ['L3']);
  assert.deepEqual(result.rows[0].evidence.missing, ['L3']);
});

test('dataset validator rejects empty, unknown, duplicate and uncovered evidence alternatives', () => {
  for (const [sets, code] of [[[], 'INVALID_ARRAY'], [[[]], 'EMPTY_EVIDENCE_SET'], [[['L99']], 'UNKNOWN_EVIDENCE'], [[['L1'], ['L1']], 'DUPLICATE_EVIDENCE_SET'], [[['L3']], 'REFERENCE_EVIDENCE_UNCOVERED']]) {
    const d = dataset(); d.cases[0].candidates[0].expected.evidence_sets = sets;
    assert(errorCodes(S.validateDataset(d)).includes(code), code);
  }
});

test('no-action reference and empty answer agree, with undefined precision and recall', () => {
  const c = clone(fixture); c.candidates[0].expected.include = false; c.candidates[0].expected.owners = []; c.candidates[0].expected.due = null;
  const result = S.scoreCase(c, { case_id: c.id, mode: 'extraction', actions: [] });
  assert.equal(result.outcome, 'reference_agreement'); assert.equal(result.selection.precision.value, null); assert.equal(result.selection.recall.value, null);
});

test('prompts expose source and response rules but never candidates or reference metadata', () => {
  const prompt = S.makePrompt(fixture);
  for (const secret of ['PRIVATE_TITLE', 'PRIVATE_FOCUS', 'PRIVATE_PAIR_CHANGE', 'PRIVATE_CANDIDATE', 'PRIVATE_EXPLANATION', 'T1', 'T2']) assert.equal(prompt.includes(secret), false, secret);
  assert(prompt.includes(fixture.lines[0].text));
  assert(prompt.includes('exactly two fields: case_id and actions'));
  assert(prompt.includes('exactly task, owners, due, and evidence'));
  for (const field of ['candidate_id', 'semantic_reviewed', 'review_state', 'mode:']) assert.equal(prompt.includes(field), false, field);
});

test('case mismatch and oversized inputs cannot score cleanly', () => {
  const answer = reference(); answer.case_id = 'another';
  assert(errorCodes(S.scoreCase(fixture, answer)).includes('CASE_MISMATCH'));
  const huge = reference(); huge.padding = 'x'.repeat(S.limits.answerBytes + 1);
  assert(errorCodes(S.scoreCase(fixture, huge)).includes('INPUT_LIMIT'));
  const many = reference(); many.actions = Array.from({ length: S.limits.actions + 1 }, () => reference().actions[0]);
  assert.equal(S.scoreCase(fixture, many).outcome, 'invalid');
});

test('malformed datasets catch duplicate IDs, invalid owners, dates, exclusions and pairs', () => {
  const d = dataset(); d.cases[1].id = d.cases[0].id; d.cases[1].variant = d.cases[0].variant;
  d.cases[0].candidates[1].expected.owners = ['Ava'];
  d.cases[0].candidates[0].expected.due = '2026-02-30';
  const codes = errorCodes(S.validateDataset(d));
  for (const code of ['DUPLICATE_CASE', 'INVALID_PAIR', 'EXCLUDED_FIELDS', 'INVALID_DATE']) assert(codes.includes(code));
});

test('invalid reference prevents answer scoring entirely', () => {
  const c = clone(fixture); c.candidates[0].expected.evidence = ['missing'];
  const result = S.scoreCase(c, reference());
  assert.equal(result.outcome, 'invalid'); assert.deepEqual(result.rows, []);
});

test('CLI validates, prompts, references and scores offline; handles malformed JSON', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'meeting-scorer-test-'));
  const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
  const datasetPath = path.join(dir, 'cases.json'); const answerPath = path.join(dir, 'answer.json');
  try {
    await writeFile(datasetPath, JSON.stringify(dataset())); await writeFile(answerPath, JSON.stringify(reference()));
    const run = (...args) => spawnSync(process.execPath, [cli, ...args, '--dataset', datasetPath], { encoding: 'utf8' });
    let r = run('validate'); assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).valid, true);
    r = run('prompt', fixture.id); assert.equal(r.status, 0, r.stderr); assert(r.stdout.includes(fixture.lines[0].text));
    r = run('reference', fixture.id); assert.equal(r.status, 0, r.stderr); assert.deepEqual(JSON.parse(r.stdout), reference());
    r = run('score', answerPath); assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).outcome, 'reference_agreement');
    const answer = reference(); answer.actions = []; await writeFile(answerPath, JSON.stringify(answer));
    r = run('score', answerPath); assert.equal(r.status, 1); assert.equal(JSON.parse(r.stdout).outcome, 'needs_changes');
    await writeFile(answerPath, '{broken'); r = run('score', answerPath); assert.equal(r.status, 2); assert(r.stderr.includes('Could not parse JSON'));
    await writeFile(answerPath, JSON.stringify({ case_id: fixture.id, actions: [{ task: 'Prepare quote', owners: ['Ava'], due: null, evidence: ['L1'] }] }));
    r = run('score', answerPath); assert.equal(r.status, 2); assert(r.stderr.includes('Raw extraction answers need human mapping'));
    r = run('prompt', 'does-not-exist'); assert.equal(r.status, 2); assert(r.stderr.includes('Unknown case ID'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('real dataset validates and all reference answers agree when the dataset is present', async t => {
  const file = new URL('../data/cases.json', import.meta.url);
  let d;
  try { d = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') { t.skip('Dataset author is still preparing cases.'); return; } throw error; }
  const validation = S.validateDataset(d);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  for (const c of d.cases) assert.equal(S.scoreCase(c, S.makeReferenceAnswer(c)).outcome, 'reference_agreement', c.id);
});
