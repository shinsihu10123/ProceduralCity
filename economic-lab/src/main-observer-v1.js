import { EconomicObserverScene } from './observer/economic-scene-fast.js';

const delays = new Map([[0.5, 1800], [1, 900], [2, 420], [4, 160]]);
const pending = new Map();
let requestId = 1;
let selected = 'AST';
let state = null;
let playing = false;
let busy = false;
let timer = null;

const worker = new Worker(new URL('./observer/economic-worker.js', import.meta.url), { type: 'module' });
const scene = new EconomicObserverScene(document.getElementById('world3d'), {
  onCountrySelect: id => selectCountry(id, false)
});

const text = (id, value) => {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value);
};
const num = (value, digits = 1) => Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: digits });
const pct = (value, digits = 1) => `${(Number(value || 0) * 100).toFixed(digits)}%`;
const signedPct = value => `${Number(value || 0) >= 0 ? '+' : ''}${(Number(value || 0) * 100).toFixed(2)}%`;

function condition(country) {
  const u = Number(country.macro.unemployment || 0);
  if (u >= 0.70 || Number(country.macro.realOutput || 0) <= 1e-6 || Number(country.macro.consumption || 0) <= 1e-6) return 'COLLAPSE';
  if (u >= 0.20 || Number(country.cognition.crisisShare || 0) > 0.02 || Number(country.visual.externalStress || 0) > 0.08) return 'WATCH';
  return 'STABLE';
}

worker.onmessage = event => {
  const message = event.data || {};
  const slot = pending.get(message.requestId);
  if (!slot) return;
  pending.delete(message.requestId);
  if (message.type === 'error') slot.reject(new Error(message.message || 'worker error'));
  else slot.resolve(message);
};
worker.onerror = event => {
  text('engineState', 'ERROR');
  const error = new Error(event.message || 'worker runtime error');
  for (const slot of pending.values()) slot.reject(error);
  pending.clear();
};

function ask(type, extra = {}) {
  const id = requestId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ type, requestId: id, ...extra });
  });
}

function setBusy(value) {
  busy = value;
  document.body.classList.toggle('sim-busy', value);
  for (const id of ['step1', 'step12', 'reset']) {
    const node = document.getElementById(id);
    if (node) node.disabled = value;
  }
  text('engineState', value ? 'CALCULATING' : playing ? 'PLAYING' : 'READY');
}

function detailLines(country, accounting, runtime) {
  const sector = country.industry.sectors || {};
  text('macroDetails', [
    `상태  ${condition(country)}`,
    `GDP  ${num(country.macro.gdp)}`,
    `실질 생산  ${num(country.macro.realOutput)}`,
    `소비  ${num(country.macro.consumption)}`,
    `민간 투자  ${num(country.macro.investment)}`,
    `정부 수요  ${num(country.macro.governmentDemand)}`,
    `실업률  ${pct(country.macro.unemployment)}`,
    `CPI  ${num(country.macro.priceIndex, 4)}`,
    `월간 CPI 변화  ${signedPct(country.macro.inflation)}`,
    `평균 임금  ${num(country.macro.averageWage)}`,
    `정책금리  ${pct(country.macro.policyRate)}`
  ].join('\n'));
  text('industryDetails', [
    `RESOURCE  ${num(sector.RESOURCE)}`,
    `MATERIALS  ${num(sector.MATERIALS)}`,
    `CAPITAL  ${num(sector.CAPITAL)}`,
    `CONSUMER  ${num(sector.CONSUMER)}`,
    `산업 총생산  ${num(country.industry.totalOutput)}`,
    `B2B 거래  ${num(country.industry.b2bTrade)}`,
    `투입재 부족  ${num(country.industry.inputShortageUnits)}`
  ].join('\n'));
  text('internationalDetails', [
    `FX / WXU  ${num(country.international.fxRate, 4)}`,
    `수출 WXU  ${num(country.international.exportsWXU)}`,
    `수입 WXU  ${num(country.international.importsWXU)}`,
    `경상수지 WXU  ${num(country.international.currentAccountWXU)}`,
    `대외부채 WXU  ${num(country.international.foreignDebtWXU)}`,
    `대외 스트레스  ${pct(country.visual.externalStress)}`
  ].join('\n'));
  text('cognitiveDetails', [
    `인지 Agent  ${num(country.cognition.agents, 0)}`,
    `L3  ${num(country.cognition.l3Agents, 0)}`,
    `L4  ${num(country.cognition.l4Agents, 0)}`,
    `가설 검증  ${num(country.cognition.hypothesisTests, 0)}`,
    `인과 업데이트  ${num(country.cognition.causalUpdates, 0)}`,
    `위기판단 비중  ${pct(country.cognition.crisisShare)}`
  ].join('\n'));
  text('accountingDetails', [
    `Settlement  ${accounting.settlement?.ok === false ? 'FAIL' : 'PASS'}`,
    `General  ${accounting.general?.ok === false ? 'FAIL' : 'PASS'}`,
    `Fiscal  ${accounting.fiscal?.accountingOk === false ? 'FAIL' : 'PASS'}`,
    `Monetary  ${accounting.monetary?.accountingOk === false ? 'FAIL' : 'PASS'}`,
    `International  ${accounting.international?.accountingOk === false ? 'FAIL' : 'PASS'}`
  ].join('\n'));
  text('rawSnapshot', JSON.stringify({ country, accounting, runtime }, null, 2));
}

function render() {
  if (!state) return;
  const observer = state.observer;
  scene.update(observer);
  if (!observer.countries.some(country => country.id === selected)) selected = observer.countries[0]?.id || null;
  scene.setSelectedCountry(selected);
  text('month', `${observer.month}개월`);
  text('monthBadge', `MONTH ${observer.month}`);
  text('sourceVersion', `ENGINE v${observer.sourceVersion}`);
  text('tradeFlowCount', observer.flows.trade.length);
  text('fundingFlowCount', observer.flows.foreignFunding.filter(flow => flow.outstandingWXU > 0).length);
  text('globalGdp', num(observer.countries.reduce((sum, country) => sum + Number(country.macro.gdp || 0), 0)));
  text('globalAgents', num(observer.countries.reduce((sum, country) => sum + Number(country.cognition.agents || 0), 0), 0));

  const list = document.getElementById('countryList');
  list.replaceChildren();
  for (const country of observer.countries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `country-row${country.id === selected ? ' selected' : ''}`;
    button.dataset.country = country.id;
    button.textContent = `${country.id}  ${country.name}  · GDP ${num(country.macro.gdp)} · 실업 ${pct(country.macro.unemployment)} · ${condition(country)}`;
    button.addEventListener('click', () => selectCountry(country.id, true));
    list.appendChild(button);
  }
  renderSelected();
}

function renderSelected() {
  if (!state) return;
  const country = state.observer.countries.find(row => row.id === selected) || state.observer.countries[0];
  if (!country) return;
  text('selectedCode', country.id);
  text('selectedName', country.name);
  text('selectedGdp', num(country.macro.gdp));
  text('selectedUnemployment', pct(country.macro.unemployment));
  text('selectedInflation', signedPct(country.macro.inflation));
  text('selectedPolicyRate', pct(country.macro.policyRate));
  text('selectedFx', num(country.international.fxRate, 3));
  text('selectedFirms', num(country.firms.active, 0));
  text('selectedStress', pct(country.visual.externalStress));
  text('selectedCrisis', pct(country.cognition.crisisShare));
  detailLines(country, state.accounting?.[country.id] || {}, state.runtime || {});
}

function selectCountry(id, focus) {
  selected = id;
  scene.setSelectedCountry(id);
  if (focus) scene.focusCountry(id);
  render();
}

async function step(months) {
  if (busy) return false;
  setBusy(true);
  try {
    state = await ask('step', { months });
    render();
    return true;
  } catch (error) {
    console.error(error);
    text('engineState', 'ERROR');
    playing = false;
    return false;
  } finally {
    setBusy(false);
  }
}

async function tick() {
  if (!playing) return;
  if (!(await step(1)) || !playing) return;
  const speed = Number(document.getElementById('speed').value || 1);
  timer = setTimeout(tick, delays.get(speed) || 900);
}

function play() {
  if (playing) return;
  playing = true;
  text('engineState', 'PLAYING');
  tick();
}

function pause() {
  playing = false;
  clearTimeout(timer);
  timer = null;
  text('engineState', busy ? 'CALCULATING' : 'READY');
}

async function reset() {
  if (busy) return;
  pause();
  setBusy(true);
  try {
    state = await ask('reset');
    selected = 'AST';
    render();
    scene.focusCountry(selected);
  } finally {
    setBusy(false);
  }
}

document.getElementById('step1').addEventListener('click', () => step(1));
document.getElementById('step12').addEventListener('click', () => step(12));
document.getElementById('play').addEventListener('click', play);
document.getElementById('pause').addEventListener('click', pause);
document.getElementById('reset').addEventListener('click', reset);
document.getElementById('focusSelected').addEventListener('click', () => scene.focusCountry(selected));

setBusy(true);
ask('init').then(initial => {
  state = initial;
  render();
  scene.focusCountry(selected);
}).catch(error => {
  console.error(error);
  text('engineState', 'ERROR');
}).finally(() => setBusy(false));
