import { EconomicWorld } from './core/world.js';

let world = new EconomicWorld('ECON-4-001');
let selectedCountryId = 'AST';

const fmt = (n, digits = 1) => Number(n || 0).toLocaleString('ko-KR', { maximumFractionDigits: digits });
const pct = n => `${(Number(n || 0) * 100).toFixed(1)}%`;

function render() {
  const snap = world.snapshot();
  document.getElementById('month').textContent = `${snap.month}개월`;
  const root = document.getElementById('countries');
  root.innerHTML = snap.countries.map(c => `
    <article class="country-card ${c.id === selectedCountryId ? 'selected' : ''}" data-country="${c.id}">
      <div class="country-head"><span>${c.id}</span><h2>${c.name}</h2></div>
      <div class="metrics">
        <div><small>GDP</small><strong>${fmt(c.macro.gdp)}</strong></div>
        <div><small>CPI</small><strong>${fmt(c.macro.priceIndex, 3)}</strong></div>
        <div><small>실업률</small><strong>${pct(c.macro.unemployment)}</strong></div>
        <div><small>평균임금</small><strong>${fmt(c.macro.avgWage)}</strong></div>
        <div><small>소비</small><strong>${fmt(c.macro.consumption)}</strong></div>
        <div><small>상품거래</small><strong>${fmt(c.macro.goodsTransactions, 0)}</strong></div>
        <div><small>화폐량</small><strong>${fmt(c.macro.moneySupply)}</strong></div>
        <div><small>미충족수요</small><strong>${pct(c.macro.unmetDemandRatio)}</strong></div>
      </div>
      <footer>가계 ${fmt(c.households,0)} · 기업 ${fmt(c.firms,0)} · 장부 ${c.accounting.ok ? 'PASS' : 'FAIL'}</footer>
    </article>`).join('');

  for (const el of root.querySelectorAll('[data-country]')) {
    el.addEventListener('click', () => {
      selectedCountryId = el.dataset.country;
      document.getElementById('countrySelect').value = selectedCountryId;
      render();
    });
  }

  const select = document.getElementById('countrySelect');
  if (!select.options.length) {
    for (const c of snap.countries) select.add(new Option(`${c.id} · ${c.name}`, c.id));
    select.value = selectedCountryId;
    select.addEventListener('change', () => { selectedCountryId = select.value; render(); });
  }

  const country = snap.countries.find(c => c.id === selectedCountryId) || snap.countries[0];
  document.getElementById('householdTrace').textContent = formatHousehold(country.sampleHousehold);
  document.getElementById('firmTrace').textContent = formatFirm(country.sampleFirm);
  document.getElementById('marketTrace').textContent = formatMarkets(country);
  document.getElementById('transactionTrace').textContent = formatTransactions(country);
}

function formatHousehold(h) {
  const t = h.lastTrace;
  if (!t) return `${h.id}\n아직 첫 판단 전입니다. +1개월을 눌러주세요.`;
  const purchases = (h.lastPurchases || []).slice(0, 4);
  return [
    h.id,
    `고용: ${h.employed ? '고용' : '실업'} / 현금잔액: ${fmt(h.wealth)}`,
    `이번달 임금수령: ${fmt(h.income)} / 실제소비: ${fmt(h.consumption)} / 순저축: ${fmt(h.savings)}`,
    `임금미수: ${fmt(h.wageArrears || 0)}`,
    '',
    '[관찰·인식]',
    `인지 물가상승: ${pct(t.perception.inflation)}`,
    `인지 실직위험: ${pct(t.perception.jobRisk)}`,
    `예상 소득증가: ${pct(t.perception.expectedIncomeGrowth)}`,
    '',
    '[가설]',
    ...t.hypotheses.map(x => `- ${x.name}: 확신 ${pct(x.confidence)}`),
    '',
    `[선택] ${t.selected}`,
    `주된 이유: ${t.reason}`,
    '',
    '[실제 구매]',
    ...(purchases.length ? purchases.map(x => `- ${x.firmId}: ${fmt(x.units,2)}단위 × ${fmt(x.price,3)} = ${fmt(x.amount)}`) : ['- 체결 거래 없음'])
  ].join('\n');
}

function formatFirm(f) {
  const t = f.lastTrace;
  if (!t) return `${f.id}\n아직 첫 판단 전입니다. +1개월을 눌러주세요.`;
  return [
    f.id,
    `가격: ${fmt(f.price,3)} / 근로자: ${fmt(f.workers,0)} / 현금: ${fmt(f.cash)}`,
    `생산: ${fmt(f.output,2)} / 판매: ${fmt(f.sales,2)} / 매출: ${fmt(f.revenue)}`,
    `임금미지급채무: ${fmt(f.wageArrears || 0)}`,
    '',
    '[관찰·예상]',
    `관찰 수요증가: ${pct(t.perception.observedDemandGrowth)}`,
    `예상 수요증가: ${pct(t.perception.expectedDemandGrowth)}`,
    `예상 비용증가: ${pct(t.perception.expectedCostGrowth)}`,
    `재고압력: ${fmt(t.perception.inventoryPressure,2)}`,
    `현금스트레스: ${pct(t.perception.cashStress)}`,
    '',
    '[반사실적 전략 비교]',
    ...t.candidates.map(x => `- ${x.name}: 효용 ${fmt(x.utility,3)}`),
    '',
    `[선택] ${t.selected}`,
    `주된 이유: ${t.reason}`
  ].join('\n');
}

function formatMarkets(c) {
  const g = c.markets.goods;
  const l = c.markets.labor;
  const p = c.markets.payroll;
  const a = c.accounting;
  return [
    `${c.id} · ${c.name}`,
    '',
    '[노동시장]',
    `채용 ${fmt(l.hires,0)} / 해고 ${fmt(l.layoffs,0)} / 미충원 ${fmt(l.unfilled,0)}`,
    `임금 지급건수 ${fmt(p.payments,0)} / 실제 급여 ${fmt(p.payroll)} / 미지급 ${fmt(p.unpaid)}`,
    '',
    '[상품시장]',
    `거래 ${fmt(g.transactions,0)}건 / 판매수량 ${fmt(g.units,2)}`,
    `실제 소비지출 ${fmt(g.nominalConsumption)} / 계획예산 ${fmt(g.desiredBudget)}`,
    `미충족 예산 ${fmt(g.unmetBudget)} (${pct(c.macro.unmetDemandRatio)})`,
    '',
    '[회계 불변식]',
    `판정: ${a.ok ? 'PASS' : 'FAIL'}`,
    `초기 화폐 ${fmt(a.openingMoney)} / 현재 화폐 ${fmt(a.currentMoney)}`,
    `화폐 보존오차 ${a.moneyError.toExponential(2)}`,
    `불균형 분개 ${fmt(a.unbalancedEntries,0)} / 음수 계정 ${fmt(a.negativeAccounts,0)}`
  ].join('\n');
}

function formatTransactions(c) {
  const tx = c.recentTransactions || [];
  if (!tx.length) return '아직 실제 거래가 없습니다. +1개월을 눌러주세요.';
  return tx.slice().reverse().map(e => {
    const label = e.kind === 'wage' ? '임금' : e.kind === 'goods_purchase' ? '상품구매' : e.kind;
    const from = e.postings.find(p => p.delta < 0)?.accountId || '?';
    const to = e.postings.find(p => p.delta > 0)?.accountId || '?';
    return `${e.id}  ${label}\n${from} → ${to}\n금액 ${fmt(e.amount,2)} · 분개합 ${fmt(e.postings.reduce((s,p)=>s+p.delta,0),6)}`;
  }).join('\n\n');
}

document.getElementById('step1').addEventListener('click', () => { world.step(1); render(); });
document.getElementById('step12').addEventListener('click', () => { world.step(12); render(); });
document.getElementById('reset').addEventListener('click', () => { world = new EconomicWorld('ECON-4-001'); render(); });

render();
