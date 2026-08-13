import { EconomicWorld } from './core/world-v09.js';

let world = new EconomicWorld('ECON-4-001');
let selectedCountryId = 'AST';

const fmt = (n, digits = 2) => Number(n || 0).toLocaleString('ko-KR', { maximumFractionDigits: digits });
const pct = n => `${(Number(n || 0) * 100).toFixed(1)}%`;
const signedPct = n => `${Number(n || 0) >= 0 ? '+' : ''}${(Number(n || 0) * 100).toFixed(2)}%`;
const sci = n => Number(n || 0).toExponential(2);
const line = (name, value) => `${String(name).padEnd(22, ' ')} ${value}`;
const clip = (value, digits = 4) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-';

const REGIME_NAMES = {
  normal: '정상',
  recession: '침체',
  inflation: '인플레이션',
  overheating: '과열',
  credit_crisis: '신용위기',
  external_crisis: '대외위기'
};

function render() {
  const snap = world.snapshot();
  document.getElementById('month').textContent = `${snap.month}개월`;
  renderCountryCards(snap);
  setupCountrySelect(snap);

  const c = snap.countries.find(x => x.id === selectedCountryId) || snap.countries[0];
  setText('cognitiveOverview', formatCognitiveOverview(c));
  setText('householdTrace', formatHousehold(c));
  setText('firmTrace', formatFirm(c));
  setText('internationalTrace', formatInternational(c));
  setText('centralBankTrace', formatPolicyAgent(c.sampleCentralBank, c.sampleCentralBankCognition, c.sampleCentralBankHypotheses, 'Central Bank'));
  setText('monetaryTrace', formatMonetary(c));
  setText('assetTrace', formatAssets(c));
  setText('bankTrace', formatPolicyAgent(c.sampleBank, c.sampleBankCognition, c.sampleBankHypotheses, 'Commercial Bank'));
  setText('governmentTrace', formatPolicyAgent(c.sampleGovernment, c.sampleGovernmentCognition, c.sampleGovernmentHypotheses, 'Government'));
  setText('fiscalTrace', formatFiscal(c));
  setText('industryTrace', formatIndustry(c));
  setText('marketTrace', formatMacroAndAccounting(c));
  setText('financialTrace', formatFinancials(c));
  setText('journalTrace', formatJournals(c));
  setText('transactionTrace', formatTransactions(c));
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function renderCountryCards(snap) {
  const root = document.getElementById('countries');
  root.innerHTML = snap.countries.map(c => {
    const cog = c.cognitive || {};
    const regimes = cog.regimes || {};
    const crisis = Number(regimes.credit_crisis || 0) + Number(regimes.external_crisis || 0);
    return `
      <article class="country-card ${c.id === selectedCountryId ? 'selected' : ''}" data-country="${c.id}">
        <div class="country-head"><span>${c.id}</span><h2>${c.name}</h2></div>
        <div class="metrics">
          <div><small>GDP</small><strong>${fmt(c.macro.gdp)}</strong></div>
          <div><small>실업률</small><strong>${pct(c.macro.unemployment)}</strong></div>
          <div><small>정책금리</small><strong>${pct(c.macro.policyRate)}</strong></div>
          <div><small>환율 / WXU</small><strong>${fmt(c.fx?.rate, 3)}</strong></div>
          <div><small>L3+L4 추론</small><strong>${fmt(Number(c.macro.cognitiveL3 || 0) + Number(c.macro.cognitiveL4 || 0), 0)}</strong></div>
          <div><small>가설검증</small><strong>${fmt(cog.hypothesisTests, 0)}</strong></div>
          <div><small>인과학습</small><strong>${fmt(cog.causalUpdates, 0)}</strong></div>
          <div><small>위기판단 Agent</small><strong>${fmt(crisis, 0)}</strong></div>
        </div>
        <footer>인지 Agent ${fmt(cog.agents,0)} · 해결기억 ${fmt(cog.resolvedEpisodes,0)} · 유사경험 준비 ${fmt(cog.analogyReadyAgents,0)} · 국제회계 ${c.internationalAccounting?.accountingOk ? 'PASS' : 'FAIL'}</footer>
      </article>`;
  }).join('');

  for (const el of root.querySelectorAll('[data-country]')) {
    el.addEventListener('click', () => {
      selectedCountryId = el.dataset.country;
      document.getElementById('countrySelect').value = selectedCountryId;
      render();
    });
  }
}

function setupCountrySelect(snap) {
  const select = document.getElementById('countrySelect');
  if (!select.options.length) {
    for (const c of snap.countries) select.add(new Option(`${c.id} · ${c.name}`, c.id));
    select.addEventListener('change', () => {
      selectedCountryId = select.value;
      render();
    });
  }
  select.value = selectedCountryId;
}

function formatCognitiveOverview(c) {
  const x = c.cognitive || {};
  const regimes = x.regimes || {};
  return [
    `${c.id} · Deep Cognitive Architecture v0.9`,
    '',
    '[사고 깊이 / Attention]',
    line('L0 Habit', fmt(c.macro.cognitiveL0, 0)),
    line('L1 Routine', fmt(c.macro.cognitiveL1, 0)),
    line('L2 Deliberative', fmt(c.macro.cognitiveL2, 0)),
    line('L3 Counterfactual', fmt(c.macro.cognitiveL3, 0)),
    line('L4 Deep Strategic', fmt(c.macro.cognitiveL4, 0)),
    '',
    '[학습 누적]',
    line('해결된 경험기억', fmt(x.resolvedEpisodes, 0)),
    line('예측 해결건수', fmt(x.resolvedForecasts, 0)),
    line('인과계수 업데이트', fmt(x.causalUpdates, 0)),
    line('근거있는 인과링크', fmt(x.causalLinksWithEvidence, 0)),
    line('가설 검증횟수', fmt(x.hypothesisTests, 0)),
    line('가설학습 Agent', fmt(x.hypothesisCalibratedAgents, 0)),
    line('유사경험 사용가능', fmt(x.analogyReadyAgents, 0)),
    line('평균 국면불확실성', pct(x.meanRegimeUncertainty)),
    '',
    '[Agent별 경제국면 판단]',
    ...Object.entries(regimes).map(([key, value]) => line(REGIME_NAMES[key] || key, fmt(value, 0))),
    '',
    '주의: 이 인과모형은 Agent가 경험으로 학습한 내부 가설이며, 객관적 인과관계의 정답으로 취급하지 않는다.'
  ].join('\n');
}

function formatHousehold(c) {
  const h = c.sampleHousehold;
  const cog = c.sampleHouseholdCognition;
  if (!h || !cog) return '가계 표본 없음';
  const t = h.lastTrace || {};
  return [
    `${h.id} · Household`,
    line('상태', h.employed ? '고용' : '실업'),
    line('예금', fmt(h.wealth)),
    line('대출', fmt(h.loanBalance)),
    line('소비', fmt(h.consumption)),
    '',
    ...formatCognitionBlock(cog, t, c.sampleHouseholdHypotheses, 'incomeGrowth')
  ].join('\n');
}

function formatFirm(c) {
  const f = c.sampleFirm;
  const cog = c.sampleFirmCognition;
  if (!f || !cog) return '기업 표본 없음';
  const t = f.lastTrace || {};
  return [
    `${f.id} · ${f.industryId || '-'} · Firm`,
    line('가격', fmt(f.price, 3)),
    line('고용', `${fmt(f.workers,0)}명`),
    line('현금', fmt(f.cash)),
    line('부채', fmt(f.loanBalance)),
    line('생산', fmt(f.output)),
    line('재고', fmt(f.inventory)),
    '',
    ...formatCognitionBlock(cog, t, c.sampleFirmHypotheses, 'demandGrowth')
  ].join('\n');
}

function formatPolicyAgent(agent, cog, hypothesisRows, label) {
  if (!agent || !cog) return `${label} 표본 없음`;
  const t = agent.lastTrace || {};
  return [
    `${agent.id} · ${label}`,
    ...(agent.policyRate !== undefined ? [line('정책금리', pct(agent.policyRate))] : []),
    ...(agent.minCapitalRatio !== undefined ? [line('최소자본비율', pct(agent.minCapitalRatio))] : []),
    '',
    ...formatCognitionBlock(cog, t, hypothesisRows, label === 'Commercial Bank' ? 'creditDefaultRate' : label === 'Central Bank' ? 'inflation' : 'unemployment')
  ].join('\n');
}

function formatCognitionBlock(cog, trace, hypothesisRows, targetMetric) {
  const regime = cog.regime || {};
  const probabilities = regime.probabilities || {};
  const memory = trace.memoryReasoning || {};
  const causal = trace.causalReasoning || {};
  const candidates = trace.candidates || trace.counterfactuals || [];
  const calibration = cog.calibration || {};
  const strongestLinks = (cog.causalModel?.links || [])
    .slice()
    .sort((a, b) => (Number(b.confidence || 0) * Math.abs(Number(b.coefficient || 0))) - (Number(a.confidence || 0) * Math.abs(Number(a.coefficient || 0))))
    .slice(0, 6);

  return [
    '[경제국면 추론]',
    line('현재 국면', `${REGIME_NAMES[regime.current] || regime.current || '-'} / 신뢰 ${pct(regime.confidence)}`),
    line('국면 불확실성', pct(regime.uncertainty)),
    line('Attention', `L${cog.attention?.level ?? '-'} · ${cog.attention?.trigger || '-'}`),
    ...Object.entries(probabilities).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `- ${REGIME_NAMES[k] || k}: ${pct(v)}`),
    '',
    '[현재 가설 + 경험 적중률]',
    ...((trace.hypotheses || []).length
      ? trace.hypotheses.slice(0,6).map(h => `- ${h.name}: 현재 ${pct(h.confidence)} · 경험신뢰 ${h.learnedReliability === undefined ? '-' : pct(h.learnedReliability)} · 검증 ${fmt(h.hypothesisTests,0)}회`)
      : ['- 없음']),
    '',
    '[과거 유사국면 검색]',
    ...((memory.analogies || []).length
      ? memory.analogies.slice(0,5).map(a => `- M${a.month}: 유사도 ${pct(a.similarity)} · 당시 ${a.decision || '-'} · 보상 ${fmt(a.reward,3)}`)
      : ['- 아직 충분한 유사 경험 없음']),
    '',
    '[학습된 인과모형 - 강한 링크]',
    ...(strongestLinks.length
      ? strongestLinks.map(x => `- ${x.cause} → ${x.effect}: β=${clip(x.coefficient,4)} · 신뢰 ${pct(x.confidence)} · n=${fmt(x.observations,0)}`)
      : ['- 아직 학습 없음']),
    '',
    '[반사실적 후보]',
    ...(candidates.length
      ? candidates.slice(0,8).map(x => `- ${x.name}: 위험조정 ${fmt(x.utility,4)} · 기대 ${fmt(x.expectedUtility,4)} · 하방 ${fmt(x.downside,4)}`)
      : ['- 현재 후보 없음']),
    '',
    '[예측 Calibration]',
    ...(Object.keys(calibration).length
      ? Object.entries(calibration).slice(0,8).map(([key, stat]) => `- ${key}: n=${fmt(stat.count,0)} · bias=${clip(stat.bias,4)} · MAE=${clip(stat.mae,4)}`)
      : ['- 아직 해결된 예측 없음']),
    '',
    `[선택] ${trace.selected || trace.selectedPlan || '-'} · ${trace.reason || '-'}`,
    `[관심예측] ${targetMetric}: ${trace.forecast?.[targetMetric] === undefined ? '-' : clip(trace.forecast[targetMetric],4)}`,
    ...(hypothesisRows?.length ? ['', '[장기 가설 성과]', ...hypothesisRows.slice(0,6).map(h => `- ${h.name}: 신뢰 ${pct(h.reliability)} · ${fmt(h.successes,0)}성공/${fmt(h.failures,0)}실패 · ${fmt(h.tests,0)}검증`)] : [])
  ];
}

function formatInternational(c) {
  const i = c.international || {};
  const p = c.internationalPosition || {};
  const funding = c.foreignFundingTrace || {};
  return [
    `${c.id} · International Economy`,
    line('환율 / WXU', `${fmt(c.fx?.rate,4)} (${signedPct(c.fx?.lastChange)})`),
    line('수출', `${fmt(i.exportsWXU)} WXU`),
    line('수입', `${fmt(i.importsWXU)} WXU`),
    line('경상수지', `${fmt(i.currentAccountWXU)} WXU`),
    line('순대외자산', `${fmt(i.netForeignAssetsWXU)} WXU`),
    line('대외부채', `${fmt(i.foreignDebtWXU)} WXU`),
    line('대외스트레스', fmt(i.externalStress,4)),
    line('해외대출자산', `${fmt(p.foreignLoansWXU)} WXU`),
    line('해외차입', `${fmt(p.foreignBorrowingWXU)} WXU`),
    '',
    '[최근 해외자금 판단]',
    funding.selected ? `${funding.lenderCountryId} → ${funding.borrowerCountryId}\n${funding.selected} · ${funding.reason || ''}` : '- 없음',
    ...(funding.memoryReasoning?.analogies?.length ? ['', '[해외위기 유사경험]', ...funding.memoryReasoning.analogies.slice(0,4).map(a => `- M${a.month}: 유사도 ${pct(a.similarity)} · ${a.decision || '-'}`)] : []),
    '',
    '[세계 국제회계]',
    `X-M ${sci(c.globalInternational?.tradeErrorWXU)} · CA합 ${sci(c.globalInternational?.currentAccountErrorWXU)} · NFA합 ${sci(c.globalInternational?.nfaErrorWXU)}`,
    `판정 ${c.globalInternational?.ok ? 'PASS' : 'FAIL'}`
  ].join('\n');
}

function formatMonetary(c) {
  const m = c.monetary || {};
  return [
    `${c.id} · Monetary`,
    line('정책기조', m.stance || '-'),
    line('정책금리', pct(m.policyRate)),
    line('준비금', fmt(m.reserves)),
    line('목표준비금', fmt(m.targetReserves)),
    line('중앙은행대출', fmt(m.outstandingFacilities)),
    `회계 ${c.monetaryAccounting?.accountingOk ? 'PASS' : 'FAIL'}`
  ].join('\n');
}

function formatAssets(c) {
  const a = c.assetMarket || {};
  return [
    `${c.id} · Equity Market`,
    line('주가지수', fmt(a.equityIndex)),
    line('월수익률', signedPct(a.indexReturn)),
    line('시가총액', fmt(a.marketCapitalization)),
    line('신주발행', fmt(a.primaryIssuance)),
    line('2차시장거래', fmt(a.secondaryTurnover)),
    `회계 ${c.assetMarketAccounting?.accountingOk ? 'PASS' : 'FAIL'}`
  ].join('\n');
}

function formatFiscal(c) {
  const f = c.fiscal || {};
  return [
    `${c.id} · Fiscal`,
    line('세수', fmt(f.taxRevenue)),
    line('정부소비', fmt(f.governmentConsumption)),
    line('공공투자', fmt(f.publicInvestment)),
    line('재정수지', fmt(f.overallBalance)),
    line('공공부채', fmt(f.publicDebt)),
    `회계 ${c.fiscalAccounting?.accountingOk ?? c.fiscal?.accountingOk ? 'PASS' : 'CHECK'}`
  ].join('\n');
}

function formatIndustry(c) {
  const rows = c.industryStats || c.industries || [];
  if (!Array.isArray(rows) || !rows.length) return `${c.id} · 산업/공급망\n표본 산업 통계는 현재 snapshot에 없음`;
  return [`${c.id} · Industry`, ...rows.slice(0,12).map(x => `- ${x.id || x.name}: 생산 ${fmt(x.output)} · 재고 ${fmt(x.inventory)}`)].join('\n');
}

function formatMacroAndAccounting(c) {
  const m = c.macro || {};
  return [
    `${c.id} · Open Economy Macro`,
    line('GDP', fmt(m.gdp)),
    line('소비', fmt(m.consumption)),
    line('민간투자', fmt(m.grossInvestment)),
    line('공공투자', fmt(m.publicInvestment)),
    line('정부소비', fmt(m.governmentConsumption)),
    line('재고투자', fmt(m.inventoryInvestment)),
    line('수출', fmt(m.exports)),
    line('수입', fmt(m.imports)),
    line('실업률', pct(m.unemployment)),
    line('물가지수', fmt(m.priceIndex,3)),
    '',
    '[불변식]',
    `Settlement ${c.accounting?.settlement?.ok ?? c.settlementAccounting?.ok ? 'PASS' : 'CHECK'}`,
    `International ${c.internationalAccounting?.accountingOk ? 'PASS' : 'FAIL'}`,
    `Global External ${c.globalInternational?.ok ? 'PASS' : 'FAIL'}`
  ].join('\n');
}

function formatFinancials(c) {
  const blocks = [
    ['Household', c.sampleHouseholdFinancials],
    ['Firm', c.sampleFirmFinancials],
    ['Bank', c.sampleBankFinancials],
    ['Central Bank', c.sampleCentralBankFinancials],
    ['Government', c.sampleGovernmentFinancials]
  ];
  return blocks.map(([name, value]) => {
    if (!value) return `[${name}] 없음`;
    const bs = value.balanceSheet || {};
    const is = value.incomeStatement || {};
    return `[${name}] A ${fmt(bs.assets)} / L ${fmt(bs.liabilities)} / E ${fmt(bs.equity)} / Net ${fmt(is.netIncome)}`;
  }).join('\n');
}

function formatJournals(c) {
  const groups = [
    ...(c.sampleHouseholdJournals || []),
    ...(c.sampleFirmJournals || []),
    ...(c.sampleBankJournals || []),
    ...(c.sampleCentralBankJournals || []),
    ...(c.sampleGovernmentJournals || [])
  ];
  if (!groups.length) return '최근 표본 분개 없음';
  return groups.slice(-18).reverse().map(j => `${j.id || ''} M${j.month} ${j.entityId || ''} · ${j.kind}`).join('\n');
}

function formatTransactions(c) {
  const rows = [
    ...(c.recentTransactions || []),
    ...(c.recentFinancialTransactions || []),
    ...(c.recentInternationalTrades || [])
  ];
  if (!rows.length) return '최근 Settlement 없음';
  return rows.slice(-22).reverse().map(x => {
    if (x.exporterId) return `M${x.month} ${x.exporterId}→${x.importerId} · ${x.product} · ${fmt(x.worldValue)} WXU`;
    return `M${x.month} ${x.kind || '-'} · ${fmt(x.amount)}`;
  }).join('\n');
}

function step(n) {
  world.step(n);
  render();
}

document.getElementById('step1').addEventListener('click', () => step(1));
document.getElementById('step12').addEventListener('click', () => step(12));
document.getElementById('reset').addEventListener('click', () => {
  world = new EconomicWorld('ECON-4-001');
  selectedCountryId = 'AST';
  render();
});

render();
