import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./style.css";

type LodLevel = "A" | "B" | "C" | "D";
type EntityKind = "agent" | "object";
type EventSeverity = "info" | "warning";

interface LodCounts {
  readonly A: number;
  readonly B: number;
  readonly C: number;
  readonly D: number;
}

interface RenderRegion {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly size: number;
  readonly lod: LodLevel;
}

interface RenderEntity {
  readonly id: number;
  readonly kind: EntityKind;
  readonly x: number;
  readonly z: number;
  readonly height: number;
}

interface EventMarker {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly severity: EventSeverity;
}

interface RenderSnapshot {
  readonly schemaVersion: "render-snapshot.v1";
  readonly source: "kernel";
  readonly tick: number;
  readonly seed: number;
  readonly digest: string;
  readonly lodCounts: LodCounts;
  readonly regions: readonly RenderRegion[];
  readonly entities: readonly RenderEntity[];
  readonly events: readonly EventMarker[];
}

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error("viewer root element was not found");
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && isFiniteNumber(value) && value >= 0;

const isLodLevel = (value: unknown): value is LodLevel =>
  value === "A" || value === "B" || value === "C" || value === "D";

const assertRegion = (value: unknown): asserts value is RenderRegion => {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.id) ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.z) ||
    !isFiniteNumber(value.size) ||
    value.size <= 0 ||
    !isLodLevel(value.lod)
  ) {
    throw new Error("RenderSnapshot contains an invalid region");
  }
};

const assertEntity = (value: unknown): asserts value is RenderEntity => {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.id) ||
    (value.kind !== "agent" && value.kind !== "object") ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.z) ||
    !isFiniteNumber(value.height)
  ) {
    throw new Error("RenderSnapshot contains an invalid entity");
  }
};

const assertEvent = (value: unknown): asserts value is EventMarker => {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.id) ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.z) ||
    (value.severity !== "info" && value.severity !== "warning")
  ) {
    throw new Error("RenderSnapshot contains an invalid event marker");
  }
};

const assertLodCounts = (value: unknown): asserts value is LodCounts => {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.A) ||
    !isNonNegativeInteger(value.B) ||
    !isNonNegativeInteger(value.C) ||
    !isNonNegativeInteger(value.D)
  ) {
    throw new Error("RenderSnapshot contains invalid LOD counts");
  }
};

const assertSnapshot = (value: unknown): asserts value is RenderSnapshot => {
  if (!isRecord(value)) {
    throw new Error("RenderSnapshot root must be an object");
  }
  if (value.schemaVersion !== "render-snapshot.v1") {
    throw new Error(`unsupported RenderSnapshot schema: ${String(value.schemaVersion)}`);
  }
  if (value.source !== "kernel") {
    throw new Error(`unsupported RenderSnapshot source: ${String(value.source)}`);
  }
  if (!isNonNegativeInteger(value.tick) || !isNonNegativeInteger(value.seed)) {
    throw new Error("RenderSnapshot tick and seed must be non-negative integers");
  }
  if (typeof value.digest !== "string" || !/^[0-9a-fA-F]{16}$/.test(value.digest)) {
    throw new Error("RenderSnapshot digest must be 16 hexadecimal characters");
  }

  assertLodCounts(value.lodCounts);

  if (!Array.isArray(value.regions) || !Array.isArray(value.entities) || !Array.isArray(value.events)) {
    throw new Error("RenderSnapshot collections must be arrays");
  }

  value.regions.forEach(assertRegion);
  value.entities.forEach(assertEntity);
  value.events.forEach(assertEvent);
};

const loadSnapshot = async (): Promise<RenderSnapshot> => {
  const response = await fetch("/snapshots/latest.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`failed to load RenderSnapshot: HTTP ${response.status}`);
  }

  const value: unknown = await response.json();
  assertSnapshot(value);
  return value;
};

const diagnosticRegions: readonly RenderRegion[] = [
  { id: 1, x: -8.55, z: -8.55, size: 16.8, lod: "D" },
  { id: 2, x: 8.55, z: -8.55, size: 16.8, lod: "D" },
  { id: 3, x: -8.55, z: 8.55, size: 16.8, lod: "D" },
  { id: 4, x: 8.55, z: 8.55, size: 16.8, lod: "D" },
];

const renderSnapshot = (snapshot: RenderSnapshot): void => {
  const regions = snapshot.regions.length === 0 ? diagnosticRegions : snapshot.regions;
  const usesDiagnosticScaffold = snapshot.regions.length === 0;

  app.innerHTML = `
    <main class="viewer-shell">
      <div class="viewport" aria-label="3D Stage 0 diagnostic viewport"></div>
      <section class="overlay" aria-label="RenderSnapshot diagnostics">
        <p class="eyebrow">${snapshot.schemaVersion} · ${snapshot.source}</p>
        <h1>Artificial World — Stage 0</h1>
        <p class="description">
          Kernel이 생성한 읽기 전용 Snapshot을 표시한다. 현재 권위 개체와 사건은 아직 없으며,
          ${usesDiagnosticScaffold ? "화면의 네 구역은 좌표 확인용 Viewer 스캐폴드다." : "Region도 Snapshot에서 직접 읽었다."}
        </p>
        <dl class="metrics">
          <div class="metric"><dt>Tick</dt><dd>${snapshot.tick.toLocaleString()}</dd></div>
          <div class="metric"><dt>Seed</dt><dd>${snapshot.seed}</dd></div>
          <div class="metric"><dt>Digest</dt><dd title="${snapshot.digest}">${snapshot.digest}</dd></div>
          <div class="metric"><dt>Regions</dt><dd>${snapshot.regions.length}</dd></div>
          <div class="metric"><dt>Entities</dt><dd>${snapshot.entities.length}</dd></div>
          <div class="metric"><dt>Events</dt><dd>${snapshot.events.length}</dd></div>
          <div class="metric"><dt>LOD A / B</dt><dd>${snapshot.lodCounts.A} / ${snapshot.lodCounts.B}</dd></div>
          <div class="metric"><dt>LOD C / D</dt><dd>${snapshot.lodCounts.C} / ${snapshot.lodCounts.D}</dd></div>
        </dl>
        <div class="legend" aria-label="viewport legend">
          <span class="legend-item"><span class="swatch entity"></span>Entity</span>
          <span class="legend-item"><span class="swatch event"></span>Event</span>
          <span class="legend-item"><span class="swatch region"></span>Region / scaffold</span>
        </div>
        <div class="status">Kernel Snapshot 연결됨 — mock entity generation 제거</div>
      </section>
      <div class="hint">한 손가락 회전 · 두 손가락 이동/확대</div>
    </main>
  `;

  const viewport = document.querySelector<HTMLDivElement>(".viewport");
  if (viewport === null) {
    throw new Error("viewer viewport element was not found");
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101419);
  scene.fog = new THREE.Fog(0x101419, 26, 58);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  camera.position.set(17, 15, 18);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 8;
  controls.maxDistance = 54;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.set(0, 0.8, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x202318, 2.1));

  const sun = new THREE.DirectionalLight(0xfff3d1, 3.2);
  sun.position.set(12, 20, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  scene.add(sun);

  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 36, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x263027, roughness: 0.96, metalness: 0 }),
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  scene.add(terrain);

  const grid = new THREE.GridHelper(36, 36, 0x4e708f, 0x33404a);
  grid.position.y = 0.015;
  scene.add(grid);

  const regionMaterial = new THREE.MeshBasicMaterial({
    color: 0x72a6ff,
    transparent: true,
    opacity: usesDiagnosticScaffold ? 0.06 : 0.12,
    depthWrite: false,
  });

  for (const region of regions) {
    const geometry = new THREE.BoxGeometry(region.size, 0.08, region.size);
    const mesh = new THREE.Mesh(geometry, regionMaterial);
    mesh.position.set(region.x, 0.055, region.z);
    mesh.userData.regionId = region.id;
    mesh.userData.lod = region.lod;
    scene.add(mesh);
  }

  const agentGeometry = new THREE.CapsuleGeometry(0.16, 0.28, 4, 8);
  const objectGeometry = new THREE.BoxGeometry(0.42, 0.42, 0.42);
  const agentMaterial = new THREE.MeshStandardMaterial({ color: 0xf1c75b, roughness: 0.72 });
  const objectMaterial = new THREE.MeshStandardMaterial({ color: 0x7bc7a4, roughness: 0.82 });
  const entityGroup = new THREE.Group();

  for (const entity of snapshot.entities) {
    const mesh = new THREE.Mesh(
      entity.kind === "agent" ? agentGeometry : objectGeometry,
      entity.kind === "agent" ? agentMaterial : objectMaterial,
    );
    mesh.position.set(entity.x, entity.height, entity.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.entityId = entity.id;
    entityGroup.add(mesh);
  }
  scene.add(entityGroup);

  const eventGeometry = new THREE.ConeGeometry(0.28, 0.8, 10);
  const warningMaterial = new THREE.MeshStandardMaterial({ color: 0xff655d, emissive: 0x5a1210 });
  const infoMaterial = new THREE.MeshStandardMaterial({ color: 0x72a6ff, emissive: 0x142b52 });
  const eventGroup = new THREE.Group();

  for (const event of snapshot.events) {
    const marker = new THREE.Mesh(
      eventGeometry,
      event.severity === "warning" ? warningMaterial : infoMaterial,
    );
    marker.position.set(event.x, 0.72, event.z);
    marker.userData.eventId = event.id;
    eventGroup.add(marker);
  }
  scene.add(eventGroup);

  const resize = (): void => {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewport);
  resize();

  const clock = new THREE.Clock();
  const render = (): void => {
    const elapsed = clock.getElapsedTime();
    eventGroup.position.y = Math.sin(elapsed * 2.2) * 0.08;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  };

  render();
};

const showLoadFailure = (error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  app.innerHTML = `
    <main class="viewer-shell">
      <section class="overlay">
        <p class="eyebrow">RenderSnapshot load failure</p>
        <h1>Viewer를 시작할 수 없음</h1>
        <p class="description">${message}</p>
        <div class="status">Headless에서 snapshots/latest.json을 다시 생성해야 한다.</div>
      </section>
    </main>
  `;
};

void loadSnapshot().then(renderSnapshot).catch(showLoadFailure);
