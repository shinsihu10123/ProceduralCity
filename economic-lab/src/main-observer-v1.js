import { EconomicWorld } from './core/world-v10.js';
import { buildObserverSnapshot } from './observer/visualization-bridge.js';
import { EconomicObserverScene } from './observer/economic-scene.js';

const WORLD_SEED = 'ECON-4-001';
const SPEED_DELAYS = new Map([
  [0.5, 1800],
  [1, 950],
  [2, 480],
  [4, 240]
]);

let world = makeWorld();
let selectedCountryId = 'AST';
let playing = false;
let playTimer = null;
let busy = false;
let latestRawSnapshot = null;
let latestObserverSnapshot = null;

const fmt = (value, digits = 1) => Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: digits });
const pct = (value, digits = 1) => `${(Number(value || 0) * 100).toFixed(digits)}%`;
const signedPct = (value, digits = 2) => `${Number(value || 0) >= 0 ? '+' : ''}${(Number(value || 0) * 100).toFixed(digits)}%`;

function makeWorld() {
  return new EconomicWorld(WORLD_SEED, { healthCheckInterval: 0 });
}

const scene = new EconomicObserverScene(document.getElementById('world3d'), {
  onCountrySelect: id => selectCountry(id, { focus: false })
});

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setBusy(nextBusy) {
  busy = nextBusy;
  document.body.classList.toggle('sim-busy', nextBusy);
  for (const id of ['step1', 'step12', 'reset']) {
    const element = document.getElementById(id);
    if (element) element.disabled = nextBusy;
  }
  setText('engineState', nextBusy ? 'CALCULATING' : playing ? 'PLAYING' : 'READY');
}

function selectCountry(id, { focus = false } = {}) {
  if (!latestObserverSnapshot?.countries.some(country => country.id === id)) return;
  selectedCountryId = id;
  scene.setSelectedCountry(id);
  if (focus) scene.focusCountry(id);
  renderCountryList(latestObserverSnapshot);
  renderSelectedCountry();
}

function render() {
  latestRawSnapshot = world.snapshot();
  latestObserverSnapshot = buildObserverSnapshot(latestRawSnapshot);
  if (!latestObserverSnapshot.countries.some(country => country.id === selectedCountryId)) {
    selectedCountryId = latestObserverSnapshot.countries[0]?.id || null;
  }

  scene.update(latestObserverSnapshot);
  scene.setSelectedCountry(selectedCountryId);

  setText('month', `${latestObserverSnapshot.month}개월`);
  setText('monthBadge', `MONTH ${latestObserverSnapshot.month}`);
  setText('sourceVersion', `ENGINE v${latestObserverSnapshot.sourceVersion}`);
  setText('tradeFlowCount', fmt(latestObserverSnapshot.flows.trade.length, 0));
  setText('fundingFlowCount', fmt(latestObserverSnapshot.flows.foreignFunding.filter(flow => flow.outstandingWXU > 0).length, 0));

  const totalGdp = latestObserverSnapshot.countries.reduce((sum, country) => sum + Number(country.macro.gdp || 0), 0);
  const totalAgents = latestObserverSnapshot.countries.reduce((sum, country) => sum + Number(country.cognition.agents || 0), 0);
  setText('globalGdp', fmt(totalGdp));
  setText('globalAgents', fmt(totalAgents, 0));

  renderCountryList(latestObserverSnapshot);
  renderSelectedCountry();
}

function renderCountryList(observer) {
  const root = document.getElementById('countryList');
  root.innerHTML = observer.countries.map(country => `
    <button type="button" class="country-row ${country.id === selectedCountryId ? 'selected' : ''}" data-country="${country.id}">
      <span class="country-code">${country.id}</span>
      <span class="country-row-main"><strong>${country.name}</strong><small>GDP ${fmt(country.macro.gdp)} · 실업 ${pct(country.macro.unemployment)}</small></span>
      <span class="country-row-signal">${country.cognition.crisisShare > 0.02 || country.visual.externalStress > 0.08 ? 'WATCH' : 'STABLE'}</span>
    </button>
  `).join('');

  for (const button of root.querySelectorAll('[data-country]')) {
    button.addEventListener('click', () => selectCountry(button.dataset.country, { focus: true }));
  }
}

function renderSelectedCountry() {
  if (!latestObserverSnapshot || !latestRawSnapshot) return;
  const country = latestObserverSnapshot.countries.find(row => row.id === selectedCountryId) || latestObserverSnapshot.countries[0];
  const raw = latestRawSnapshot.countries.find(row => row.id === country.id) || latestRawSnapshot.countries[0];
  if (!country || !raw) return;

  setText('selectedCode', country.id);
  setText('selectedName', country.name);
  setText('selectedGdp', fmt(country.macro.gdp));
  setText('selectedUnemployment', pct(country.macro.unemployment));
  setText('selectedInflation', signedPct(country.macro.inflation));
  setText('selectedPolicyRate', pct(country.macro.policyRate));
  setText('selectedFx', fmt(country.international.fxRate, 3));
  setText('selectedFirms', fmt(country.firms.active, 0));
  setText('selectedStress', pct(country.visual.externalStress));
  setText('selectedCrisis', pct(country.cognition.crisisShare));

  document.getElementById('macroDetails').innerHTML = rows([
    ['GDP', fmt(country.macro.gdp)],
    ['실질 생산', fmt(country.macro.realOutput)],
    ['소비', fmt(country.macro.consumption)],
    ['민간 투자', fmt(country.macro.investment)],
    ['정부 수요', fmt(country.macro.governmentDemand)],
    ['실업률', pct(country.macro.unemployment)],
    ['CPI', fmt(country.macro.priceIndex, 4)],
    ['월간 CPI 변화', signedPct(country.macro.inflation)],
    ['평균 임금', fmt(country.macro.averageWage)],
    ['통화량', fmt(country.macro.moneySupply)],
    ['민간 대출잔액', fmt(country.macro.outstandingLoans)],
    ['공공부채', fmt(country.macro.publicDebt)],
    ['정책금리', pct(country.macro.policyRate)]
  ]);

  document.getElementById('industryDetails').innerHTML = sectorRows(country);

  document.getElementById('internationalDetails').innerHTML = rows([
    ['통화', country.international.currency || '-'],
    ['FX / WXU', fmt(country.international.fxRate, 4)],
    ['FX 변동', signedPct(country.international.fxChange)],
    ['수출 WXU', fmt(country.international.exportsWXU)],
    ['수입 WXU', fmt(country.international.importsWXU)],
    ['경상수지 WXU', fmt(country.international.currentAccountWXU)],
    ['대외부채 WXU', fmt(country.international.foreignDebtWXU)],
    ['순대외자산 WXU', fmt(country.international.netForeignAssetsWXU)],
    ['공식 자금유입 WXU', fmt(country.international.formalFundingInflowWXU)],
    ['공식 자금유출 WXU', fmt(country.international.formalFundingOutflowWXU)],
    ['대외 스트레스', pct(country.visual.externalStress)],
    ['관세율', pct(country.international.tariffRate)]
  ]);

  const regimeRows = Object.entries(country.cognition.regimeShares).map(([key, value]) => [regimeLabel(key), pct(value)]);
  document.getElementById('cognitiveDetails').innerHTML = rows([
    ['인지 Agent', fmt(country.cognition.agents, 0)],
    ['L3 Counterfactual', fmt(country.cognition.l3Agents, 0)],
    ['L4 Deep Strategic', fmt(country.cognition.l4Agents, 0)],
    ['가설 검증 누적', fmt(country.cognition.hypothesisTests, 0)],
    ['인과계수 업데이트', fmt(country.cognition.causalUpdates, 0)],
    ['위기판단 비중', pct(country.cognition.crisisShare)],
    ...regimeRows
  ]);

  document.getElementById('accountingDetails').innerHTML = integrityRows(country.integrity, raw);
  document.getElementById('rawSnapshot').textContent = JSON.stringify({
    month: latestObserverSnapshot.month,
    observer: country,
    cognitiveSummary: raw.cognitive,
    internationalAccounting: raw.internationalAccounting,
    generalAccounting: raw.generalAccounting,
    fiscalAccounting: raw.fiscalAccounting
  }, null, 2);
}

function rows(entries) {
  return entries.map(([label, value]) => `<div class="detail-row"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function sectorRows(country) {
  const values = Object.entries(country.industry.sectors || {});
  const maxValue = Math.max(1e-9, ...values.map(([, value]) => Number(value || 0)));
  return values.map(([sector, value]) => {
    const width = Math.max(2, Math.min(100, Number(value || 0) / maxValue * 100));
    return `
      <div class="sector-row">
        <div><span>${sector}</span><strong>${fmt(value)}</strong></div>
        <div class="sector-track"><i style="width:${width}%"></i></div>
      </div>`;
  }).join('') + rows([
    ['산업 총생산', fmt(country.industry.totalOutput)],
    ['B2B 거래', fmt(country.industry.b2bTrade)],
    ['투입재 부족', fmt(country.industry.inputShortageUnits)]
  ]);
}

function integrityRows(integrity, raw) {
  const label = value => value ? 'PASS' : 'FAIL';
  return rows([
    ['Settlement', label(integrity.settlement)],
    ['General Accounting', label(integrity.generalAccounting)],
    ['Fiscal Accounting', label(integrity.fiscalAccounting)],
    ['Monetary Accounting', label(integrity.monetaryAccounting)],
    ['International Accounting', label(integrity.internationalAccounting)],
    ['A=L+E 최대오차', Number(raw.generalAccounting?.maxEquationError || 0).toExponential(2)],
    ['예금 대사오차', Number(raw.generalAccounting?.depositReconciliationError || 0).toExponential(2)],
    ['대출 대사오차', Number(raw.generalAccounting?.loanReconciliationError || 0).toExponential(2)]
  ]);
}

function regimeLabel(key) {
  return ({
    normal: '정상',
    recession: '침체',
    inflation: '인플레이션',
    overheating: '과열',
    credit_crisis: '신용위기',
    external_crisis: '대외위기'
  })[key] || key;
}

async function advance(months) {
  if (busy) return false;
  setBusy(true);
  try {
    await new Promise(resolve => requestAnimationFrame(resolve));
    world.step(months);
    render();
    return true;
  } finally {
    setBusy(false);
  }
}

function playbackSpeed() {
  const value = Number(document.getElementById('speed').value || 1);
  return SPEED_DELAYS.has(value) ? value : 1;
}

async function playTick() {
  if (!playing) return;
  await advance(1);
  if (!playing) return;
  playTimer = setTimeout(playTick, SPEED_DELAYS.get(playbackSpeed()));
}

function startPlayback() {
  if (playing) return;
  playing = true;
  document.getElementById('play').classList.add('active');
  document.getElementById('pause').classList.remove('active');
  setText('engineState', busy ? 'CALCULATING' : 'PLAYING');
  playTick();
}

function pausePlayback() {
  playing = false;
  clearTimeout(playTimer);
  playTimer = null;
  document.getElementById('play').classList.remove('active');
  document.getElementById('pause').classList.add('active');
  setText('engineState', busy ? 'CALCULATING' : 'READY');
}

function resetWorld() {
  pausePlayback();
  world = makeWorld();
  selectedCountryId = 'AST';
  render();
  scene.focusCountry(selectedCountryId);
}

document.getElementById('step1').addEventListener('click', () => advance(1));
document.getElementById('step12').addEventListener('click', () => advance(12));
document.getElementById('play').addEventListener('click', startPlayback);
document.getElementById('pause').addEventListener('click', pausePlayback);
document.getElementById('reset').addEventListener('click', resetWorld);
document.getElementById('focusSelected').addEventListener('click', () => scene.focusCountry(selectedCountryId));

render();
scene.focusCountry(selectedCountryId);
setBusy(false);
