(() => {
  'use strict';
  const REPO = 'shinsihu10123/ProceduralCity';
  const BRANCH = 'execution/controller-v1';
  const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/production/execution`;
  const POLL_MS = 45000;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '—').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const shortSha = sha => sha ? `${sha.slice(0, 9)}…` : '—';

  async function fetchText(name, fallback) {
    const stamp = Date.now();
    const urls = [`${RAW}/${name}?v=${stamp}`, fallback];
    let lastError;
    for (const url of urls) {
      try {
        const res = await fetch(url, {cache: 'no-store'});
        if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
        return await res.text();
      } catch (err) { lastError = err; }
    }
    throw lastError;
  }

  async function load() {
    document.body.classList.add('loading');
    try {
      const [stateText, dryText, ledgerText] = await Promise.all([
        fetchText('STATE.json', './data/STATE.json'),
        fetchText('DRY_RUN.json', './data/DRY_RUN.json'),
        fetchText('WP_LEDGER.jsonl', './data/WP_LEDGER.jsonl')
      ]);
      const state = JSON.parse(stateText);
      const dry = JSON.parse(dryText);
      const ledger = ledgerText.split(/\r?\n/).filter(Boolean).map((line, index) => {
        try { return JSON.parse(line); }
        catch { throw new Error(`WP_LEDGER.jsonl line ${index + 1} is malformed`); }
      });
      validate(state, dry, ledger);
      render(state, dry, ledger);
      setHealth(state);
      $('lastRefresh').textContent = `refresh ${new Date().toLocaleTimeString('ko-KR')}`;
    } catch (err) {
      $('healthDot').className = 'dot bad';
      $('healthText').textContent = 'DATA ERROR';
      showWarning(`Dashboard data load failed: ${err.message}`);
    } finally {
      document.body.classList.remove('loading');
    }
  }

  function validate(state, dry, ledger) {
    const stateFields = ['authority_version','total_wp','completed_wp_count','execution_state','completed_wps','blocked_wps','automation_enabled','updated_at'];
    for (const key of stateFields) if (!(key in state)) throw new Error(`STATE.json missing ${key}`);
    if (!Array.isArray(state.completed_wps) || !Array.isArray(state.blocked_wps)) throw new Error('STATE arrays malformed');
    if (!Array.isArray(dry.frontier)) throw new Error('DRY_RUN frontier malformed');
    if (!Array.isArray(ledger)) throw new Error('ledger malformed');
  }

  function render(state, dry, ledger) {
    const closed = state.completed_wp_count;
    const blocked = state.blocked_wps.length;
    const remaining = Math.max(0, state.total_wp - closed - blocked);
    const pct = state.total_wp ? (closed / state.total_wp * 100) : 0;
    $('totalWp').textContent = state.total_wp;
    $('closedWp').textContent = closed;
    $('blockedWp').textContent = blocked;
    $('remainingWp').textContent = remaining;
    $('progressPct').textContent = `${pct.toFixed(1)}%`;
    $('progressBar').style.width = `${Math.min(100, pct)}%`;

    $('executionState').textContent = state.execution_state;
    $('currentWp').textContent = state.current_wp || 'none / IDLE';
    $('currentScope').textContent = state.current_subsystem || '—';
    $('currentL3').textContent = state.current_l3 || '—';
    $('memberProgress').textContent = `${state.current_member_index ?? 0} / ${state.current_member_count ?? 0}`;
    $('correction').textContent = `${state.correction_cycle} / ${state.correction_limit}`;
    $('workerResult').textContent = state.last_worker_result || '—';

    $('nextWp').textContent = dry.selected_next || state.next_dependency_safe_wp || 'none';
    $('nextScope').textContent = dry.selected_stage ? `${dry.selected_stage} · ${(dry.selected_subsystems || []).join(', ')} · ${(dry.selected_l3_range || []).join(' → ')}` : '—';
    $('preds').textContent = (dry.selected_hard_predecessors || []).join(', ') || 'none';
    $('frontier').textContent = (dry.frontier || []).join(' · ') || 'empty';
    $('selectionReason').textContent = dry.reason || '—';

    const validation = state.last_validation || {};
    $('validationWp').textContent = validation.wp_id || '—';
    const checks = [
      ['fmt', validation.format],
      ['clippy', validation.clippy],
      ['workspace', validation.workspace_tests],
      ['dedicated', validation.dedicated_tests ? `${validation.dedicated_tests.status} ${validation.dedicated_tests.passed}/${(validation.dedicated_tests.passed || 0) + (validation.dedicated_tests.failed || 0)}` : '—']
    ];
    $('checks').innerHTML = checks.map(([name, result]) => `<div class="check"><span>${esc(name)}</span><strong class="${String(result).startsWith('PASS') ? 'pass' : String(result).startsWith('FAIL') ? 'fail' : ''}">${esc(result || '—')}</strong></div>`).join('');
    $('validatedCommit').textContent = shortSha(state.last_validated_commit);
    $('evidenceCommit').textContent = shortSha(state.evidence_commit);
    $('ciRuns').innerHTML = (state.last_ci?.runs || []).map(run => `<a class="ci-run" href="https://github.com/${REPO}/actions/runs/${encodeURIComponent(run.run_id)}" target="_blank" rel="noopener"><span>${esc(run.name)}</span><strong class="${run.conclusion === 'success' ? 'pass' : 'fail'}">${esc(run.conclusion)}</strong></a>`).join('') || '<span>CI data unavailable</span>';

    const enabled = state.automation_enabled === true;
    $('automationPill').textContent = enabled ? 'ENABLED' : 'GATED';
    $('automationPill').className = `pill ${enabled ? '' : 'danger'}`;
    $('controllerMode').textContent = state.controller_mode || '—';
    $('workerStatus').textContent = state.worker_status || '—';
    $('automationEnabled').textContent = enabled ? 'YES' : 'NO';
    $('blocker').textContent = state.blocker ? (typeof state.blocker === 'string' ? state.blocker : JSON.stringify(state.blocker)) : 'none';
    $('updatedAt').textContent = formatTime(state.updated_at);
    $('authority').textContent = `Authority ${state.authority_version}`;

    const recent = ledger.slice(-10).reverse();
    $('history').innerHTML = recent.map(row => {
      const tests = row.dedicated_test_count == null ? '—' : row.dedicated_test_count;
      const ci = Array.isArray(row.ci_runs) && row.ci_runs.length ? row.ci_runs.map(id => `<a href="https://github.com/${REPO}/actions/runs/${encodeURIComponent(id)}" target="_blank" rel="noopener">${esc(id)}</a>`).join(' · ') : '—';
      const evidence = row.evidence_ref ? `<code>${esc(row.evidence_ref.split('/').pop() || row.evidence_ref)}</code>` : '—';
      return `<tr><td><strong>${esc(row.wp_id)}</strong></td><td>${esc(row.subsystem)} · ${esc(row.member_ids?.first)}${row.member_ids?.last !== row.member_ids?.first ? ` → ${esc(row.member_ids?.last)}` : ''}</td><td class="${String(row.verdict).startsWith('PASS') ? 'pass' : ''}">${esc(row.verdict)}</td><td>${esc(tests)}</td><td>${ci}</td><td>${evidence}</td></tr>`;
    }).join('') || '<tr><td colspan="6">No ledger entries.</td></tr>';
  }

  function formatTime(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value || '—') : d.toLocaleString('ko-KR', {timeZone:'Asia/Seoul'});
  }

  function setHealth(state) {
    const updated = new Date(state.updated_at).getTime();
    const age = Date.now() - updated;
    const active = !['IDLE','WAITING','CLOSED'].includes(state.execution_state);
    if (!Number.isFinite(updated)) {
      $('healthDot').className = 'dot bad';
      $('healthText').textContent = 'INVALID TIME';
      showWarning('STATE updated_at is invalid.');
    } else if (active && age > 15 * 60 * 1000) {
      $('healthDot').className = 'dot warn';
      $('healthText').textContent = 'STALE ACTIVE';
      showWarning('Active worker state has not updated for more than 15 minutes. Execution may be stalled.');
    } else {
      $('healthDot').className = 'dot ok';
      $('healthText').textContent = active ? 'ACTIVE' : 'HEALTHY / IDLE';
      hideWarning();
    }
  }

  function showWarning(text) { $('warning').textContent = text; $('warning').classList.remove('hidden'); }
  function hideWarning() { $('warning').classList.add('hidden'); }

  load();
  window.setInterval(load, POLL_MS);
})();
