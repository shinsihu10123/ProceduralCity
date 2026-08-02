import { clamp, formatCompact } from '../v3/core.js';
import { createSpatialPlan } from '../v3/spatial.js';
import { CityScene } from '../v3/scene.js';
import { createMacroWorld } from '../v3/macro-world.js';
import { createContinuousWorldSimulation, GOOD_LABELS } from './world-simulation.js';
import { MacroWorldLayer } from './macro-view.js';

const $ = (selector) => document.querySelector(selector);
const elements = {
  canvas: $('#city-canvas'),
  loading: $('#loading-screen'),
  loadingLabel: $('#loading-label'),
  loadingProgress: $('#loading-progress'),
  error: $('#error-screen'),
  errorMessage: $('#error-message'),
  stage: $('#stage-label'),
  metricLabels: [$('#metric-label-1'), $('#metric-label-2'), $('#metric-label-3')],
  metricValues: [$('#metric-value-1'), $('#metric-value-2'), $('#metric-value-3')],
  timeline: $('#timeline'),
  milestoneTrack: $('#milestone-track'),
  year: $('#year-value'),
  month: $('#month-value'),
  liveIndicator: $('#live-indicator'),
  historyEnd: $('#history-end'),
  eventCaption: $('#event-caption'),
  play: $('#play-button'),
  start: $('#start-button'),
  live: $('#live-button'),
  speed: $('#speed-button'),
  view: $('#view-button'),
  world: $('#world-button'),
  info: $('#info-button'),
  drawer: $('#detail-drawer'),
  drawerClose: $('#drawer-close'),
  drawerYear: $('#drawer-year'),
  detailLabels: Array.from({ length: 6 }, (_, index) => $(`#detail-label-${index + 1}`)),
  detailValues: Array.from({ length: 6 }, (_, index) => $(`#detail-value-${index + 1}`)),
  eventList: $('#event-list'),
  relationSection: $('#relation-section'),
  relationList: $('#relation-list'),
  countrySelectWrap: $('#country-select-wrap'),
  countrySelect: $('#country-select'),
  countryChip: $('#country-chip'),
  countryChipColor: $('#country-chip-color'),
  countryChipName: $('#country-chip-name'),
  countryChipStatus: $('#country-chip-status'),
  worldLegend: $('#world-legend'),
  modelNote: $('#model-note'),
  gestureHint: $('#gesture-hint'),
};

const state = {
  city: null,
  simulation: null,
  displayMonth: 0,
  selectedCountryId: null,
  playing: false,
  speedIndex: 1,
  speeds: [
    { monthsPerSecond: 1, label: '1월/s' },
    { monthsPerSecond: 6, label: '6월/s' },
    { monthsPerSecond: 24, label: '2년/s' },
    { monthsPerSecond: 120, label: '10년/s' },
  ],
  accumulator: 0,
  lastFrame: 0,
  viewIndex: 0,
  mode: 'settlement',
  lastMilestoneSignature: '',
  pointerStart: null,
  views: [
    { id: 'settlement', label: '조감' },
    { id: 'center', label: '중심' },
    { id: 'street', label: '거리' },
    { id: 'region', label: '지역' },
  ],
};

function updateProgress(value, label) {
  elements.loadingProgress.style.width = `${Math.round(value * 100)}%`;
  elements.loadingLabel.textContent = label;
}

const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const number = (value) => Math.round(value).toLocaleString('ko-KR');
const percent = (value, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const signedPercent = (value) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;

function currencyB(value, signed = false) {
  const sign = signed && value > 0 ? '+' : '';
  const absolute = Math.abs(value);
  const formatted = absolute >= 1000 ? `${(absolute / 1000).toFixed(2)}T` : absolute >= 10 ? absolute.toFixed(1) : absolute.toFixed(2);
  return `${value < 0 ? '-' : sign}$${formatted}B`;
}

function currencyPerPerson(value) {
  return `$${Math.round(value).toLocaleString('ko-KR')}`;
}

function timeParts(month) {
  const safe = Math.max(0, Math.round(month));
  return { year: Math.floor(safe / 12), month: safe % 12 + 1 };
}

function timeLabel(month) {
  const parts = timeParts(month);
  return `${parts.year}년 ${parts.month}월`;
}

const STATUS_LABELS = Object.freeze({
  neutral: '중립', trade: '통상협정', alliance: '동맹', tense: '고긴장', sanctions: '제재', conflict: '무력충돌',
});

function setPairs(labels, values) {
  labels.forEach((label, index) => { elements.detailLabels[index].textContent = label; });
  values.forEach((value, index) => { elements.detailValues[index].textContent = value; });
}

function renderEvents(month) {
  const scope = state.mode === 'world' ? 'world' : 'settlement';
  const events = state.simulation.getRecentEvents(month, scope, 5);
  const latest = events[0];
  elements.eventCaption.textContent = latest
    ? `${latest.title} · ${latest.detail}`
    : state.mode === 'world' ? '국가 장부 개시 · 상호작용이 아직 발생하지 않음' : '정착지 설립 · 미래는 아직 계산되지 않음';
  elements.eventList.replaceChildren(...events.map((entry) => {
    const item = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = timeLabel(entry.month);
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = entry.title;
    const detail = document.createElement('small');
    detail.textContent = entry.detail;
    copy.append(title, detail);
    item.append(time, copy);
    return item;
  }));
}

function renderInteractions(snapshot, country) {
  const interactions = state.simulation.getCountryInteractions(country.id, state.displayMonth);
  elements.relationList.replaceChildren(...interactions.map((interaction) => {
    const item = document.createElement('li');
    item.className = `status-${interaction.status}`;
    const dot = document.createElement('i');
    const copy = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = interaction.partner.name;
    const detail = document.createElement('small');
    const migrants = interaction.migrationOut + interaction.migrationIn;
    const topGood = Object.entries(interaction.goods).sort((a, b) => b[1] - a[1])[0]?.[0];
    detail.textContent = `${STATUS_LABELS[interaction.status]} · 신뢰 ${Math.round(interaction.trust * 100)} · 긴장 ${Math.round(interaction.tension * 100)} · ${topGood ? `주력 ${GOOD_LABELS[topGood]} · ` : ''}이주 ${formatCompact(migrants)}명`;
    const trade = document.createElement('em');
    trade.textContent = `${currencyB(interaction.tradeB)}/월`;
    copy.append(name, detail);
    item.append(dot, copy, trade);
    return item;
  }));
  const conflictCount = interactions.filter((interaction) => interaction.status === 'conflict').length;
  const tenseCount = interactions.filter((interaction) => ['tense', 'sanctions'].includes(interaction.status)).length;
  elements.countryChipStatus.textContent = conflictCount ? `분쟁 ${conflictCount}` : tenseCount ? `긴장 ${tenseCount}` : `교역 ${interactions.filter((entry) => entry.tradeB > 0.001).length}개국`;
}

function renderSettlement(snapshot) {
  const local = snapshot.settlement;
  elements.stage.textContent = `${local.stage.label} · ${timeLabel(state.displayMonth)}`;
  ['인구', '건축물', '도로'].forEach((label, index) => { elements.metricLabels[index].textContent = label; });
  [number(local.population), `${number(local.buildings)}동`, `${local.roadLengthKm.toFixed(1)} km`].forEach((value, index) => { elements.metricValues[index].textContent = value; });
  setPairs(
    ['가구', '고용', '주택', '실업률', '생활 서비스', '환경'],
    [number(local.households), `${number(local.employed)}명`, `${number(local.housingUnits)}호`, percent(local.unemploymentRate), percent(local.serviceCoverage, 0), percent(local.airQuality, 0)],
  );
  elements.countrySelectWrap.hidden = true;
  elements.relationSection.hidden = true;
  elements.countryChip.hidden = true;
  elements.worldLegend.hidden = true;
  elements.modelNote.textContent = '도시는 연령대·가구·기업·주택·토지·재정·부채·교통·전력·상수도·환경 장부를 매달 결산합니다. 건축과 도로는 수요와 재원 조건을 통과한 뒤에만 생깁니다.';
}

function renderWorld(snapshot) {
  const country = snapshot.countries[state.selectedCountryId] || snapshot.countries[0];
  state.selectedCountryId = country.id;
  elements.stage.textContent = `${country.name} · ${country.governmentType}`;
  ['국가 인구', 'GDP', '무역수지'].forEach((label, index) => { elements.metricLabels[index].textContent = label; });
  [number(country.population), currencyB(country.gdpB), `${currencyB(country.tradeBalanceB, true)}/월`].forEach((value, index) => { elements.metricValues[index].textContent = value; });
  setPairs(
    ['1인 GDP', '실질 성장률', '실업률', '물가상승률', '정부 부채/GDP', '정부 정당성'],
    [currencyPerPerson(country.gdpPerCapita), signedPercent(country.realGrowth), percent(country.unemploymentRate), signedPercent(country.inflation), percent(country.debtRatio), percent(country.legitimacy, 0)],
  );
  elements.countrySelectWrap.hidden = false;
  elements.relationSection.hidden = false;
  elements.countryChip.hidden = false;
  elements.worldLegend.hidden = false;
  elements.countrySelect.value = String(country.id);
  elements.countryChipName.textContent = country.name;
  elements.countryChipColor.style.backgroundColor = `rgb(${country.color.map((value) => Math.round(value * 255)).join(',')})`;
  renderInteractions(snapshot, country);
  elements.modelNote.textContent = `식량 ${Math.round(country.foodSecurity * 100)}% · 에너지 ${Math.round(country.energySecurity * 100)}% · 재생에너지 ${Math.round(country.renewableShare * 100)}%. 생산·재고·수요·가격·관세·신뢰·분쟁이 실제 양자 교역과 이주량을 바꿉니다.`;
}

function renderMilestones() {
  const important = [...state.simulation.events, ...state.simulation.settlement.events]
    .filter((entry) => ['milestone', 'road', 'treaty', 'alliance', 'conflict', 'peace', 'regime'].includes(entry.type))
    .slice(-90);
  const maximum = Math.max(1, state.simulation.month);
  const signature = important.map((entry) => `${entry.month}:${entry.type}`).join('|');
  if (signature !== state.lastMilestoneSignature) {
    elements.milestoneTrack.replaceChildren(...important.map((entry) => {
      const marker = document.createElement('i');
      marker.dataset.month = String(entry.month);
      marker.title = `${timeLabel(entry.month)} · ${entry.title}`;
      return marker;
    }));
    state.lastMilestoneSignature = signature;
  }
  for (const marker of elements.milestoneTrack.children) marker.style.left = `${Number(marker.dataset.month) / maximum * 100}%`;
}

function renderTimeline() {
  const maximum = Math.max(1, state.simulation.month);
  const live = state.displayMonth === state.simulation.month;
  elements.timeline.max = String(maximum);
  elements.timeline.value = String(state.displayMonth);
  elements.timeline.style.setProperty('--timeline-progress', `${state.displayMonth / maximum * 100}%`);
  const parts = timeParts(state.displayMonth);
  elements.year.textContent = String(parts.year);
  elements.month.textContent = `${parts.month}월`;
  elements.drawerYear.textContent = timeLabel(state.displayMonth);
  elements.historyEnd.textContent = `현재 ${timeParts(state.simulation.month).year}년`;
  elements.liveIndicator.textContent = live ? 'LIVE' : '과거 기록';
  elements.liveIndicator.classList.toggle('is-history', !live);
  elements.live.classList.toggle('is-live', live);
  renderMilestones();
}

function renderCurrent() {
  const snapshot = state.simulation.getSnapshotAtMonth(state.displayMonth);
  if (state.mode === 'world') renderWorld(snapshot);
  else renderSettlement(snapshot);
  renderEvents(state.displayMonth);
  renderTimeline();
  state.city?.setWorldSnapshot(snapshot, state.selectedCountryId);
}

function setDisplayMonth(value, options = {}) {
  state.displayMonth = clamp(Math.round(Number(value) || 0), 0, state.simulation.month);
  renderCurrent();
  state.city?.setYear(state.displayMonth / 12, Boolean(options.force));
}

function advanceAndDisplay(months) {
  const count = Math.max(0, Math.floor(months));
  if (!count) return;
  const availableHistory = state.simulation.month - state.displayMonth;
  const historyStep = Math.min(availableHistory, count);
  state.displayMonth += historyStep;
  const futureStep = count - historyStep;
  if (futureStep > 0) {
    state.simulation.advanceMonths(futureStep);
    state.displayMonth = state.simulation.month;
  }
  state.city?.syncSimulation();
  setDisplayMonth(state.displayMonth);
}

function setPlaying(value) {
  state.playing = Boolean(value);
  state.accumulator = 0;
  state.lastFrame = performance.now();
  elements.play.classList.toggle('is-playing', state.playing);
  elements.play.setAttribute('aria-label', state.playing ? '시뮬레이션 일시정지' : '시뮬레이션 재생');
}

function animationTick(time) {
  const delta = Math.min(0.12, Math.max(0, (time - state.lastFrame) / 1000));
  if (state.playing && state.simulation) {
    state.accumulator += delta * state.speeds[state.speedIndex].monthsPerSecond;
    const months = Math.floor(state.accumulator);
    if (months > 0) {
      state.accumulator -= months;
      advanceAndDisplay(months);
    }
  }
  state.city?.syncSimulation();
  state.lastFrame = time;
  requestAnimationFrame(animationTick);
}

function toggleDrawer(open) {
  const next = open ?? !elements.drawer.classList.contains('is-open');
  elements.drawer.classList.toggle('is-open', next);
  elements.drawer.setAttribute('aria-hidden', String(!next));
  elements.info.setAttribute('aria-expanded', String(next));
}

function selectCountry(countryId, focus = false) {
  state.selectedCountryId = clamp(Number(countryId) || 0, 0, state.simulation.macroWorld.countries.length - 1);
  renderCurrent();
  if (focus) state.city.focusCountry(state.selectedCountryId);
}

function populateCountries() {
  elements.countrySelect.replaceChildren(...state.simulation.macroWorld.countries.map((country) => {
    const option = document.createElement('option');
    option.value = String(country.id);
    option.textContent = country.name;
    return option;
  }));
}

function stepFromKeyboard(direction, large = false) {
  setPlaying(false);
  const step = large ? 12 : 1;
  if (direction < 0) setDisplayMonth(state.displayMonth - step, { force: true });
  else advanceAndDisplay(step);
}

function bindInterface() {
  elements.timeline.addEventListener('input', () => {
    setPlaying(false);
    setDisplayMonth(elements.timeline.value, { force: true });
  });
  elements.play.addEventListener('click', () => setPlaying(!state.playing));
  elements.start.addEventListener('click', () => { setPlaying(false); setDisplayMonth(0, { force: true }); });
  elements.live.addEventListener('click', () => setDisplayMonth(state.simulation.month, { force: true }));
  elements.speed.addEventListener('click', () => {
    state.speedIndex = (state.speedIndex + 1) % state.speeds.length;
    elements.speed.textContent = state.speeds[state.speedIndex].label;
  });
  elements.view.addEventListener('click', () => {
    if (state.mode === 'world') return;
    state.viewIndex = (state.viewIndex + 1) % state.views.length;
    const view = state.views[state.viewIndex];
    elements.view.textContent = view.label;
    state.city.setView(view.id);
  });
  elements.world.addEventListener('click', () => {
    state.mode = state.mode === 'settlement' ? 'world' : 'settlement';
    elements.world.setAttribute('aria-pressed', String(state.mode === 'world'));
    elements.world.textContent = state.mode === 'world' ? '정착지' : '세계';
    elements.view.textContent = state.mode === 'world' ? '대륙' : state.views[state.viewIndex].label;
    elements.view.classList.toggle('is-disabled', state.mode === 'world');
    state.city.setMode(state.mode);
    renderCurrent();
  });
  elements.info.addEventListener('click', () => toggleDrawer());
  elements.drawerClose.addEventListener('click', () => toggleDrawer(false));
  elements.countryChip.addEventListener('click', () => toggleDrawer(true));
  elements.countrySelect.addEventListener('change', () => selectCountry(elements.countrySelect.value, true));
  window.addEventListener('keydown', (keyboardEvent) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (keyboardEvent.code === 'Space') { keyboardEvent.preventDefault(); setPlaying(!state.playing); }
    if (keyboardEvent.code === 'ArrowLeft') stepFromKeyboard(-1, keyboardEvent.shiftKey);
    if (keyboardEvent.code === 'ArrowRight') stepFromKeyboard(1, keyboardEvent.shiftKey);
    if (keyboardEvent.code === 'Home') { setPlaying(false); setDisplayMonth(0, { force: true }); }
    if (keyboardEvent.code === 'End') setDisplayMonth(state.simulation.month, { force: true });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });
  elements.canvas.addEventListener('pointerdown', (pointerEvent) => {
    state.pointerStart = { x: pointerEvent.clientX, y: pointerEvent.clientY, time: performance.now() };
    elements.gestureHint.classList.add('is-hidden');
  });
  elements.canvas.addEventListener('pointerup', (pointerEvent) => {
    if (state.mode !== 'world' || !state.pointerStart) return;
    const distance = Math.hypot(pointerEvent.clientX - state.pointerStart.x, pointerEvent.clientY - state.pointerStart.y);
    const duration = performance.now() - state.pointerStart.time;
    state.pointerStart = null;
    if (distance > 7 || duration > 650) return;
    const countryId = state.city.pickCountry(pointerEvent.clientX, pointerEvent.clientY);
    if (countryId != null) selectCountry(countryId, true);
  });
  setTimeout(() => elements.gestureHint.classList.add('is-hidden'), 7200);
}

async function bootstrap() {
  try {
    const seed = new URLSearchParams(location.search).get('seed') || 'new-horizon';
    updateProgress(0.03, '대륙 지형과 수계 생성');
    await nextPaint();

    const macroWorld = createMacroWorld({ seed, size: 128 });
    updateProgress(0.13, '국가·자원·국경 초기화');
    await nextPaint();

    const spatial = createSpatialPlan({ seed });
    updateProgress(0.20, '정착지 지형과 도로 후보망 계산');
    await nextPaint();

    state.simulation = createContinuousWorldSimulation({ seed, macroWorld, spatial });
    state.selectedCountryId = macroWorld.settlement.countryId;
    updateProgress(0.27, '월별 재고–흐름 장부 연결');
    await nextPaint();

    state.city = new CityScene(elements.canvas, state.simulation, {
      onProgress(value, label) { updateProgress(0.30 + value * 0.67, label); },
      macroWorld,
      macroLayerClass: MacroWorldLayer,
    });
    populateCountries();
    bindInterface();
    setDisplayMonth(0, { force: true });
    updateProgress(1, '연속 시뮬레이션 준비 완료');
    await nextPaint();
    elements.loading.classList.add('is-finished');
    requestAnimationFrame(animationTick);
    window.__LIVING_WORLD__ = {
      version: '4.0.0-continuous',
      seed,
      simulation: state.simulation,
      get mode() { return state.mode; },
      get month() { return state.simulation.month; },
      advanceMonths(months) {
        state.simulation.advanceMonths(months);
        state.city.syncSimulation(true);
        setDisplayMonth(state.simulation.month, { force: true });
        return state.simulation.getSnapshotAtMonth(state.simulation.month);
      },
      advanceYears(years) { return this.advanceMonths(Math.max(0, Math.floor(years * 12))); },
      setMonth(month) { setPlaying(false); setDisplayMonth(month, { force: true }); },
      selectCountry(countryId) { selectCountry(countryId, true); },
      diagnostics() {
        return {
          engine: state.simulation.diagnostics(),
          spatial: state.simulation.spatial.diagnostics,
          world: state.simulation.macroWorld.diagnostics,
          renderer: state.city.renderer.info,
        };
      },
    };
  } catch (error) {
    console.error(error);
    elements.loading.classList.add('is-finished');
    elements.error.hidden = false;
    elements.errorMessage.textContent = `${error?.message || error}`;
  }
}

bootstrap();
