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
        <div><small>재고</small><strong>${fmt(c.macro.inventory)}</strong></div>
      </div>
      <footer>가계 ${fmt(c.households,0)} · 기업 ${fmt(c.firms,0)}</footer>
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
}

function formatHousehold(h) {
  const t = h.lastTrace;
  if (!t) return `${h.id}\n아직 첫 판단 전입니다. +1개월을 눌러주세요.`;
  return [
    h.id,
    `고용: ${h.employed ? '고용' : '실업'} / 자산: ${fmt(h.wealth)}`,
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
    `주된 이유: ${t.reason}`
  ].join('\n');
}

function formatFirm(f) {
  const t = f.lastTrace;
  if (!t) return `${f.id}\n아직 첫 판단 전입니다. +1개월을 눌러주세요.`;
  return [
    f.id,
    `가격: ${fmt(f.price,3)} / 근로자: ${fmt(f.workers,0)} / 현금: ${fmt(f.cash)}`,
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

document.getElementById('step1').addEventListener('click', () => { world.step(1); render(); });
document.getElementById('step12').addEventListener('click', () => { world.step(12); render(); });
document.getElementById('reset').addEventListener('click', () => { world = new EconomicWorld('ECON-4-001'); render(); });

render();
