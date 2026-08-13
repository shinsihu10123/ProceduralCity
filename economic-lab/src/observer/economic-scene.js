import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const COUNTRY_ACCENTS = Object.freeze({
  AST: 0x88a8c8,
  BRN: 0xb99a79,
  CYR: 0x7eaaa4,
  DRN: 0xa08aaa
});

function hashUnit(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function disposeObject(root) {
  root.traverse(object => {
    if (object.geometry) object.geometry.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.());
    else object.material?.dispose?.();
  });
}

function curveBetween(a, b, lift = 5) {
  const start = new THREE.Vector3(a.x, 1.2, a.z);
  const end = new THREE.Vector3(b.x, 1.2, b.z);
  const midpoint = start.clone().lerp(end, 0.5);
  midpoint.y += lift + start.distanceTo(end) * 0.08;
  return new THREE.QuadraticBezierCurve3(start, midpoint, end);
}

export class EconomicObserverScene {
  constructor(container, { onCountrySelect = null } = {}) {
    if (!container) throw new Error('EconomicObserverScene requires a container element.');
    this.container = container;
    this.onCountrySelect = onCountrySelect;
    this.selectedCountryId = null;
    this.currentData = null;
    this.countryGroups = new Map();
    this.countryLabels = new Map();
    this.pickables = [];
    this.flowAnimations = [];
    this.pointerStart = null;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1014);
    this.scene.fog = new THREE.Fog(0x0d1014, 45, 95);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 240);
    this.camera.position.set(31, 27, 38);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 88;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.target.set(0, 0, 0);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.countryRoot = new THREE.Group();
    this.countryRoot.name = 'observer-country-root';
    this.scene.add(this.countryRoot);

    this.flowRoot = new THREE.Group();
    this.flowRoot.name = 'observer-flow-root';
    this.scene.add(this.flowRoot);

    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'world-label-layer';
    this.container.appendChild(this.labelLayer);

    this.addEnvironment();
    this.installEvents();
    this.resize();

    this.clock = new THREE.Clock();
    this.animationFrame = null;
    this.animate = this.animate.bind(this);
    this.animate();
  }

  addEnvironment() {
    const hemi = new THREE.HemisphereLight(0xdfe9f3, 0x26313c, 1.45);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.35);
    key.position.set(18, 34, 20);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -45;
    key.shadow.camera.right = 45;
    key.shadow.camera.top = 45;
    key.shadow.camera.bottom = -45;
    this.scene.add(key);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(44, 96),
      new THREE.MeshStandardMaterial({ color: 0x171c22, roughness: 0.96, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.36;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(72, 36, 0x4b5662, 0x252b32);
    grid.position.y = -0.33;
    grid.material.opacity = 0.28;
    grid.material.transparent = true;
    this.scene.add(grid);

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.7, 0.34, 32),
      new THREE.MeshStandardMaterial({ color: 0x272e36, roughness: 0.85 })
    );
    core.position.y = -0.14;
    core.receiveShadow = true;
    this.scene.add(core);
  }

  installEvents() {
    this.onPointerDown = event => {
      this.pointerStart = { x: event.clientX, y: event.clientY };
    };
    this.onPointerUp = event => {
      if (!this.pointerStart) return;
      const moved = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y);
      this.pointerStart = null;
      if (moved > 7) return;
      this.pickCountry(event);
    };
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  pickCountry(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, true);
    const hit = hits.find(entry => entry.object?.userData?.countryId);
    if (!hit) return;
    const id = hit.object.userData.countryId;
    this.setSelectedCountry(id);
    this.onCountrySelect?.(id);
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  update(observerData) {
    this.currentData = observerData;
    this.rebuildCountries(observerData.countries || []);
    this.rebuildFlows(observerData);
    if (!this.selectedCountryId && observerData.countries?.length) {
      this.selectedCountryId = observerData.countries[0].id;
    }
    this.setSelectedCountry(this.selectedCountryId);
  }

  rebuildCountries(countries) {
    for (const child of [...this.countryRoot.children]) {
      this.countryRoot.remove(child);
      disposeObject(child);
    }
    this.pickables = [];
    this.countryGroups.clear();

    for (const label of this.countryLabels.values()) label.remove();
    this.countryLabels.clear();

    for (const country of countries) {
      const group = this.makeCountryGroup(country);
      this.countryRoot.add(group);
      this.countryGroups.set(country.id, group);

      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'world-country-label';
      label.dataset.countryId = country.id;
      label.innerHTML = `<strong>${country.id}</strong><span>${country.name}</span>`;
      label.addEventListener('click', () => {
        this.setSelectedCountry(country.id);
        this.onCountrySelect?.(country.id);
      });
      this.labelLayer.appendChild(label);
      this.countryLabels.set(country.id, label);
    }
  }

  makeCountryGroup(country) {
    const group = new THREE.Group();
    group.name = `country-${country.id}`;
    group.position.set(country.position.x, 0, country.position.z);

    const accent = COUNTRY_ACCENTS[country.id] || 0x91a0ad;
    const baseRadius = 4.2 + country.visual.economyScale * 1.5;
    const territory = new THREE.Mesh(
      new THREE.CylinderGeometry(baseRadius, baseRadius * 1.07, 0.72, 32),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(accent).multiplyScalar(0.54),
        roughness: 0.78,
        metalness: 0.08,
        emissive: 0x000000,
        emissiveIntensity: 0
      })
    );
    territory.position.y = 0;
    territory.castShadow = true;
    territory.receiveShadow = true;
    territory.userData.countryId = country.id;
    territory.userData.kind = 'territory';
    group.add(territory);
    this.pickables.push(territory);

    const rim = new THREE.Mesh(
      new THREE.RingGeometry(baseRadius * 1.04, baseRadius * 1.12, 64),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.48, side: THREE.DoubleSide })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.38;
    rim.userData.countryId = country.id;
    group.add(rim);
    this.pickables.push(rim);

    const cityCount = Math.max(8, Math.round(8 + country.visual.firmScale * 30));
    const economyHeight = 0.65 + country.visual.economyScale * 3.4;
    const activity = Math.max(0.18, 1 - country.visual.unemployment * 0.88);
    for (let i = 0; i < cityCount; i += 1) {
      const u = hashUnit(`${country.id}:city:${i}:u`);
      const v = hashUnit(`${country.id}:city:${i}:v`);
      const angle = u * Math.PI * 2;
      const radius = Math.sqrt(v) * baseRadius * 0.74;
      const width = lerp(0.26, 0.64, hashUnit(`${country.id}:city:${i}:w`));
      const depth = lerp(0.26, 0.64, hashUnit(`${country.id}:city:${i}:d`));
      const height = economyHeight * lerp(0.35, 1.3, hashUnit(`${country.id}:city:${i}:h`)) * activity;
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(width, Math.max(0.18, height), depth),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(accent).lerp(new THREE.Color(0xd9e0e7), 0.2 + hashUnit(`${country.id}:city:${i}:c`) * 0.35),
          roughness: 0.55,
          metalness: 0.12
        })
      );
      building.position.set(Math.cos(angle) * radius, 0.38 + height / 2, Math.sin(angle) * radius);
      building.castShadow = true;
      building.receiveShadow = true;
      building.userData.countryId = country.id;
      group.add(building);
      this.pickables.push(building);
    }

    const sectorKeys = ['RESOURCE', 'MATERIALS', 'CAPITAL', 'CONSUMER'];
    const sectorValues = sectorKeys.map(key => Number(country.industry.sectors?.[key] || 0));
    const maxSector = Math.max(1e-9, ...sectorValues);
    sectorKeys.forEach((sector, i) => {
      const theta = (i / sectorKeys.length) * Math.PI * 2 + Math.PI / 4;
      const value = sectorValues[i];
      const normalized = Math.max(0.08, value / maxSector);
      const height = 0.55 + normalized * (1.2 + country.visual.industryScale * 2.4);
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.56, height, 8),
        new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.48, metalness: 0.28 })
      );
      tower.position.set(Math.cos(theta) * baseRadius * 0.78, 0.38 + height / 2, Math.sin(theta) * baseRadius * 0.78);
      tower.userData.countryId = country.id;
      tower.userData.sector = sector;
      tower.castShadow = true;
      group.add(tower);
      this.pickables.push(tower);
    });

    if (country.visual.externalStress > 0.02 || country.visual.crisisShare > 0.02) {
      const danger = Math.max(country.visual.externalStress, country.visual.crisisShare);
      const stressRing = new THREE.Mesh(
        new THREE.RingGeometry(baseRadius * 1.18, baseRadius * 1.25, 64),
        new THREE.MeshBasicMaterial({
          color: 0xe29176,
          transparent: true,
          opacity: 0.12 + Math.min(0.62, danger * 0.62),
          side: THREE.DoubleSide
        })
      );
      stressRing.rotation.x = -Math.PI / 2;
      stressRing.position.y = 0.42;
      group.add(stressRing);
    }

    group.userData.countryId = country.id;
    group.userData.baseRadius = baseRadius;
    return group;
  }

  rebuildFlows(observerData) {
    for (const child of [...this.flowRoot.children]) {
      this.flowRoot.remove(child);
      disposeObject(child);
    }
    this.flowAnimations = [];

    const byId = new Map((observerData.countries || []).map(country => [country.id, country.position]));
    const tradeFlows = (observerData.flows?.trade || []).slice(0, 16);
    const fundingFlows = (observerData.flows?.foreignFunding || []).filter(flow => flow.outstandingWXU > 0).slice(0, 12);
    const maxTrade = Math.max(1e-9, ...tradeFlows.map(flow => Number(flow.worldValueWXU || 0)));
    const maxFunding = Math.max(1e-9, ...fundingFlows.map(flow => Number(flow.outstandingWXU || 0)));

    tradeFlows.forEach((flow, index) => {
      const from = byId.get(flow.from);
      const to = byId.get(flow.to);
      if (!from || !to) return;
      this.addFlowCurve({
        id: `trade:${flow.id}`,
        from,
        to,
        magnitude: Number(flow.worldValueWXU || 0) / maxTrade,
        color: 0xe6b36b,
        lift: 4.2 + (index % 3) * 0.7,
        speed: 0.09 + Math.min(0.22, Number(flow.worldValueWXU || 0) / maxTrade * 0.18)
      });
    });

    fundingFlows.forEach((flow, index) => {
      const from = byId.get(flow.from);
      const to = byId.get(flow.to);
      if (!from || !to) return;
      this.addFlowCurve({
        id: `funding:${flow.id}`,
        from,
        to,
        magnitude: Number(flow.outstandingWXU || 0) / maxFunding,
        color: 0x7fa6d8,
        lift: 6.1 + (index % 3) * 0.85,
        speed: 0.055 + Math.min(0.16, Number(flow.outstandingWXU || 0) / maxFunding * 0.12)
      });
    });
  }

  addFlowCurve({ id, from, to, magnitude, color, lift, speed }) {
    const curve = curveBetween(from, to, lift);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, 0.035 + magnitude * 0.09, 6, false),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28 + magnitude * 0.5 })
    );
    tube.name = id;
    this.flowRoot.add(tube);

    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.11 + magnitude * 0.13, 10, 10),
      new THREE.MeshBasicMaterial({ color })
    );
    this.flowRoot.add(pulse);
    this.flowAnimations.push({ mesh: pulse, curve, phase: hashUnit(id), speed });
  }

  setSelectedCountry(countryId) {
    if (!countryId || !this.countryGroups.has(countryId)) return;
    this.selectedCountryId = countryId;
    for (const [id, group] of this.countryGroups) {
      const territory = group.children.find(child => child.userData?.kind === 'territory');
      if (!territory?.material) continue;
      const selected = id === countryId;
      territory.material.emissive.setHex(selected ? 0x50667d : 0x000000);
      territory.material.emissiveIntensity = selected ? 0.34 : 0;
      group.scale.setScalar(selected ? 1.035 : 1);
      const label = this.countryLabels.get(id);
      label?.classList.toggle('selected', selected);
    }
  }

  focusCountry(countryId) {
    const group = this.countryGroups.get(countryId);
    if (!group) return;
    const target = group.position.clone();
    this.controls.target.copy(target);
    const offset = new THREE.Vector3(12, 12, 16);
    this.camera.position.copy(target.clone().add(offset));
    this.controls.update();
    this.setSelectedCountry(countryId);
  }

  updateLabels() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    for (const [id, group] of this.countryGroups) {
      const label = this.countryLabels.get(id);
      if (!label) continue;
      const world = group.position.clone();
      world.y += 6.4;
      world.project(this.camera);
      const visible = world.z > -1 && world.z < 1;
      label.style.display = visible ? '' : 'none';
      label.style.transform = `translate(-50%, -50%) translate(${(world.x * 0.5 + 0.5) * width}px, ${(-world.y * 0.5 + 0.5) * height}px)`;
    }
  }

  animate() {
    const delta = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;
    this.controls.update();

    for (const animation of this.flowAnimations) {
      const t = (animation.phase + elapsed * animation.speed) % 1;
      animation.mesh.position.copy(animation.curve.getPointAt(t));
    }

    this.updateLabels();
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  dispose() {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.controls.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.labelLayer.remove();
    this.renderer.domElement.remove();
  }
}
