# What the scorer checks

## Target: current open actions

An action belongs in this exercise's final list when the notes explicitly assign or commit to specific future work, and that work remains active at the meeting's end. An explicit assignment counts without a separate acceptance unless it is disputed or withdrawn. Suggestions, canceled work, completed work and work conditional on an unmet event are excluded. A later statement can change an earlier one.

This rule defines the exercise, not every team's task-management policy. A team may keep a separate list of proposals or conditional tasks.

Keep an owner unknown when no participant is assigned or committed. Speaking about a task does not itself establish ownership. A task can have multiple named owners. A date is resolvable only when the notes or meeting date establish it unambiguously. Do not fill gaps using the current date, workplace habits or a guessed calendar convention.

## Reference data

Each case has a stable ID, pair ID, variant, meeting date, participant names, numbered lines and neutral task candidates. Each candidate has an `expected` object with:

| Field | Meaning |
| --- | --- |
| `include` | Whether this is a current open action under the stated rule |
| `owners` | Canonical participant names, or `[]` when not established |
| `due` | An unambiguous `YYYY-MM-DD` date, or `null` |
| `evidence` | Explanatory line IDs for inspecting the reference judgment |
| `evidence_sets` | Optional alternative sufficient citation sets; covering any one set passes the citation check. If absent, all IDs in `evidence` are required. |
| `explanation` | Why the reference includes/excludes the task and sets its fields |

Excluded tasks have empty owners and a null deadline because they do not belong on the current open-action list. Their explanation preserves the reason for exclusion. References are authored judgments that readers may challenge; they are not infallible ground truth.

## Guided practice and extraction review

Guided practice provides a finite list of candidate tasks. The person selects the open ones and fills their attributes. This tests verification of provided candidates, not unrestricted task discovery.

The extraction prompt provides only the meeting, participants, date and output contract. The model supplies task text. A person then maps that text to a reference candidate and confirms task identity. Owners and deadlines are evaluated separately. The scorer never compares task prose to decide whether it means the same thing.

An uncertain match remains unresolved. A possible reference omission requires review of the key. A reviewer can identify a task outside the reference, but that label alone does not prove the task is unsupported by the source. The report retains that issue instead of silently counting it as a successful answer or an automatic hallucination finding.

The browser offers a separate option for a reviewer who has inspected all the notes and confirmed that no current action supports the unmatched task. It requires its own confirmation and becomes `candidate_id: "__extra__"` with `review_state: "unsupported"` and `semantic_reviewed: true`. That explicit source judgment counts as an extra action. Selecting only “no candidate matches” never makes this judgment automatically.

For command-line use, a guided answer contains `case_id`, `mode: "guided"`, and `actions`. Each action contains `candidate_id`, `owners`, `due` and `evidence`. Extraction answers use `mode: "extraction"` and also preserve `task` and `semantic_reviewed`. The latter must be true for a mapped row's semantic review to be complete. Use a null candidate ID for an unresolved task, `"__extra__"` for a task outside the reference, or an explicit `review_state` of `"uncertain"` or `"reference_issue"`. All included actions must be represented, including unresolved ones.

## Reading a report

The report separates schema validity, review completion, action selection, owners, dates and citations. There is no blended model-quality score.

- **Selection:** which expected open actions were matched, which were omitted, and which extra or excluded candidates were included. Duplicate mappings are an error, not extra credit.
- **Owners:** agreement with the named reference owners as a set. Order does not matter. Unstated owners must stay empty; name matching does not perform fuzzy identity inference.
- **Deadlines:** exact agreement with the canonical date or null. Invalid dates are format errors. A date disagreement requires inspection; it is not automatically a hallucination diagnosis.
- **Citations:** coverage of at least one sufficient reference evidence set. Additional existing line IDs are allowed. A real quotation or valid line number does not prove the answer follows from it. Missing citation coverage is separate from factual field disagreement.
- **Review:** whether every extraction mapping was explicitly checked, with unresolved matches and reference issues kept visible.

Selection precision is the number of distinct included reference tasks matched by valid, reviewed rows divided by all valid, reviewed selected rows, including excluded candidates, confirmed extras and duplicate selections. Recall divides that matched count by all included reference tasks. An empty denominator produces `null`, not 100 percent. Until review is complete, these ratios are provisional.

Owner and deadline agreement use only valid, reviewed, uniquely mapped included actions as their denominators. Missing actions affect recall; they do not create field comparisons. When a candidate is mapped twice, both rows' field comparisons are withheld instead of silently choosing the better one. Citation coverage uses the same valid, reviewed, uniquely mapped included actions.

`valid` concerns format. `complete` concerns whether valid review is resolved, not whether the answer is correct. `factual_agreement` checks selection and owner/date agreement; `citation_coverage` checks sufficient evidence sets. Both remain null during incomplete review. The overall `reference_agreement` outcome requires both, plus no extras or duplicates. An answer with correct factual fields but insufficient citations is identified separately in the browser.

CLI exit codes are 0 for reference agreement (or a successful validate/prompt/reference command), 1 for a complete comparison with disagreements, and 2 for invalid input, unresolved review or command errors. The CLI compares one reviewed answer object at a time, with a 256 KiB answer limit. It does not parse Markdown fences, guess aliases or repair malformed responses.

## Comparing prompts or workflows

Keep a case's reference and paired explanation out of the model prompt. Record exact prompts and raw responses before converting or reviewing anything. If a response is not valid JSON, preserve it as a format failure; do not quietly repair it and report an unqualified pass.

Use the same cases and settings for a bounded comparison. Preserve reviewer mappings and their uncertainty. The paired cases are dependent observations, and twenty short synthetic examples cannot justify broad significance claims or a model leaderboard. This package includes no real model trials, adoption metrics or customer outcomes.
