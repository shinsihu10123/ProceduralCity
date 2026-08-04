import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type ViewMode = "final" | "base" | "plates" | "boundaries" | "displacement";
type BoundaryKind = "interior" | "convergent" | "divergent" | "transform";

interface Plate {
  readonly id: number;
  readonly center: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly oceanic: boolean;
}

interface SurfaceSample {
  readonly baseHeight: number;
  readonly displacement: number;
  readonly finalHeight: number;
  readonly primaryPlate: Plate;
  readonly boundary: BoundaryKind;
}

const PLATE_COUNT = 24;
const BASE_RADIUS = 4;
const HEIGHT_SCALE = 0.13;

const mix32 = (value: number): number => {
  let mixed = value | 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
};

const random01 = (seed: number, index: number, channel: number): number =>
  mix32(seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca6b)) /
  0xffffffff;

const generatePlates = (seed: number): readonly Plate[] => {
  const plates: Plate[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < PLATE_COUNT; index += 1) {
    const jitter = (random01(seed, index, 0) - 0.5) / PLATE_COUNT;
    const y = 1 - 2 * ((index + 0.5) / PLATE_COUNT + jitter);
    const radial = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = goldenAngle * index + random01(seed, index, 1) * 0.5;
    const center = new THREE.Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial).normalize();

    const rawVelocity = new THREE.Vector3(
      random01(seed, index, 2) * 2 - 1,
      random01(seed, index, 3) * 2 - 1,
      random01(seed, index, 4) * 2 - 1,
    );
    const tangent = rawVelocity.sub(center.clone().multiplyScalar(rawVelocity.dot(center))).normalize();
    const speed = 0.45 + random01(seed, index, 5) * 0.85;

    plates.push({
      id: index,
      center,
      velocity: tangent.multiplyScalar(speed),
      oceanic: random01(seed, index, 6) >= 0.38,
    });
  }

  return plates;
};

const hashNoise = (seed: number, direction: THREE.Vector3, frequency: number): number => {
  const x = Math.floor(direction.x * frequency * 4096);
  const y = Math.floor(direction.y * frequency * 4096);
  const z = Math.floor(direction.z * frequency * 4096);
  const hash = mix32(seed ^ Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791));
  return (hash / 0xffffffff) * 2 - 1;
};

const baseTerrain = (seed: number, direction: THREE.Vector3): number => {
  let frequency = 2;
  let amplitude = 1;
  let total = 0;
  let weight = 0;
  for (let octave = 0; octave < 6; octave += 1) {
    total += hashNoise(seed + octave * 1013, direction, frequency) * amplitude;
    weight += amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  return total / weight;
};

const nearestPlates = (direction: THREE.Vector3, plates: readonly Plate[]): [Plate, Plate, number] => {
  let primary = plates[0];
  let secondary = plates[1];
  let primaryScore = direction.dot(primary.center);
  let secondaryScore = direction.dot(secondary.center);

  if (secondaryScore > primaryScore) {
    [primary, secondary] = [secondary, primary];
    [primaryScore, secondaryScore] = [secondaryScore, primaryScore];
  }

  for (let index = 2; index < plates.length; index += 1) {
    const plate = plates[index];
    const score = direction.dot(plate.center);
    if (score > primaryScore) {
      secondary = primary;
      secondaryScore = primaryScore;
      primary = plate;
      primaryScore = score;
    } else if (score > secondaryScore) {
      secondary = plate;
      secondaryScore = score;
    }
  }

  return [primary, secondary, primaryScore - secondaryScore];
};

const sampleSurface = (seed: number, direction: THREE.Vector3, plates: readonly Plate[]): SurfaceSample => {
  const [primary, secondary, margin] = nearestPlates(direction, plates);
  const boundaryStrength = THREE.MathUtils.clamp(1 - margin / 0.085, 0, 1);
  let boundary: BoundaryKind = "interior";
  let displacement = 0;

  if (boundaryStrength > 0) {
    const boundaryNormal = secondary.center.clone().sub(primary.center).normalize();
    const relativeVelocity = secondary.velocity.clone().sub(primary.velocity);
    const normalMotion = relativeVelocity.dot(boundaryNormal);
    const shearMotion = relativeVelocity.clone().sub(boundaryNormal.clone().multiplyScalar(normalMotion)).length();

    if (normalMotion < -0.08) {
      boundary = "convergent";
      const bothContinental = !primary.oceanic && !secondary.oceanic;
      const uplift = bothContinental ? 1.45 : 0.8;
      const trench = primary.oceanic || secondary.oceanic ? 1.2 : 0;
      displacement = boundaryStrength * (uplift - trench * 0.72);
    } else if (normalMotion > 0.08) {
      boundary = "divergent";
      displacement = boundaryStrength * 0.52;
    } else {
      boundary = "transform";
      const sign = hashNoise(seed ^ 0x51f2a9c3, direction, 21) < 0 ? -1 : 1;
      displacement = boundaryStrength * shearMotion * 0.24 * sign;
    }
  }

  const baseHeight = baseTerrain(seed, direction);
  return {
    baseHeight,
    displacement,
    finalHeight: baseHeight + displacement,
    primaryPlate: primary,
    boundary,
  };
};

const plateColor = (plate: Plate): THREE.Color => {
  const hue = (plate.id * 0.61803398875) % 1;
  return new THREE.Color().setHSL(hue, plate.oceanic ? 0.55 : 0.42, plate.oceanic ? 0.38 : 0.56);
};

const heightColor = (height: number): THREE.Color => {
  if (height < -0.42) return new THREE.Color(0x082a47);
  if (height < -0.08) return new THREE.Color(0x155b83);
  if (height < 0.02) return new THREE.Color(0xb8a672);
  if (height < 0.3) return new THREE.Color(0x3f7547);
  if (height < 0.62) return new THREE.Color(0x77795e);
  return new THREE.Color(0xdce1e5);
};

const boundaryColor = (kind: BoundaryKind): THREE.Color => {
  switch (kind) {
    case "convergent":
      return new THREE.Color(0xff5b47);
    case "divergent":
      return new THREE.Color(0x55c7ff);
    case "transform":
      return new THREE.Color(0xffd166);
    case "interior":
      return new THREE.Color(0x26333d);
  }
};

const displacementColor = (value: number): THREE.Color => {
  const normalized = THREE.MathUtils.clamp(value / 1.4, -1, 1);
  if (normalized < 0) {
    return new THREE.Color(0x174a9c).lerp(new THREE.Color(0xf2f4f7), normalized + 1);
  }
  return new THREE.Color(0xf2f4f7).lerp(new THREE.Color(0xcf312f), normalized);
};

export const renderTectonicPreview = (app: HTMLDivElement): void => {
  app.innerHTML = `
    <main style="width:100%;height:100%;min-height:100vh;background:#091018;color:#e8eef5;font-family:Inter,system-ui,sans-serif;display:grid;grid-template-columns:minmax(0,1fr) 290px;">
      <div class="planet-viewport" style="min-height:100vh;position:relative;"></div>
      <aside style="padding:20px;border-left:1px solid #25313d;background:#111922;display:flex;flex-direction:column;gap:16px;">
        <div><p style="margin:0;color:#83a5c5;font-size:12px;text-transform:uppercase;letter-spacing:.12em;">Stage 1 · Tectonics</p><h1 style="font-size:22px;margin:6px 0 4px;">행성 지질 검사 Viewer</h1><p style="margin:0;color:#9fb0c0;font-size:13px;line-height:1.5;">판 소유권과 경계 운동이 최종 지형에 주는 영향을 비교한다.</p></div>
        <label style="display:grid;gap:6px;font-size:13px;">표시 레이어<select class="planet-mode" style="padding:9px;border-radius:8px;background:#0b131b;color:#e8eef5;border:1px solid #344454;"><option value="final">최종 판구조 지형</option><option value="base">기본 노이즈 지형</option><option value="plates">판 소유권</option><option value="boundaries">경계 유형</option><option value="displacement">지질 변위</option></select></label>
        <label style="display:grid;gap:6px;font-size:13px;">World seed<input class="planet-seed" type="number" value="42" min="0" step="1" style="padding:9px;border-radius:8px;background:#0b131b;color:#e8eef5;border:1px solid #344454;"></label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;"><input class="planet-wireframe" type="checkbox"> 메시 와이어프레임</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;"><input class="planet-rotate" type="checkbox" checked> 자동 회전</label>
        <button class="planet-rebuild" type="button" style="padding:10px;border:0;border-radius:8px;background:#6ba8ff;color:#07111c;font-weight:700;">행성 다시 생성</button>
        <div style="border-top:1px solid #25313d;padding-top:14px;font-size:12px;color:#9fb0c0;line-height:1.6;"><div><span style="color:#ff5b47;">■</span> 수렴 경계</div><div><span style="color:#55c7ff;">■</span> 발산 경계</div><div><span style="color:#ffd166;">■</span> 변환 단층</div><p>기본 화면으로 돌아가기: URL에서 <code>?mode=planet</code> 제거</p></div>
      </aside>
    </main>
  `;

  const viewport = app.querySelector<HTMLDivElement>(".planet-viewport");
  const modeSelect = app.querySelector<HTMLSelectElement>(".planet-mode");
  const seedInput = app.querySelector<HTMLInputElement>(".planet-seed");
  const wireframeInput = app.querySelector<HTMLInputElement>(".planet-wireframe");
  const rotateInput = app.querySelector<HTMLInputElement>(".planet-rotate");
  const rebuildButton = app.querySelector<HTMLButtonElement>(".planet-rebuild");
  if (
    viewport === null ||
    modeSelect === null ||
    seedInput === null ||
    wireframeInput === null ||
    rotateInput === null ||
    rebuildButton === null
  ) {
    throw new Error("tectonic preview controls were not created");
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071019);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
  camera.position.set(7.4, 4.5, 8.1);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 5.2;
  controls.maxDistance = 18;
  scene.add(new THREE.HemisphereLight(0xcce2ff, 0x18222d, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 3.1);
  sun.position.set(5, 4, 7);
  scene.add(sun);

  let planet: THREE.Mesh | null = null;
  const rebuild = (): void => {
    if (planet !== null) {
      scene.remove(planet);
      planet.geometry.dispose();
      (planet.material as THREE.Material).dispose();
    }

    const seed = Number(seedInput.value) || 0;
    const plates = generatePlates(seed);
    const mode = modeSelect.value as ViewMode;
    const geometry = new THREE.IcosahedronGeometry(BASE_RADIUS, 6).toNonIndexed();
    const positions = geometry.getAttribute("position");
    const colors: number[] = [];

    for (let index = 0; index < positions.count; index += 1) {
      const direction = new THREE.Vector3(positions.getX(index), positions.getY(index), positions.getZ(index)).normalize();
      const sample = sampleSurface(seed, direction, plates);
      const shownHeight = mode === "base" || mode === "plates" || mode === "boundaries" ? sample.baseHeight : sample.finalHeight;
      const radius = BASE_RADIUS + shownHeight * HEIGHT_SCALE;
      positions.setXYZ(index, direction.x * radius, direction.y * radius, direction.z * radius);

      let color: THREE.Color;
      switch (mode) {
        case "plates":
          color = plateColor(sample.primaryPlate);
          break;
        case "boundaries":
          color = boundaryColor(sample.boundary);
          break;
        case "displacement":
          color = displacementColor(sample.displacement);
          break;
        case "base":
          color = heightColor(sample.baseHeight);
          break;
        case "final":
          color = heightColor(sample.finalHeight);
          break;
      }
      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.02,
      flatShading: mode === "boundaries",
      wireframe: wireframeInput.checked,
    });
    planet = new THREE.Mesh(geometry, material);
    scene.add(planet);
  };

  modeSelect.addEventListener("change", rebuild);
  wireframeInput.addEventListener("change", rebuild);
  rebuildButton.addEventListener("click", rebuild);

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
  rebuild();

  const render = (): void => {
    controls.autoRotate = rotateInput.checked;
    controls.autoRotateSpeed = 0.55;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  };
  render();
};
