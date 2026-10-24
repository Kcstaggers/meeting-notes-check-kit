# Check the meeting action list

**[Try two meetings in your browser](https://Kcstaggers.github.io/meeting-notes-check-kit/)** · [Download v1.0.0](https://github.com/Kcstaggers/meeting-notes-check-kit/releases/tag/v1.0.0)

Start with the first case, check your action list, then choose **Open paired case**. One line changes the answer. No installation or model account is needed.

Used a pair in training or a workflow? [Report what you tried](https://github.com/Kcstaggers/meeting-notes-check-kit/issues/new?template=trial-feedback.md). Include the case IDs, what happened and anything you would change. Please use only fictional examples in public reports.

A small practice and regression kit for AI trainers and people building meeting follow-up workflows.

“I'll send the draft” and “I could send the draft” can produce very similar action lists. They should not always produce the same one. This kit gives you twenty short fictional meetings in ten pairs. One line changes within each pair; the reference explains what that change does to the action list.

## Start with a meeting

Keep this folder together. From this folder, start a local server with Python 3:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/` in a modern browser. Stop the server with Ctrl+C when finished. The exercise needs no account, model connection or third-party packages. Answer processing stays in your browser; the hosted page loads its own files, and documentation and feedback links open GitHub. The server binds only to your own computer. Direct `file://` opening is unverified; the review browser does not permit that protocol.

1. Read the notes and the exercise rule.
2. In **Guided practice**, select the tasks that remain open. Choose owners, dates and evidence lines only where the notes establish them.
3. Check the answer. Inspect the separate action, owner, deadline and citation results.
4. Reveal the reference, then open the paired case. Find the changed line before answering again.

The references are visible to your browser and included in the download. This is a learning tool, not a secure examination.

## Check an AI extraction

Download a case's extraction prompt. It contains the meeting and output instructions, without the reference answers or candidate task list. Run it through a model or workflow you already have permission to use. This kit does not call a model, purchase credits or upload your text.

Select **Review an extraction**, paste the JSON response, and load it for review. Match each returned task to a reference candidate and confirm that they describe the same action. Check task meaning separately from owner and deadline claims: those fields stay unchanged and are compared by the scorer. Mark uncertain matches or possible reference omissions for review instead of forcing a match. If you inspect all the notes and confirm that no current action supports an unmatched task, select that explicit option and confirm it. This is your source judgment, not an automatic finding by the tool.

The expected raw response is:

```json
{
  "actions": [
    {
      "task": "The task in the model's own words",
      "owners": [],
      "due": null,
      "evidence": ["L1"]
    }
  ]
}
```

Use canonical participant names for owners and an ISO date (`YYYY-MM-DD`) for a resolvable deadline. Empty owners and `null` dates preserve missing information. An empty action list is `{"actions":[]}`. A response outside this format needs a documented conversion before scoring; a format failure is not evidence that the model invented a fact.

Download the checked answer to preserve the original task text, mappings, fields and report. The page keeps temporary drafts only while it remains open. Reloading clears them.

## Run the command-line checks

The command-line tool uses Node.js and no third-party packages. Run from this folder:

```sh
node cli.mjs validate
node --test tests/scorer.test.mjs
node cli.mjs prompt p01-a
node cli.mjs reference p01-a
node cli.mjs score path/to/answer.json
```

`reference` prints the reference answer for a scorer smoke check. It is not model output. For an extraction, save the reviewed `answer` object from the browser's checked-answer download as the CLI input. The scorer intentionally does not infer task matches from wording. See [METHODS.md](METHODS.md) for the contract and [DATASET-CARD.md](DATASET-CARD.md) for provenance.

For maintainers: after an intentional edit to the canonical `data/cases.json`, run `node prepare.mjs` to validate it and regenerate the browser and JSONL copies, then rerun the tests. This command does not change the canonical data. No `npm install` is needed. The package is marked private to prevent accidental npm publication; the code is MIT licensed and the cases and explanatory documents are CC BY 4.0.

## Use the result carefully

An answer can get the right tasks and the wrong owners. It can also cite a genuine line that a later sentence reverses. Keep these errors separate. Citation coverage checks whether the required line identifiers appear; inspect the source to judge whether the answer actually follows from them.

These are related, deliberately constructed English cases. They do not establish general model accuracy, reliability in long meetings, or performance on real customer data. Extraction scores depend on the reviewer's task mappings. No measured model results are included.

For a small prompt regression check, record the exact prompt, model/version, settings, date, raw response and any conversion or manual mapping. Keep both successful and unsuccessful responses. Report the cases and disagreements, rather than turning twenty examples into a general model ranking.

## Contents and release status

- `index.html`, `style.css`, `app.js`: local browser exercise.
- `data/cases.json`: canonical fictional cases and references.
- `data/cases.js`: generated browser copy of the same data.
- `data/cases.jsonl`: the same twenty records, one JSON object per line.
- `scorer.js`: shared comparison engine.
- `cli.mjs`: command-line interface.
- `prepare.mjs`: validated regeneration of the browser data copy.
- `tests/scorer.test.mjs`: adversarial scorer checks.
- `METHODS.md`, `DATASET-CARD.md`: policy, schema, provenance and limits.

Version 1.0.0 by Keith Staggers, created with AI assistance and separate agent review. See [licensing and attribution](LICENSING.md). Agent review is not independent human validation.
