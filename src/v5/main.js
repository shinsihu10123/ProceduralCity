import { clamp, formatCompact } from '../v3/core.js';
import {
  TECHNOLOGIES,
  calendarLabel,
  createDeepTimeSimulation,
  createPrimitiveWorld,
} from './prehistoric-world.js';
import { UnifiedWorldScene } from './unified-scene.js';

const $ = (selector) => document.querySelector(selector);
const elements = {
  canvas: $('#world-canvas'),
  loading: $('#loading-screen'),
  loadingLabel: $('#loading-label'),
  loadingProgress: $('#loading-progress'),
  error: $('#error-screen'),
  errorMessage: $('#error-message'),
  stage: $('#stage-label'),
  population: $('#metric-population'),
  communities: $('#metric-communities'),
  polities: $('#metric-polities'),
  timeline: $('#timeline'),
  milestoneTrack: $('#milestone-track'),
  date: $('#date-value'),
  liveIndicator: $('#live-indicator'),
  historyEnd: $('#history-end'),
  eventCaption: $('#event-caption'),
  play: $('#play-button'),
  start: $('#start-button'),
  live: $('#live-button'),
  speed: $('#speed-button'),
  view: $('#view-button'),
  info: $('#info-button'),
  drawer: $('#detail-drawer'),
  drawerClose: $('#drawer-close'),
  drawerDate: $('#drawer-date'),
  entitySelect: $('#entity-select'),
  entityChip: $('#entity-chip'),
  entityChipColor: $('#entity-chip-color'),
  entityChipKicker: $('#entity-chip-kicker'),
  entityChipName: $('#entity-chip-name'),
  entityChipStatus: $('#entity-chip-status'),
  detailLabels: Array.from({ length: 6 }, (_, index) => $(`#detail-label-${index + 1}`)),
  detailValues: Array.from({ length: 6 }, (_, index) => $(`#detail-value-${index + 1}`)),
  technologies: $('#technology-list'),
  relationSection: $('#relation-section'),
  relationList: $('#relation-list'),
  eventList: $('#event-list'),
  modelNote: $('#model-note'),
  gestureHint: $('#gesture-hint'),
};

const state = {
  world: null,
  simulation: null,
  scene: null,
  displayYear: 0,
  selectedCommunityId: null,
  playing: false,
  speedIndex: 2,
  speeds: [
    { yearsPerSecond: 1, label: '1년/s' },
    { yearsPerSecond: 10, label: '10년/s' },
    { yearsPerSecond: 50, label: '50년/s' },
    { yearsPerSecond: 250, label: '250년/s' },
    { yearsPerSecond: 1000, label: '1천년/s' },
  ],
  views: [
    { id: 'continent', label: '대륙' },
    { id: 'region', label: '권역' },
    { id: 'settlement', label: '생활권' },
  ],
  viewIndex: 0,
  accumulator: 0,
  lastFrame: 0,
  pointerStart: null,
  entitySignature: '',
  milestoneSignature: '',
};

const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const number = (value) => Math.round(value).toLocaleString('ko-KR');
const percent = (value, digits = 0) => `${(value * 100).toFixed(digits)}%`;

function updateProgress(value, label) {
  elements.loadingProgress.style.width = `${Math.round(clamp(value, 0, 1) * 100)}%`;
  elements.loadingLabel.textContent = label;
}

function setPairs(labels, values) {
  labels.forEach((label, index) => { elements.detailLabels[index].textContent = label; });
  values.forEach((value, index) => { elements.detailValues[index].textContent = value; });
}

function statusLabel(status) {
  return ({ contact: '접촉', trade: '교역', alliance: '우호', tense: '긴장', war: '전쟁', truce: '휴전' })[status] || '접촉';
}

function populateEntities(snapshot) {
  const signature = snapshot.communities.map((community) => `${community.id}:${community.name}:${community.polityId}`).join('|');
  if (signature === state.entitySignature) return;
  const options = [...snapshot.communities]
    .sort((a, b) => b.population - a.population)
    .map((community) => {
      const option = document.createElement('option');
      option.value = String(community.id);
      option.textContent = `${community.name} · ${community.type} · ${formatCompact(community.population)}명`;
      return option;
    });
  elements.entitySelect.replaceChildren(...options);
  state.entitySignature = signature;
}

function renderTechnologies(culture) {
  if (!culture) {
    elements.technologies.replaceChildren();
    return;
  }
  const adopted = TECHNOLOGIES.filter((technology) => (culture.knowledge[technology.id] || 0) >= 1);
  const progressing = TECHNOLOGIES
    .filter((technology) => {
      const value = culture.knowledge[technology.id] || 0;
      return value > 0 && value < 1;
    })
    .sort((a, b) => culture.knowledge[b.id] - culture.knowledge[a.id])
    .slice(0, 3);
  const chips = [
    ...adopted.slice(-11).map((technology) => ({ text: technology.label, progress: false })),
    ...progressing.map((technology) => ({ text: `${technology.label} ${Math.round(culture.knowledge[technology.id] * 100)}%`, progress: true })),
  ].map((entry) => {
    const chip = document.createElement('span');
    chip.textContent = entry.text;
    chip.classList.toggle('is-progress', entry.progress);
    return chip;
  });
  elements.technologies.replaceChildren(...chips);
}

function renderRelations(snapshot, polity) {
  if (!polity) {
    elements.relationSection.hidden = true;
    elements.relationList.replaceChildren();
    return;
  }
  const interactions = snapshot.relations
    .filter((relation) => relation.a === polity.id || relation.b === polity.id)
    .map((relation) => {
      const partnerId = relation.a === polity.id ? relation.b : relation.a;
      return { relation, partner: snapshot.polities.find((entry) => entry.id === partnerId) };
    })
    .filter((entry) => entry.partner)
    .sort((a, b) => (b.relation.status === 'war' ? 1000 : b.relation.trade + b.relation.tension * 80) - (a.relation.status === 'war' ? 1000 : a.relation.trade + a.relation.tension * 80));
  elements.relationSection.hidden = interactions.length === 0;
  elements.relationList.replaceChildren(...interactions.map(({ relation, partner }) => {
    const item = document.createElement('li');
    item.className = `status-${relation.status}`;
    const dot = document.createElement('i');
    const copy = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = partner.name;
    const detail = document.createElement('small');
    detail.textContent = `${statusLabel(relation.status)} · 신뢰 ${Math.round(relation.trust * 100)} · 긴장 ${Math.round(relation.tension * 100)}`;
    const trade = document.createElement('em');
    trade.textContent = relation.status === 'war' ? '교전 중' : `물동 ${formatCompact(relation.trade)}`;
    copy.append(name, detail);
    item.append(dot, copy, trade);
    return item;
  }));
}

function renderEvents(snapshot) {
  const events = state.simulation.getRecentEvents(snapshot.year, 7);
  const latest = events[0];
  elements.eventCaption.textContent = latest
    ? `${latest.title} · ${latest.detail}`
    : `${snapshot.communities.length}개 수렵·채집 집단 · 미래는 아직 계산되지 않음`;
  elements.eventList.replaceChildren(...events.map((event) => {
    const item = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = calendarLabel(event.calendarYear);
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

function renderMilestones() {
  const events = state.simulation.events
    .filter((event) => ['technology', 'settlement', 'polity', 'war', 'battle', 'peace'].includes(event.type))
    .slice(-120);
  const maximum = Math.max(1, state.simulation.year);
  const signature = events.map((event) => `${event.year}:${event.type}`).join('|');
  if (signature !== state.milestoneSignature) {
    elements.milestoneTrack.replaceChildren(...events.map((event) => {
      const marker = document.createElement('i');
      marker.dataset.year = String(event.year);
      marker.setAttribute('aria-label', `${calendarLabel(event.calendarYear)} · ${event.title}`);
      return marker;
    }));
    state.milestoneSignature = signature;
  }
  for (const marker of elements.milestoneTrack.children) marker.style.left = `${Number(marker.dataset.year) / maximum * 100}%`;
}

function renderTimeline(snapshot) {
  const maximum = Math.max(1, state.simulation.year);
  const live = snapshot.year === state.simulation.year;
  elements.timeline.max = String(maximum);
  elements.timeline.value = String(snapshot.year);
  elements.timeline.style.setProperty('--timeline-progress', `${snapshot.year / maximum * 100}%`);
  elements.date.textContent = snapshot.calendarLabel;
  elements.drawerDate.textContent = snapshot.calendarLabel;
  elements.historyEnd.textContent = live ? '현재' : `생성 ${calendarLabel(state.simulation.calendarYear)}`;
  elements.liveIndicator.textContent = live ? 'LIVE' : '과거 기록';
  elements.liveIndicator.classList.toggle('is-history', !live);
  elements.live.classList.toggle('is-live', live);
  renderMilestones();
}

function renderSelection(snapshot) {
  populateEntities(snapshot);
  let community = snapshot.communities.find((entry) => entry.id === state.selectedCommunityId);
  if (!community) community = [...snapshot.communities].sort((a, b) => b.population - a.population)[0] || null;
  state.selectedCommunityId = community?.id ?? null;
  if (!community) return;
  elements.entitySelect.value = String(community.id);
  const culture = snapshot.cultures.find((entry) => entry.id === community.cultureId);
  const polity = snapshot.polities.find((entry) => entry.id === community.polityId) || null;
  elements.entityChipKicker.textContent = polity ? `${polity.type} · ${polity.name}` : community.permanent ? '독립 정착지' : '이동 집단';
  elements.entityChipName.textContent = community.name;
  elements.entityChipStatus.textContent = `${formatCompact(community.population)}명`;
  elements.entityChipColor.style.backgroundColor = polity
    ? `rgb(${polity.color.map((value) => Math.round(value * 255)).join(',')})`
    : community.permanent ? '#d2b879' : '#df9e58';
  setPairs(
    ['인구', '생활 형태', '영양', '건강', '건축물', '소속'],
    [number(community.population), community.type, percent(community.nutrition), percent(community.health), `${number(community.buildings)}동`, polity?.name || culture?.name || '독립 집단'],
  );
  renderTechnologies(culture);
  renderRelations(snapshot, polity);
  elements.modelNote.textContent = polity
    ? `${polity.name}은 ${polity.settlementIds.length}개 생활권, 인구 ${number(polity.population)}명으로 구성됩니다. 경계·교역·전쟁은 정착지의 실제 위치와 이동 비용에서 계산됩니다.`
    : '아직 국가는 존재하지 않습니다. 식량 잉여, 상설 정착, 공동 방어와 재분배 조직이 충분히 축적될 때만 정치체가 형성됩니다.';
}

function renderCurrent() {
  const snapshot = state.simulation.getSnapshotAtYear(state.displayYear);
  state.displayYear = snapshot.year;
  elements.stage.textContent = `${snapshot.totals.era.label} · ${snapshot.calendarLabel}`;
  elements.population.textContent = number(snapshot.totals.population);
  elements.communities.textContent = `${snapshot.totals.communities}개`;
  elements.polities.textContent = snapshot.totals.polities ? `${snapshot.totals.polities}개` : '없음';
  renderSelection(snapshot);
  renderEvents(snapshot);
  renderTimeline(snapshot);
  state.scene?.setSnapshot(snapshot, state.selectedCommunityId);
}

function setDisplayYear(value, options = {}) {
  state.displayYear = clamp(Math.round(Number(value) || 0), 0, state.simulation.year);
  renderCurrent();
  if (options.focus && state.selectedCommunityId != null) state.scene?.focusCommunity(state.selectedCommunityId, false);
}

function advanceAndDisplay(years) {
  const count = Math.max(0, Math.floor(years));
  if (!count) return;
  const availableHistory = state.simulation.year - state.displayYear;
  const historyStep = Math.min(availableHistory, count);
  state.displayYear += historyStep;
  const futureStep = count - historyStep;
  if (futureStep > 0) {
    state.simulation.advanceYears(futureStep);
    state.displayYear = state.simulation.year;
  }
  renderCurrent();
}

function setPlaying(value) {
  state.playing = Boolean(value);
  state.accumulator = 0;
  state.lastFrame = performance.now();
  elements.play.classList.toggle('is-playing', state.playing);
  elements.play.setAttribute('aria-label', state.playing ? '시뮬레이션 일시정지' : '시뮬레이션 재생');
}

function animationTick(time) {
  const delta = Math.min(0.16, Math.max(0, (time - state.lastFrame) / 1000));
  if (state.playing && state.simulation) {
    state.accumulator += delta * state.speeds[state.speedIndex].yearsPerSecond;
    const years = Math.min(120, Math.floor(state.accumulator));
    if (years > 0) {
      state.accumulator -= years;
      advanceAndDisplay(years);
    }
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

function selectCommunity(id, focus = true) {
  state.selectedCommunityId = Number(id);
  renderCurrent();
  state.scene?.setSelected(state.selectedCommunityId);
  if (focus) state.scene?.focusCommunity(state.selectedCommunityId, state.views[state.viewIndex].id === 'settlement');
}

function bindInterface() {
  elements.timeline.addEventListener('input', () => {
    setPlaying(false);
    setDisplayYear(elements.timeline.value);
  });
  elements.play.addEventListener('click', () => setPlaying(!state.playing));
  elements.start.addEventListener('click', () => { setPlaying(false); setDisplayYear(0); });
  elements.live.addEventListener('click', () => setDisplayYear(state.simulation.year));
  elements.speed.addEventListener('click', () => {
    state.speedIndex = (state.speedIndex + 1) % state.speeds.length;
    elements.speed.textContent = state.speeds[state.speedIndex].label;
  });
  elements.view.addEventListener('click', () => {
    state.viewIndex = (state.viewIndex + 1) % state.views.length;
    const view = state.views[state.viewIndex];
    elements.view.textContent = view.label;
    state.scene.setView(view.id);
  });
  elements.info.addEventListener('click', () => toggleDrawer());
  elements.drawerClose.addEventListener('click', () => toggleDrawer(false));
  elements.entityChip.addEventListener('click', () => toggleDrawer(true));
  elements.entitySelect.addEventListener('change', () => selectCommunity(elements.entitySelect.value, true));
  window.addEventListener('keydown', (event) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (event.code === 'Space') { event.preventDefault(); setPlaying(!state.playing); }
    if (event.code === 'ArrowLeft') { setPlaying(false); setDisplayYear(state.displayYear - (event.shiftKey ? 100 : 1)); }
    if (event.code === 'ArrowRight') { setPlaying(false); advanceAndDisplay(event.shiftKey ? 100 : 1); }
    if (event.code === 'Home') { setPlaying(false); setDisplayYear(0); }
    if (event.code === 'End') setDisplayYear(state.simulation.year);
    if (event.code === 'Escape') toggleDrawer(false);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });
  elements.canvas.addEventListener('pointerdown', (event) => {
    state.pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() };
    elements.gestureHint.classList.add('is-hidden');
  });
  elements.canvas.addEventListener('pointerup', (event) => {
    if (!state.pointerStart) return;
    const distance = Math.hypot(event.clientX - state.pointerStart.x, event.clientY - state.pointerStart.y);
    const duration = performance.now() - state.pointerStart.time;
    state.pointerStart = null;
    if (distance > 7 || duration > 650) return;
    const id = state.scene.pick(event.clientX, event.clientY);
    if (id != null) selectCommunity(id, false);
  });
  setTimeout(() => elements.gestureHint.classList.add('is-hidden'), 9000);
}

async function bootstrap() {
  try {
    const parameters = new URLSearchParams(location.search);
    const seed = parameters.get('seed') || 'new-horizon';
    const size = clamp(Math.round(Number(parameters.get('size')) || 112), 72, 128);
    updateProgress(0.03, '판 구조·고도·기후 생성');
    await nextPaint();

    state.world = createPrimitiveWorld({ seed, size, spanKm: 2400 });
    updateProgress(0.22, '유역·자원·생태 수용력 계산');
    await nextPaint();

    state.simulation = createDeepTimeSimulation({ seed, world: state.world });
    state.selectedCommunityId = state.simulation.communities[0]?.id ?? null;
    updateProgress(0.31, '수렵·채집 집단과 재고 장부 연결');
    await nextPaint();

    state.scene = new UnifiedWorldScene(elements.canvas, state.world, {
      onProgress(value, label) { updateProgress(0.33 + value * 0.64, label); },
    });
    bindInterface();
    renderCurrent();
    updateProgress(1, '원시 세계 관측 준비 완료');
    await nextPaint();
    elements.loading.classList.add('is-finished');
    state.lastFrame = performance.now();
    requestAnimationFrame(animationTick);

    window.__DEEP_TIME_WORLD__ = {
      version: '5.0.0-unified-prehistory',
      seed,
      world: state.world,
      simulation: state.simulation,
      get year() { return state.simulation.year; },
      get calendarYear() { return state.simulation.calendarYear; },
      advanceYears(years) {
        state.simulation.advanceYears(years);
        state.displayYear = state.simulation.year;
        renderCurrent();
        return state.simulation.latestSnapshot;
      },
      setYear(year) { setPlaying(false); setDisplayYear(year); },
      selectCommunity(id) { selectCommunity(id, true); },
      diagnostics() {
        return {
          engine: state.simulation.diagnostics(),
          renderer: state.scene.diagnostics(),
          world: state.world.diagnostics,
        };
      },
    };
  } catch (error) {
    console.error(error);
    elements.loading.classList.add('is-finished');
    elements.error.hidden = false;
    elements.errorMessage.textContent = error instanceof Error ? error.message : String(error);
  }
}

bootstrap();
