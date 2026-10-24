'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const engine = window.MeetingScorer;
  const dataset = window.MEETING_CASES;
  if (!engine || !dataset || !Array.isArray(dataset.cases)) {
    $('notice').textContent = 'The local data or scorer did not load. Keep the kit folder together and reopen index.html.';
    return;
  }
  const cases = dataset.cases;
  let position = 0, parsed = null, lastCheck = null;
  const drafts = new Map();
  const node = (tag, text, attrs = {}) => {
    const element = document.createElement(tag);
    if (text !== null && text !== undefined) element.textContent = text;
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  };
  const current = () => cases[position];
  const mode = () => document.querySelector('input[name="mode"]:checked').value;
  const notify = text => { $('notice').textContent = text; };
  function download(name, value, type = 'application/json') {
    const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
    const url = URL.createObjectURL(new Blob([content], {type}));
    const link = node('a', '', {href: url, download: name});
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const selected = name => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x => x.value);
  function guidedAnswer() {
    return {case_id: current().id, mode: 'guided', actions: current().candidates.filter(c => $(`include-${c.id}`).checked).map(c => ({
      candidate_id: c.id, owners: selected(`owner-${c.id}`), due: $(`due-${c.id}`).value || null, evidence: selected(`evidence-${c.id}`)
    }))};
  }
  function saveDraft() {
    if (!$('candidate-forms').children.length) return;
    drafts.set(current().id, {guided: guidedAnswer(), raw: $('raw-answer').value, mode: mode()});
  }
  function checkbox(label, name, value, checked = false) {
    const wrapper = node('label');
    const input = node('input', null, {type:'checkbox', name, value});
    input.checked = checked; wrapper.append(input, document.createTextNode(label));
    return wrapper;
  }
  function renderGuided(saved) {
    $('candidate-forms').replaceChildren();
    current().candidates.forEach(candidate => {
      const existing = saved?.actions.find(a => a.candidate_id === candidate.id);
      const card = node('div', null, {class:'candidate'});
      const includeLabel = node('label');
      const include = node('input', null, {type:'checkbox', id:`include-${candidate.id}`});
      include.checked = Boolean(existing);
      includeLabel.append(include, document.createTextNode(candidate.task));
      const fields = node('fieldset', null, {class:'fields'});
      fields.disabled = !include.checked;
      fields.append(node('legend', `Details for ${candidate.task}`));
      include.addEventListener('change', () => { fields.disabled = !include.checked; invalidateResult(); });
      const grid = node('div', null, {class:'field-grid'});
      const owners = node('fieldset', null, {class:'check-group'});
      owners.append(node('legend','Stated owner(s)'));
      current().participants.forEach(person => owners.append(checkbox(person, `owner-${candidate.id}`, person, existing?.owners.includes(person))));
      owners.append(node('p','Leave all unchecked if unknown.',{class:'field-note'}));
      const dueBlock = node('div');
      dueBlock.append(node('label','Resolvable deadline',{for:`due-${candidate.id}`}));
      const due = node('input', null, {type:'date',id:`due-${candidate.id}`}); due.value = existing?.due || '';
      dueBlock.append(due,node('p','Leave blank if unstated or unclear.',{class:'field-note'}));
      grid.append(owners,dueBlock); fields.append(grid);
      const evidence = node('fieldset',null,{class:'check-group'}); evidence.append(node('legend','Supporting and modifying lines'));
      const evidenceOptions = node('div',null,{class:'evidence-options'});
      current().lines.forEach(line => evidenceOptions.append(checkbox(line.id,`evidence-${candidate.id}`,line.id,existing?.evidence.includes(line.id))));
      evidence.append(evidenceOptions); fields.append(evidence); card.append(includeLabel,fields); $('candidate-forms').append(card);
    });
  }
  function renderReference() {
    const host = $('reference'); host.replaceChildren();
    host.append(node('p',current().pair_change));
    current().candidates.forEach(candidate => {
      const expected = candidate.expected;
      const article = node('article');
      article.append(node('h3',`${expected.include ? 'Keep' : 'Leave out'}: ${candidate.task}`));
      if (expected.include) article.append(node('p',`Owner(s): ${expected.owners.join(', ') || 'not established'}. Deadline: ${expected.due || 'not established'}.`));
      article.append(node('p',expected.explanation),node('p',`Explanation lines: ${expected.evidence.join(', ')}`,{class:'small'}));
      if(expected.include) article.append(node('p',`Sufficient citation set(s): ${(expected.evidence_sets || [expected.evidence]).map(set=>set.join(' + ')).join(' OR ')}.`,{class:'small'}));
      host.append(article);
    });
  }
  function invalidateResult() {
    lastCheck = null; $('results').hidden = true; $('download-result').disabled = true;
  }
  function setMode() {
    $('guided').hidden = mode() !== 'guided'; $('extraction').hidden = mode() !== 'extraction';
    invalidateResult();
  }
  function loadCase(index) {
    saveDraft(); position = index; parsed = null;
    const item = current(), saved = drafts.get(item.id);
    $('case-select').value = item.id;
    $('case-position').textContent = `Case ${position + 1} of ${cases.length} · Pair ${item.pair_id.slice(1)}${item.variant}`;
    $('case-heading').textContent = item.title;
    $('meeting-date').textContent = item.meeting_date;
    $('participants').textContent = `Participants: ${item.participants.join(', ')}`;
    $('transcript').replaceChildren();
    item.lines.forEach(line => {
      const li = node('li'); const body = node('div');
      body.append(node('span',line.speaker,{class:'speaker'}),node('span',line.text,{class:'line-text'}));
      li.append(node('span',line.id,{class:'line-id'}),body); $('transcript').append(li);
    });
    renderGuided(saved?.guided); renderReference();
    $('raw-answer').value = saved?.raw || '';
    document.querySelector(`input[name="mode"][value="${saved?.mode || 'guided'}"]`).checked = true;
    $('mapped-actions').replaceChildren(); $('check-extraction').disabled = true;
    $('answer-key').open = false;
    $('previous').disabled = position === 0; $('next').disabled = position === cases.length-1;
    setMode(); notify('');
  }
  function metric(label, value) { const item = node('div'); item.append(node('strong',value),document.createTextNode(label)); return item; }
  function showResult(answer) {
    let result;
    try { result = engine.scoreCase(current(), answer); }
    catch (error) { notify(`Could not check this answer: ${error.message}`); return; }
    lastCheck = {kit_version:'1.0',checked_at:new Date().toISOString(),answer,result};
    const host = $('results'); host.replaceChildren(); host.hidden = false;
    host.className = 'results' + (result.outcome === 'reference_agreement' ? '' : ' needs-attention');
    const titles = {invalid:'Check the answer format',review_needed:'Some judgments still need review',needs_changes:'Compare these differences',reference_agreement:'This answer agrees with the reference'};
    host.append(node('h2',titles[result.outcome] || 'Check result',{id:'result-title'}),node('p',result.summary || 'Read the detailed comparison below.'));
    if (result.mode === 'extraction') host.append(node('p','Task identity depends on your review. These field comparisons are conditional on those mappings; the tool did not judge the task wording.',{class:'small'}));
    if (result.selection && result.fields) {
      const metrics = node('div',null,{class:'result-metrics'});
      const ratio=(num,den)=>den ? `${num} / ${den}` : 'Not applicable';
      metrics.append(metric('open actions matched',result.selection.expected ? `${result.selection.matched} / ${result.selection.expected}` : 'None expected'),metric('owner fields agree',ratio(result.fields.owners.agreed,result.fields.owners.compared)),metric('deadline fields agree',ratio(result.fields.due.agreed,result.fields.due.compared)),metric('sufficient citations covered',ratio(result.fields.evidence.covered,result.fields.evidence.compared)));
      host.append(metrics);
    }
    const issues = node('ul');
    (result.errors || []).forEach(error => issues.append(node('li',`${error.path || error.code}: ${error.message}`)));
    (result.selection?.omitted || []).forEach(id => issues.append(node('li',`${result.selection.provisional ? 'Not yet matched' : 'Missing open action'}: ${current().candidates.find(c=>c.id===id)?.task || id}.`)));
    (result.rows || []).forEach(row => {
      if ((row.issues || []).length) {
        const label=row.task || current().candidates.find(c=>c.id===row.candidate_id)?.task;
        const detail=node('li',`Action ${row.index + 1}${label ? ` (${label})` : ''}: ${row.issues.join(', ').replaceAll('_',' ').toLowerCase()}.`);
        if(row.owners?.status==='disagree') detail.append(node('p',`Reference owner(s): ${(row.owners.expected || []).join(', ') || 'not established'}. Submitted: ${(row.owners.actual || []).join(', ') || 'none'}.`,{class:'small'}));
        if(row.due?.status==='disagree') detail.append(node('p',`Reference deadline: ${row.due.expected || 'not established'}. Submitted: ${row.due.actual || 'none'}.`,{class:'small'}));
        issues.append(detail);
      }
    });
    if (issues.children.length) host.append(issues);
    if(result.factual_agreement === true && result.citation_coverage === false) host.append(node('p','Action selections and factual fields agree. The remaining issue is citation coverage, not a factual disagreement.'));
    host.append(node('p','Citation coverage checks line numbers against accepted evidence sets. It does not prove that the cited text entails the answer. Open the reference below to inspect the explanation.',{class:'small'}));
    const details = node('details'); details.append(node('summary','Full machine-readable comparison'),node('pre',JSON.stringify(result,null,2))); host.append(details);
    $('download-result').disabled = false; host.focus();
  }
  function parseAnswer() {
    invalidateResult(); $('mapped-actions').replaceChildren(); $('check-extraction').disabled = true; parsed = null;
    try {
      const raw = $('raw-answer').value;
      if (raw.length > 64000) throw new Error('Keep the response below 64,000 characters.');
      const value = JSON.parse(raw);
      if (!value || Array.isArray(value) || typeof value !== 'object' || !Array.isArray(value.actions)) throw new Error('Use an object with an actions array.');
      if (Object.keys(value).some(key => !['case_id','actions'].includes(key))) throw new Error('Top-level fields may only be case_id and actions.');
      if (value.case_id !== undefined && value.case_id !== current().id) throw new Error('The case_id does not match the selected case.');
      if (value.actions.length > 50) throw new Error('Use at most 50 actions.');
      value.actions.forEach((action,index) => {
        if (!action || typeof action !== 'object' || Array.isArray(action)) throw new Error(`Action ${index+1} must be an object.`);
        if (Object.keys(action).some(key => !['task','owners','due','evidence'].includes(key))) throw new Error(`Action ${index+1} has an unsupported field. Use task, owners, due and evidence.`);
        if (typeof action.task !== 'string' || !action.task.trim() || action.task.length > 2000) throw new Error(`Action ${index+1} needs a task of 1–2,000 characters.`);
        if (!Array.isArray(action.owners) || !action.owners.every(x=>typeof x==='string') || !Array.isArray(action.evidence) || !action.evidence.every(x=>typeof x==='string') || !(action.due===null || typeof action.due==='string')) throw new Error(`Action ${index+1} needs owners and evidence arrays and due as an ISO date or null.`);
      });
      parsed = value.actions;
      parsed.forEach((action,index) => {
        const row = node('div',null,{class:'mapping-row'}); row.append(node('h4',`${index+1}. ${action.task}`));
        row.append(node('p',`Owner(s): ${action.owners.join(', ') || 'none stated'} · Deadline: ${action.due || 'none stated'}`,{class:'small'}),node('p',`Citations: ${action.evidence.join(', ') || 'none'}`,{class:'small'}));
        row.append(node('label','Match the task meaning',{for:`mapping-${index}`}));
        const select = node('select',null,{id:`mapping-${index}`});
        select.append(node('option','Choose a match or mark unresolved',{value:''}));
        current().candidates.forEach(candidate=>select.append(node('option',candidate.task,{value:candidate.id})));
        select.append(node('option','No candidate matches; review the source/key',{value:'__extra__'}),node('option','No current action in the notes supports this task',{value:'__unsupported__'}),node('option','Uncertain task meaning',{value:'__uncertain__'}),node('option','The reference may be missing a valid action',{value:'__reference_issue__'}));
        const confirmLabel = node('label',null,{class:'confirm'}); const confirm = node('input',null,{type:'checkbox',id:`reviewed-${index}`});
        const normalConfirmation='I checked the task meaning against the notes. Owner and deadline claims remain unchanged for scoring.';
        const confirmationText=node('span',normalConfirmation);
        confirmLabel.append(confirm,confirmationText);
        select.addEventListener('change',()=>{confirm.checked=false;confirmationText.textContent=select.value==='__unsupported__'?'I checked all the notes and confirmed that no current action supports this task.':normalConfirmation;invalidateResult();}); confirm.addEventListener('change',invalidateResult);
        row.append(select,confirmLabel); $('mapped-actions').append(row);
      });
      $('check-extraction').disabled = false;
      notify(parsed.length ? 'Review each task match, then check the extraction. Unresolved matches will remain flagged.' : 'This response contains no actions. Check it to compare against the reference.');
    } catch(error) { notify(`Could not load response: ${error.message}`); }
  }
  function extractionAnswer() {
    return {case_id:current().id,mode:'extraction',actions:parsed.map((action,index)=>{
      const mapping=$(`mapping-${index}`).value;
      const extra = {candidate_id:mapping && !['__uncertain__','__reference_issue__'].includes(mapping)?mapping:null,semantic_reviewed:$(`reviewed-${index}`).checked};
      if (mapping==='__unsupported__') {extra.candidate_id='__extra__';extra.review_state='unsupported';}
      if (mapping==='__uncertain__') extra.review_state='uncertain';
      if (mapping==='__reference_issue__') extra.review_state='reference_issue';
      return {...action,...extra};
    })};
  }
  cases.forEach((item,index)=>$('case-select').append(node('option',`${String(index+1).padStart(2,'0')} · ${item.title} (${item.variant})`,{value:item.id})));
  $('case-select').addEventListener('change',e=>loadCase(cases.findIndex(c=>c.id===e.target.value)));
  $('previous').addEventListener('click',()=>loadCase(Math.max(0,position-1)));
  $('next').addEventListener('click',()=>loadCase(Math.min(cases.length-1,position+1)));
  $('pair').addEventListener('click',()=>{const other=cases.findIndex(c=>c.pair_id===current().pair_id && c.id!==current().id);if(other>=0)loadCase(other);});
  document.querySelectorAll('input[name="mode"]').forEach(input=>input.addEventListener('change',setMode));
  $('candidate-forms').addEventListener('change',invalidateResult);
  $('raw-answer').addEventListener('input',()=>{parsed=null;$('check-extraction').disabled=true;$('mapped-actions').replaceChildren();invalidateResult();});
  $('check-guided').addEventListener('click',()=>showResult(guidedAnswer()));
  $('parse-answer').addEventListener('click',parseAnswer);
  $('check-extraction').addEventListener('click',()=>{if(parsed)showResult(extractionAnswer());});
  $('copy-prompt').addEventListener('click',()=>download(`${current().id}-prompt.txt`,engine.makePrompt(current()),'text/plain'));
  $('download-case').addEventListener('click',()=>download(`${current().id}-with-key.json`,current()));
  $('download-dataset').addEventListener('click',()=>download('meeting-notes-cases.json',dataset));
  $('download-result').addEventListener('click',()=>{if(lastCheck)download(`${current().id}-checked-answer.json`,lastCheck);});
  loadCase(0);
})();
