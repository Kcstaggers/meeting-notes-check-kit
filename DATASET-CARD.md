# Meeting action-list practice cases

## Purpose

Twenty original fictional cases for teaching and regression checks of meeting action lists. Ten pairs each change one line while preserving the surrounding notes. The intended readers are AI trainers and people building small-team follow-up workflows.

The pack focuses on action commitment, task status, ownership, dates and the effects of later corrections. It is a compact exercise with an explained key, not a representative meeting corpus or a general model benchmark.

## Provenance and annotation

The cases were written with AI assistance for this project. They do not describe Keith's workplace, clients, patients or actual meetings. No source transcripts, examples, generators or dataset rows were imported from the related resources below. Separate agents review reference judgments and scoring claims; this is not independent human annotation or inter-rater validation.

Each record includes numbered source lines, a reference inclusion decision, owner/date fields, evidence line IDs and a short explanation. Annotation follows the explicit current-open-actions rule in [METHODS.md](METHODS.md). The methods and tests document scoring choices; public issues track corrections.

## Format

`data/cases.json` is a JSON object containing `schema_version` and `cases`. Participant names and line IDs are local to each case. The browser copy and one-record-per-line `data/cases.jsonl` are generated from the canonical JSON and checked for equality. Raw prompts exclude candidates, reference fields, case focus and paired-change explanations.

## Limitations

- English only, short typed fictional notes, and deliberately salient contrasts.
- Ten dependent pairs, not twenty independent observations of natural meetings.
- No speech recognition, long-context, diarization, multilingual or real organizational validation.
- Names are unambiguous within each case; identity resolution is not tested broadly.
- Deadline normalization is intentionally restricted to dates supported by the notes and explicit context.
- Free-form extraction evaluation depends on human task matching; deterministic checks do not establish semantic entailment.
- The key may contain debatable judgments. Preserve reference issues and inspect the notes instead of forcing a pass/fail.
- No measured model results, externally validated adoption, or model rankings are included.

## Related work

Existing work already examines these failure types. This kit's proposed contribution is a short paired learning experience with inspectable references and a local checking interface.

- [Think AI First's meeting action-item dataset](https://think-ai-first.com/datasets/meeting-action-items-2026-08) describes synthetic meetings and saved model outputs addressing cancellations and unsupported attributes. We inspected its published description, not a reproduction of its experiments.
- [Meeting-notes extractive corpus](https://github.com/jvachier/meeting-notes-extractive-corpus) describes synthetic and AMI-derived data with owner/deadline annotations. We reuse none of its material.
- [QMSum](https://github.com/Yale-LILY/QMSum) addresses query-focused summarization of longer meetings, a broader task and different source setting.
- [MeetingBank](https://meetingbank.github.io/) and the [AMI Meeting Corpus](https://groups.inf.ed.ac.uk/ami/corpus/) provide alternatives for studying longer and more realistic meetings. Their source licenses must be checked separately before reuse.

## Release and rights

Version 1.0.0 is released by Keith Staggers. Cases and documentation are CC BY 4.0; code is MIT. See [LICENSING.md](LICENSING.md) for the exact scope and attribution. Public access does not establish peer review or independent endorsement.
