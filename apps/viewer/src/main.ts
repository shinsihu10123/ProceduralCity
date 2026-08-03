import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./style.css";

type LodLevel = "A" | "B" | "C" | "D";
type EntityKind = "agent" | "object";

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
  readonly severity: "info" | "warning";
}

interface RenderSnapshot {
  readonly tick: number;
  readonly seed: number;
  readonly digest: string;
  readonly lodCounts: Readonly<Record<LodLevel, number>>;
  readonly entities: readonly RenderEntity[];
  readonly events: readonly EventMarker[];
}

const makeSnapshot = (): RenderSnapshot => {
  const entities = Array.from({ length: 72 }, (_, index): RenderEntity => {
    const angle = index * 2.399963229728653;
    const radius = 2.4 + (index % 13) * 0.62;

    return {
      id: index + 1,
      kind: index % 5 === 0 ? "object" : "agent",
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      height: 0.42 + (index % 4) * 0.11,
    };
  });

  return {
    tick: 10_000,
    seed: 42,
    digest: "9d7a5f03e84c1b62",
    lodCounts: { A: 16, B: 64, C: 128, D: 48 },
    entities,
    events: [
      { id: 1, x: -5.5, z: 4.2, severity: "warning" },
      { id: 2, x: 6.2, z: -3.5, severity: "info" },
      { id: 3, x: 2.1, z: 7.1, severity: "warning" },
    ],
  };
};

const snapshot = makeSnapshot();
const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error("viewer root element was not found");
}

app.innerHTML = `
  <main class="viewer-shell">
    <div class="viewport" aria-label="3D Stage 0 diagnostic viewport"></div>
    <section class="overlay" aria-label="RenderSnapshot diagnostics">
      <p class="eyebrow">Read-only RenderSnapshot</p>
      <h1>Artificial World — Stage 0</h1>
      <p class="description">
        권위 상태를 수정하지 않는 초기 진단 Viewer다. 현재 화면은 고정된 모의 Snapshot으로
        지형, 개체, 사건 표식과 LOD 상태를 검증한다.
      </p>
      <dl class="metrics">
        <div class="metric"><dt>Tick</dt><dd>${snapshot.tick.toLocaleString()}</dd></div>
        <div class="metric"><dt>Seed</dt><dd>${snapshot.seed}</dd></div>
        <div class="metric"><dt>Digest</dt><dd title="${snapshot.digest}">${snapshot.digest}</dd></div>
        <div class="metric"><dt>Entities</dt><dd>${snapshot.entities.length}</dd></div>
        <div class="metric"><dt>LOD A / B</dt><dd>${snapshot.lodCounts.A} / ${snapshot.lodCounts.B}</dd></div>
        <div class="metric"><dt>LOD C / D</dt><dd>${snapshot.lodCounts.C} / ${snapshot.lodCounts.D}</dd></div>
      </dl>
      <div class="legend" aria-label="viewport legend">
        <span class="legend-item"><span class="swatch entity"></span>Entity</span>
        <span class="legend-item"><span class="swatch event"></span>Event</span>
        <span class="legend-item"><span class="swatch region"></span>Region</span>
      </div>
      <div class="status">Snapshot 연결 대기 — mock data</div>
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
  opacity: 0.08,
  depthWrite: false,
});
const regionGeometry = new THREE.BoxGeometry(16.8, 0.08, 16.8);

for (const [x, z] of [
  [-8.55, -8.55],
  [8.55, -8.55],
  [-8.55, 8.55],
  [8.55, 8.55],
] as const) {
  const region = new THREE.Mesh(regionGeometry, regionMaterial);
  region.position.set(x, 0.055, z);
  scene.add(region);
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
