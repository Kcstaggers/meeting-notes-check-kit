(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MeetingScorer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '1.0';
  const LIMITS = Object.freeze({ cases: 200, lines: 200, candidates: 50, actions: 100,
    participants: 50, task: 2000, line: 10000, answerBytes: 262144 });
  const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const object = o => o !== null && typeof o === 'object' && !Array.isArray(o);
  const normalized = s => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  const unique = a => Array.from(new Set(a));
  const setEqual = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  const issue = (errors, code, path, message) => errors.push({ code, path, message });
  const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  const ratio = (numerator, denominator) => ({ numerator, denominator,
    value: denominator === 0 ? null : numerator / denominator });

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1 || month < 1 || month > 12) return false;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day >= 1 && day <= days[month - 1];
  }

  function checkArray(value, max, errors, path, nonempty) {
    if (!Array.isArray(value) || value.length > max || (nonempty && value.length === 0)) {
      issue(errors, 'INVALID_ARRAY', path, 'Expected ' + (nonempty ? 'a nonempty' : 'an') +
        ' array with at most ' + max + ' entries.');
      return false;
    }
    return true;
  }

  function checkNames(value, people, errors, path) {
    if (!checkArray(value, LIMITS.participants, errors, path, false)) return [];
    const names = [];
    value.forEach((name, i) => {
      if (!text(name, 120)) issue(errors, 'INVALID_OWNER', path + '[' + i + ']', 'Use a participant name.');
      else {
        const n = normalized(name);
        if (!people.has(n)) issue(errors, 'UNKNOWN_OWNER', path + '[' + i + ']', 'Name is not in this case\'s participant list.');
        else names.push(people.get(n));
      }
    });
    if (unique(names).length !== names.length) issue(errors, 'DUPLICATE_OWNER', path, 'List each owner once.');
    return names;
  }

  function checkEvidence(value, lineIds, errors, path) {
    if (!checkArray(value, LIMITS.lines, errors, path, false)) return [];
    const refs = [];
    value.forEach((id, i) => {
      if (typeof id !== 'string' || !lineIds.has(id))
        issue(errors, 'UNKNOWN_EVIDENCE', path + '[' + i + ']', 'Use an existing source line ID.');
      else refs.push(id);
    });
    if (unique(refs).length !== refs.length) issue(errors, 'DUPLICATE_EVIDENCE', path, 'List each evidence line once.');
    return refs;
  }

  function inspectCase(c, path) {
    const errors = [];
    const people = new Map();
    const lineIds = new Set();
    const candidates = new Map();
    if (!object(c)) {
      issue(errors, 'INVALID_CASE', path, 'Expected a case object.');
      return { errors, people, lineIds, candidates };
    }
    ['id', 'pair_id'].forEach(k => {
      if (typeof c[k] !== 'string' || !ID.test(c[k])) issue(errors, 'INVALID_ID', path + '.' + k, 'Use a short identifier.');
    });
    ['variant', 'title', 'focus', 'pair_change'].forEach(k => {
      if (!text(c[k], 4000)) issue(errors, 'INVALID_TEXT', path + '.' + k, 'Expected nonempty text, at most 4000 characters.');
    });
    if (!validDate(c.meeting_date)) issue(errors, 'INVALID_DATE', path + '.meeting_date', 'Use a real ISO calendar date (YYYY-MM-DD).');
    if (checkArray(c.participants, LIMITS.participants, errors, path + '.participants', true)) {
      c.participants.forEach((name, i) => {
        if (!text(name, 120)) issue(errors, 'INVALID_PARTICIPANT', path + '.participants[' + i + ']', 'Expected a participant name.');
        else if (people.has(normalized(name))) issue(errors, 'DUPLICATE_PARTICIPANT', path + '.participants[' + i + ']', 'Participant names must be unambiguous.');
        else people.set(normalized(name), name.trim().replace(/\s+/g, ' '));
      });
    }
    if (checkArray(c.lines, LIMITS.lines, errors, path + '.lines', true)) {
      c.lines.forEach((line, i) => {
        const p = path + '.lines[' + i + ']';
        if (!object(line)) { issue(errors, 'INVALID_LINE', p, 'Expected a source line object.'); return; }
        if (typeof line.id !== 'string' || !ID.test(line.id)) issue(errors, 'INVALID_ID', p + '.id', 'Use a short line identifier.');
        else if (lineIds.has(line.id)) issue(errors, 'DUPLICATE_LINE', p + '.id', 'Line IDs must be unique within a case.');
        else lineIds.add(line.id);
        if (!text(line.speaker, 120) || !people.has(normalized(line.speaker)))
          issue(errors, 'UNKNOWN_SPEAKER', p + '.speaker', 'Speaker must appear in participants.');
        if (!text(line.text, LIMITS.line)) issue(errors, 'INVALID_TEXT', p + '.text', 'Expected source text, at most ' + LIMITS.line + ' characters.');
      });
    }
    if (checkArray(c.candidates, LIMITS.candidates, errors, path + '.candidates', true)) {
      c.candidates.forEach((candidate, i) => {
        const p = path + '.candidates[' + i + ']';
        if (!object(candidate)) { issue(errors, 'INVALID_CANDIDATE', p, 'Expected a candidate object.'); return; }
        if (typeof candidate.id !== 'string' || !ID.test(candidate.id) || candidate.id === '__extra__')
          issue(errors, 'INVALID_ID', p + '.id', 'Use a short candidate identifier.');
        else if (candidates.has(candidate.id)) issue(errors, 'DUPLICATE_CANDIDATE', p + '.id', 'Candidate IDs must be unique within a case.');
        else candidates.set(candidate.id, candidate);
        if (!text(candidate.task, LIMITS.task)) issue(errors, 'INVALID_TEXT', p + '.task', 'Expected an action description.');
        const ref = candidate.expected;
        if (!object(ref)) { issue(errors, 'INVALID_REFERENCE', p + '.expected', 'Expected a reference object.'); return; }
        if (typeof ref.include !== 'boolean') issue(errors, 'INVALID_INCLUDE', p + '.expected.include', 'Expected true or false.');
        checkNames(ref.owners, people, errors, p + '.expected.owners');
        if (ref.due !== null && !validDate(ref.due)) issue(errors, 'INVALID_DATE', p + '.expected.due', 'Use null or a real ISO calendar date.');
        checkEvidence(ref.evidence, lineIds, errors, p + '.expected.evidence');
        if (!Array.isArray(ref.evidence) || ref.evidence.length === 0)
          issue(errors, 'MISSING_REFERENCE_EVIDENCE', p + '.expected.evidence', 'References need at least one supporting source line.');
        if (own(ref, 'evidence_sets') && checkArray(ref.evidence_sets, 20, errors, p + '.expected.evidence_sets', true)) {
          const seenSets = new Set();
          ref.evidence_sets.forEach((set, si) => {
            const sp = p + '.expected.evidence_sets[' + si + ']';
            checkEvidence(set, lineIds, errors, sp);
            if (!Array.isArray(set) || set.length === 0) issue(errors, 'EMPTY_EVIDENCE_SET', sp, 'An accepted evidence set cannot be empty.');
            else {
              const key = JSON.stringify(set.slice().sort());
              if (seenSets.has(key)) issue(errors, 'DUPLICATE_EVIDENCE_SET', sp, 'Accepted evidence sets must be distinct.');
              seenSets.add(key);
            }
          });
          if (Array.isArray(ref.evidence) && !ref.evidence_sets.some(set => Array.isArray(set) && set.length > 0 && set.every(id => ref.evidence.includes(id))))
            issue(errors, 'REFERENCE_EVIDENCE_UNCOVERED', p + '.expected.evidence', 'The default reference evidence must cover an accepted evidence set.');
        }
        if (!text(ref.explanation, 4000)) issue(errors, 'INVALID_TEXT', p + '.expected.explanation', 'Expected an explanation.');
        if (ref.include === false && (Array.isArray(ref.owners) && ref.owners.length !== 0 || ref.due !== null))
          issue(errors, 'EXCLUDED_FIELDS', p + '.expected', 'Excluded actions must have owners: [] and due: null.');
      });
    }
    return { errors, people, lineIds, candidates };
  }

  function validateDataset(dataset) {
    const errors = [];
    const counts = { cases: 0, pairs: 0, candidates: 0, included: 0 };
    if (!object(dataset)) {
      issue(errors, 'INVALID_DATASET', 'dataset', 'Expected a dataset object.');
      return { valid: false, errors, counts };
    }
    if (dataset.schema_version !== VERSION) issue(errors, 'SCHEMA_VERSION', 'schema_version', 'Expected schema_version 1.0.');
    if (!checkArray(dataset.cases, LIMITS.cases, errors, 'cases', true)) return { valid: false, errors, counts };
    const ids = new Set();
    const pairs = new Map();
    dataset.cases.forEach((c, i) => {
      const p = 'cases[' + i + ']';
      const inspected = inspectCase(c, p);
      errors.push(...inspected.errors);
      counts.cases += 1;
      counts.candidates += inspected.candidates.size;
      counts.included += Array.from(inspected.candidates.values()).filter(x => x.expected && x.expected.include === true).length;
      if (!object(c)) return;
      if (ids.has(c.id)) issue(errors, 'DUPLICATE_CASE', p + '.id', 'Case IDs must be unique.');
      ids.add(c.id);
      if (!pairs.has(c.pair_id)) pairs.set(c.pair_id, []);
      pairs.get(c.pair_id).push(c.variant);
    });
    counts.pairs = pairs.size;
    for (const [pairId, variants] of pairs) {
      if (variants.length !== 2 || unique(variants).length !== 2)
        issue(errors, 'INVALID_PAIR', 'pairs.' + pairId, 'Each minimal pair needs exactly two cases with different variants.');
    }
    return { valid: errors.length === 0, errors, counts };
  }

  function scoreCase(c, answer) {
    const inspected = inspectCase(c, 'case');
    const errors = inspected.errors.slice();
    const expected = Array.from(inspected.candidates.values()).filter(x => x.expected && x.expected.include === true);
    const result = {
      schema_version: VERSION, case_id: object(c) && typeof c.id === 'string' ? c.id : null,
      mode: object(answer) && typeof answer.mode === 'string' ? answer.mode : null,
      valid: false, complete: false, outcome: 'invalid', summary: '', errors,
      factual_agreement: null, citation_coverage: null,
      review: { required: 0, reviewed: 0, unresolved: 0, reference_issues: 0, complete: false },
      selection: { expected: expected.length, submitted: 0, matched: 0, omitted: expected.map(x => x.id),
        extra: [], duplicates: [], precision: ratio(0, 0), recall: ratio(0, expected.length), provisional: true },
      fields: { owners: { compared: 0, agreed: 0 }, due: { compared: 0, agreed: 0 }, evidence: { compared: 0, covered: 0 } }, rows: []
    };
    if (inspected.errors.length) { result.summary = 'The case reference is invalid. No answer was scored.'; return result; }
    if (!object(answer)) { issue(errors, 'INVALID_ANSWER', 'answer', 'Expected an answer object.'); result.summary = 'Correct the answer format before scoring.'; return result; }
    try {
      if (new TextEncoder().encode(JSON.stringify(answer)).length > LIMITS.answerBytes)
        issue(errors, 'INPUT_LIMIT', 'answer', 'Answer exceeds the 256 KiB input limit.');
    } catch (_) { issue(errors, 'INVALID_ANSWER', 'answer', 'Answer must contain serializable JSON data.'); }
    Object.keys(answer).forEach(k => {
      if (!['schema_version', 'case_id', 'mode', 'actions'].includes(k)) issue(errors, 'UNKNOWN_FIELD', 'answer.' + k, 'Unexpected answer field.');
    });
    if (own(answer, 'schema_version') && answer.schema_version !== VERSION) issue(errors, 'SCHEMA_VERSION', 'answer.schema_version', 'Expected schema_version 1.0.');
    if (answer.case_id !== c.id) issue(errors, 'CASE_MISMATCH', 'answer.case_id', 'Answer belongs to a different case.');
    if (!['guided', 'extraction'].includes(answer.mode)) issue(errors, 'INVALID_MODE', 'answer.mode', 'Use guided or extraction.');
    const listOkay = checkArray(answer.actions, LIMITS.actions, errors, 'answer.actions', false);
    if (!listOkay || errors.some(x => ['INPUT_LIMIT', 'INVALID_ANSWER'].includes(x.code))) {
      result.summary = 'Correct the answer format before scoring.'; return result;
    }
    const extraction = answer.mode === 'extraction';
    result.selection.submitted = answer.actions.length;
    result.review.required = extraction ? answer.actions.length : 0;
    const allowedActionKeys = ['candidate_id', 'owners', 'due', 'evidence', 'task', 'semantic_reviewed', 'review_state'];
    const prepared = [];
    answer.actions.forEach((action, index) => {
      const p = 'answer.actions[' + index + ']';
      const startErrors = errors.length;
      const row = { index, candidate_id: null, task: null, review_state: 'uncertain', selection: 'unresolved',
        owners: { status: 'not_scored', expected: null, actual: null },
        due: { status: 'not_scored', expected: null, actual: null },
        evidence: { status: 'not_scored', required: [], alternatives: [], actual: [], missing: [] }, issues: [] };
      result.rows.push(row);
      if (!object(action)) { issue(errors, 'INVALID_ACTION', p, 'Expected an action object.'); row.issues.push('INVALID_ACTION'); result.review.unresolved += 1; prepared.push({ row, usable: false }); return; }
      Object.keys(action).forEach(k => { if (!allowedActionKeys.includes(k)) issue(errors, 'UNKNOWN_FIELD', p + '.' + k, 'Unexpected action field.'); });
      ['candidate_id', 'owners', 'due', 'evidence'].forEach(k => { if (!own(action, k)) issue(errors, 'MISSING_FIELD', p + '.' + k, 'Required field is missing.'); });
      if (action.candidate_id !== null && (typeof action.candidate_id !== 'string' || action.candidate_id.length > 64))
        issue(errors, 'INVALID_MAPPING', p + '.candidate_id', 'Use a candidate ID, null, or __extra__.');
      row.candidate_id = typeof action.candidate_id === 'string' ? action.candidate_id : null;
      if (extraction && !text(action.task, LIMITS.task)) issue(errors, 'INVALID_TASK', p + '.task', 'Extraction actions need their original task text.');
      else if (own(action, 'task') && !text(action.task, LIMITS.task)) issue(errors, 'INVALID_TASK', p + '.task', 'Task text must be nonempty and at most ' + LIMITS.task + ' characters.');
      row.task = typeof action.task === 'string' ? action.task : null;
      if (own(action, 'semantic_reviewed') && typeof action.semantic_reviewed !== 'boolean')
        issue(errors, 'INVALID_REVIEW', p + '.semantic_reviewed', 'Use true or false.');
      if (own(action, 'review_state') && !['matched', 'unsupported', 'uncertain', 'reference_issue'].includes(action.review_state))
        issue(errors, 'INVALID_REVIEW', p + '.review_state', 'Use matched, unsupported, uncertain, or reference_issue.');
      const actualOwners = checkNames(action.owners, inspected.people, errors, p + '.owners');
      row.owners.actual = Array.isArray(action.owners) ? action.owners.slice() : null;
      if (action.due !== null && !validDate(action.due)) issue(errors, 'INVALID_DATE', p + '.due', 'Use null or a real ISO calendar date (YYYY-MM-DD).');
      row.due.actual = typeof action.due === 'string' || action.due === null ? action.due : null;
      const actualEvidence = checkEvidence(action.evidence, inspected.lineIds, errors, p + '.evidence');
      row.evidence.actual = Array.isArray(action.evidence) ? action.evidence.slice() : [];
      const candidate = inspected.candidates.get(action.candidate_id);
      const isExtra = action.candidate_id === '__extra__';
      if (!extraction && isExtra) issue(errors, 'INVALID_GUIDED_MAPPING', p + '.candidate_id', 'Guided answers use the supplied candidate IDs.');
      if (extraction && action.review_state === 'unsupported' && !isExtra)
        issue(errors, 'REVIEW_CONFLICT', p + '.review_state', 'A reviewer-confirmed extra uses candidate_id: __extra__.');
      if (extraction && action.review_state === 'matched' && isExtra)
        issue(errors, 'REVIEW_CONFLICT', p + '.review_state', 'An extra action is not a matched reference action.');
      const unmatchedExtra = extraction && isExtra && action.review_state !== 'unsupported';
      const forcedPending = extraction && (['uncertain', 'reference_issue'].includes(action.review_state) || unmatchedExtra);
      const reviewed = !forcedPending && (!extraction || action.semantic_reviewed === true) && (candidate || isExtra);
      row.review_state = forcedPending ? (unmatchedExtra ? 'reference_issue' : action.review_state) : reviewed ? (isExtra ? 'unsupported' : 'matched') : 'uncertain';
      if (!candidate && !isExtra) row.issues.push(action.candidate_id === null ? 'UNMAPPED_ACTION' : 'UNKNOWN_MAPPING');
      if (extraction && action.semantic_reviewed !== true) row.issues.push('SEMANTIC_REVIEW_REQUIRED');
      if (row.review_state === 'reference_issue') row.issues.push('REFERENCE_ISSUE');
      const usable = errors.length === startErrors && Boolean(reviewed);
      if (errors.length !== startErrors) row.issues.push(...errors.slice(startErrors).map(x => x.code));
      if (!usable) {
        result.review.unresolved += 1;
        if (row.review_state === 'reference_issue') result.review.reference_issues += 1;
      } else if (extraction) result.review.reviewed += 1;
      prepared.push({ row, action, candidate, isExtra, usable, actualOwners, actualEvidence });
    });
    const byCandidate = new Map();
    prepared.forEach(x => {
      if (x.candidate) {
        if (!byCandidate.has(x.candidate.id)) byCandidate.set(x.candidate.id, []);
        byCandidate.get(x.candidate.id).push(x);
      }
    });
    for (const [id, rows] of byCandidate) if (rows.length > 1) {
      result.selection.duplicates.push(id);
      rows.forEach(x => x.row.issues.push('DUPLICATE_MAPPING'));
    }
    const matched = new Set();
    let selectedReviewed = 0;
    prepared.forEach(x => {
      if (!x.usable) return;
      selectedReviewed += 1;
      const { row, candidate } = x;
      if (x.isExtra) { row.selection = 'extra'; row.issues.push('REVIEWER_CONFIRMED_EXTRA'); result.selection.extra.push(row.index); return; }
      if (!candidate.expected.include) { row.selection = 'excluded'; row.issues.push('EXCLUDED_ACTION_SELECTED'); result.selection.extra.push(row.index); return; }
      if (matched.has(candidate.id)) { row.selection = 'duplicate'; result.selection.extra.push(row.index); return; }
      matched.add(candidate.id);
      row.selection = 'included';
      row.owners.expected = candidate.expected.owners.slice();
      row.due.expected = candidate.expected.due;
      row.evidence.alternatives = (candidate.expected.evidence_sets || [candidate.expected.evidence]).map(set => set.slice());
      const closestSet = row.evidence.alternatives.reduce((best, set) =>
        set.filter(id => !x.actualEvidence.includes(id)).length < best.filter(id => !x.actualEvidence.includes(id)).length ? set : best);
      row.evidence.required = closestSet.slice();
      if (byCandidate.get(candidate.id).length > 1) return;
      const expectedOwners = candidate.expected.owners.map(n => inspected.people.get(normalized(n)));
      const ownersAgree = setEqual(x.actualOwners, expectedOwners);
      row.owners.status = ownersAgree ? 'agree' : 'disagree';
      result.fields.owners.compared += 1;
      if (ownersAgree) result.fields.owners.agreed += 1;
      else row.issues.push(expectedOwners.length === 0 && x.actualOwners.length ? 'ADDED_OWNER' : 'OWNER_DISAGREEMENT');
      const dueAgrees = x.action.due === candidate.expected.due;
      row.due.status = dueAgrees ? 'agree' : 'disagree';
      result.fields.due.compared += 1;
      if (dueAgrees) result.fields.due.agreed += 1;
      else row.issues.push(candidate.expected.due === null && x.action.due !== null ? 'ADDED_DEADLINE' : 'DEADLINE_DISAGREEMENT');
      row.evidence.missing = closestSet.filter(id => !x.actualEvidence.includes(id));
      row.evidence.status = row.evidence.missing.length === 0 ? 'covered' : 'missing';
      result.fields.evidence.compared += 1;
      if (row.evidence.missing.length === 0) result.fields.evidence.covered += 1;
      else row.issues.push('REFERENCE_EVIDENCE_MISSING');
    });
    result.valid = errors.length === 0;
    result.review.complete = result.valid && result.review.unresolved === 0;
    result.complete = result.review.complete;
    result.selection.matched = matched.size;
    result.selection.omitted = expected.filter(x => !matched.has(x.id)).map(x => x.id);
    result.selection.precision = ratio(matched.size, selectedReviewed);
    result.selection.recall = ratio(matched.size, expected.length);
    result.selection.provisional = !result.complete;
    const factsAgree = result.selection.omitted.length === 0 && result.selection.extra.length === 0 &&
      result.selection.duplicates.length === 0 && result.fields.owners.agreed === expected.length &&
      result.fields.due.agreed === expected.length;
    const citationsCovered = result.fields.evidence.covered === expected.length;
    result.factual_agreement = result.complete ? factsAgree : null;
    result.citation_coverage = result.complete ? citationsCovered : null;
    const agreed = factsAgree && citationsCovered;
    if (!result.valid) { result.outcome = 'invalid'; result.summary = 'Correct the answer format. Any displayed comparisons are provisional.'; }
    else if (!result.complete) { result.outcome = 'review_needed'; result.summary = 'Resolve task mappings and semantic review before interpreting the result.'; }
    else if (!agreed) { result.outcome = 'needs_changes'; result.summary = 'The reviewed answer differs from the reference. Inspect the selection and field results.'; }
    else { result.outcome = 'reference_agreement'; result.summary = 'The answer agrees with this case\'s reference under the stated review and scoring rules.'; }
    return result;
  }

  function requireValidCase(c) {
    const inspected = inspectCase(c, 'case');
    if (inspected.errors.length) throw new Error('Invalid case: ' + inspected.errors.map(x => x.path + ': ' + x.message).join(' '));
  }

  function makeReferenceAnswer(c) {
    requireValidCase(c);
    return { case_id: c.id, mode: 'guided', actions: c.candidates.filter(x => x.expected.include).map(x => ({
      candidate_id: x.id, owners: x.expected.owners.slice(), due: x.expected.due, evidence: x.expected.evidence.slice()
    })) };
  }

  function makePrompt(c) {
    requireValidCase(c);
    return [
      'Extract current open action items from these synthetic meeting notes.',
      'Include explicit assignments and commitments that remain active. Exclude suggestions, completed or canceled work, and actions conditional on an unmet event. Do not treat a request for a volunteer or a question as an accepted commitment unless the notes resolve it.',
      'An explicit assignment counts without separate acceptance unless it is disputed or withdrawn.',
      'Use one row per action. Preserve joint owners. Use only participant names from the list. Use owners: [] when ownership is missing or ambiguous. Do not infer an owner from who merely reports or discusses the action.',
      'Use due: null when no date is stated or the date is ambiguous. Normalize a date to YYYY-MM-DD only when the notes and meeting date make it unambiguous. Do not use today\'s date. Do not invent a deadline from a meeting date, suggestion, or unrelated milestone.',
      'Cite source line IDs in evidence. Preserve the meaning of the action in task; concise paraphrases are allowed.',
      'Return only a JSON object with exactly two fields: case_id and actions. Each action must contain exactly task, owners, due, and evidence. Do not add other fields or commentary. Return actions: [] if no current open actions are supported. A person will review the task meanings and mappings afterward.',
      'Case ID: ' + c.id,
      'Meeting date: ' + c.meeting_date,
      'Participants: ' + c.participants.join(', '),
      'Notes:',
      ...c.lines.map(line => '[' + line.id + '] ' + line.speaker + ': ' + line.text)
    ].join('\n\n');
  }

  return Object.freeze({ schema_version: VERSION, limits: LIMITS, scoreCase, validateDataset, makePrompt, makeReferenceAnswer, validDate });
});
