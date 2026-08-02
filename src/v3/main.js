import { formatCompact } from './core.js';
import { createSpatialPlan } from './spatial.js';
import { createSettlementSimulation } from './simulation.js';
import { CityScene } from './scene.js';
import { createMacroWorld } from './macro-world.js';

const $ = (selector) => document.querySelector(selector);
const elements = {
  canvas: $('#city-canvas'),
  loading: $('#loading-screen'),
  loadingLabel: $('#loading-label'),
  loadingProgress: $('#loading-progress'),
  error: $('#error-screen'),
  errorMessage: $('#error-message'),
  stage: $('#stage-label'),
  population: $('#population-value'),
  building: $('#building-value'),
  road: $('#road-value'),
  timeline: $('#timeline'),
  milestoneTrack: $('#milestone-track'),
  year: $('#year-value'),
  eventCaption: $('#event-caption'),
  play: $('#play-button'),
  start: $('#start-button'),
  end: $('#end-button'),
  speed: $('#speed-button'),
  view: $('#view-button'),
  world: $('#world-button'),
  info: $('#info-button'),
  drawer: $('#detail-drawer'),
  drawerClose: $('#drawer-close'),
  drawerYear: $('#drawer-year'),
  household: $('#household-value'),
  employment: $('#employment-value'),
  housing: $('#housing-value'),
  unemployment: $('#unemployment-value'),
  service: $('#service-value'),
  environment: $('#environment-value'),
  eventList: $('#event-list'),
  gestureHint: $('#gesture-hint'),
};

const state = {
  city: null,
  simulation: null,
  year: 0,
  playing: false,
  speedIndex: 1,
  speeds: [0.5, 2, 8, 20],
  lastFrame: 0,
  viewIndex: 0,
  mode: 'settlement',
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

function number(value) {
  return Math.round(value).toLocaleString('ko-KR');
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function renderEvents(year) {
  const events = state.simulation.events.filter((event) => event.year <= year).slice(-4).reverse();
  const latest = events[0];
  elements.eventCaption.textContent = latest ? `${latest.title} · ${latest.detail}` : '정착지 설립';
  elements.eventList.replaceChildren(...events.map((event) => {
    const item = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = `${event.year}년`;
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = event.title;
    const detail = document.createElement('small');
    detail.textContent = event.detail;
    copy.append(title, detail);
    item.append(time, copy);
    return item;
  }));
}

function renderMetrics(year) {
  const snapshot = state.simulation.getSnapshot(year);
  const displayYear = Math.abs(year - Math.round(year)) < 0.05 ? String(Math.round(year)) : year.toFixed(1);
  elements.year.textContent = displayYear;
  elements.stage.textContent = state.mode === 'world'
    ? `${state.simulation.macroWorld.countries.length}개국 · ${number(state.simulation.macroWorld.spanKm)} km 세계`
    : `${snapshot.stage.label} · 설립 ${Math.floor(year)}년`;
  elements.population.textContent = number(snapshot.population);
  elements.building.textContent = `${number(snapshot.buildings)}동`;
  elements.road.textContent = `${snapshot.roadLengthKm.toFixed(1)} km`;
  elements.drawerYear.textContent = `설립 ${Math.floor(year)}년`;
  elements.household.textContent = number(snapshot.households);
  elements.employment.textContent = `${number(snapshot.employed)}명`;
  elements.housing.textContent = `${number(snapshot.housingUnits)}호`;
  elements.unemployment.textContent = percent(snapshot.unemploymentRate);
  elements.service.textContent = `${Math.round(snapshot.serviceCoverage * 100)}%`;
  elements.environment.textContent = `${Math.round(snapshot.airQuality * 100)}%`;
  renderEvents(year);
}

function setYear(value, options = {}) {
  const maximum = state.simulation?.years || 120;
  state.year = Math.max(0, Math.min(maximum, Number(value) || 0));
  elements.timeline.value = state.year;
  elements.timeline.style.setProperty('--timeline-progress', `${state.year / maximum * 100}%`);
  renderMetrics(state.year);
  state.city?.setYear(state.year, Boolean(options.force));
  if (state.year >= maximum && state.playing) setPlaying(false);
}

function setPlaying(value) {
  state.playing = Boolean(value);
  elements.play.classList.toggle('is-playing', state.playing);
  elements.play.setAttribute('aria-label', state.playing ? '일시정지' : '재생');
  if (state.playing && state.year >= state.simulation.years) setYear(0, { force: true });
  state.lastFrame = performance.now();
}

function animationTick(time) {
  if (state.playing && state.simulation) {
    const delta = Math.min(0.12, Math.max(0, (time - state.lastFrame) / 1000));
    setYear(state.year + delta * state.speeds[state.speedIndex]);
  }
  state.lastFrame = time;
  requestAnimationFrame(animationTick);
}

function toggleDrawer(open) {
  const next = open ?? !elements.drawer.classList.contains('is-open');
  elements.drawer.classList.toggle('is-open', next);
  elements.drawer.setAttribute('aria-hidden', String(!next));
  elements.info.setAttribute('aria-expanded', String(next));
}

function bindInterface() {
  elements.timeline.addEventListener('input', () => {
    setPlaying(false);
    setYear(elements.timeline.value, { force: true });
  });
  elements.play.addEventListener('click', () => setPlaying(!state.playing));
  elements.start.addEventListener('click', () => { setPlaying(false); setYear(0, { force: true }); });
  elements.end.addEventListener('click', () => { setPlaying(false); setYear(state.simulation.years, { force: true }); });
  elements.speed.addEventListener('click', () => {
    state.speedIndex = (state.speedIndex + 1) % state.speeds.length;
    elements.speed.textContent = `${state.speeds[state.speedIndex]}×`;
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
    renderMetrics(state.year);
  });
  elements.info.addEventListener('click', () => toggleDrawer());
  elements.drawerClose.addEventListener('click', () => toggleDrawer(false));
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') { event.preventDefault(); setPlaying(!state.playing); }
    if (event.code === 'ArrowLeft') { setPlaying(false); setYear(state.year - (event.shiftKey ? 10 : 1), { force: true }); }
    if (event.code === 'ArrowRight') { setPlaying(false); setYear(state.year + (event.shiftKey ? 10 : 1), { force: true }); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });
  elements.canvas.addEventListener('pointerdown', () => elements.gestureHint.classList.add('is-hidden'), { once: true });
  setTimeout(() => elements.gestureHint.classList.add('is-hidden'), 6500);
}

function renderMilestones() {
  const milestones = state.simulation.events.filter((event) => event.type === 'milestone' || event.type === 'road');
  elements.milestoneTrack.replaceChildren(...milestones.map((event) => {
    const marker = document.createElement('i');
    marker.style.left = `${event.year / state.simulation.years * 100}%`;
    marker.title = `${event.year}년 · ${event.title}`;
    return marker;
  }));
}

async function bootstrap() {
  try {
    updateProgress(0.03, '새 공간 엔진 준비');
    await nextPaint();

    updateProgress(0.06, '대륙·국가·교역 계산');
    const macroWorld = createMacroWorld({ seed: 'new-horizon', size: 128 });
    await nextPaint();

    updateProgress(0.10, '정착지 물리 지형과 수계 계산');
    const spatial = createSpatialPlan({ seed: 'new-horizon' });
    await nextPaint();

    updateProgress(0.18, '120년 사회·경제 시간축 계산');
    state.simulation = createSettlementSimulation({ seed: 'new-horizon', spatial });
    state.simulation.macroWorld = macroWorld;
    elements.timeline.max = state.simulation.years;
    await nextPaint();

    state.city = new CityScene(elements.canvas, state.simulation, {
      onProgress(value, label) { updateProgress(0.22 + value * 0.75, label); },
      macroWorld,
    });
    bindInterface();
    renderMilestones();
    setYear(0, { force: true });
    updateProgress(1, '완료');
    await nextPaint();
    elements.loading.classList.add('is-finished');
    requestAnimationFrame(animationTick);
    window.__LIVING_SETTLEMENT__ = {
      version: '3.0.0-alpha.1',
      simulation: state.simulation,
      get mode() { return state.mode; },
      setYear: (year) => setYear(year, { force: true }),
      diagnostics: {
        spatial: state.simulation.spatial.diagnostics,
        world: macroWorld.diagnostics,
        simulation: state.simulation.diagnostics,
        renderer: state.city.renderer.info,
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
