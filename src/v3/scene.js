import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, createRandom, hashString, polylineLength, samplePolyline } from './core.js';
import { BuildingLayer, RoadLayer, VegetationLayer, createRiverObject, createTerrainObject } from './geometry.js';
import { createMaterialLibrary, disposeMaterialLibrary } from './materials.js';
import { REGION_HALF, ROAD_STANDARDS, terrainHeight } from './spatial.js';
import { MacroWorldLayer } from './macro-view.js';

function createSkyDome() {
  const geometry = new THREE.SphereGeometry(5600, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x7895a9) },
      horizonColor: { value: new THREE.Color(0xd4d6cd) },
      groundColor: { value: new THREE.Color(0xa9a48f) },
      sunDirection: { value: new THREE.Vector3(-0.48, 0.68, 0.56).normalize() },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vDirection = normalize(world.xyz - cameraPosition);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDirection;
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 groundColor;
      uniform vec3 sunDirection;
      void main() {
        float up = clamp(vDirection.y * 0.5 + 0.5, 0.0, 1.0);
        float skyMix = smoothstep(0.48, 0.82, up);
        vec3 color = mix(groundColor, horizonColor, smoothstep(0.28, 0.50, up));
        color = mix(color, topColor, skyMix);
        float sun = pow(max(dot(vDirection, sunDirection), 0.0), 420.0);
        float haze = pow(max(dot(vDirection, sunDirection), 0.0), 18.0) * 0.16;
        color += vec3(1.0, 0.78, 0.53) * sun * 1.8 + vec3(1.0, 0.63, 0.38) * haze;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}

function createFarmFields(spatial) {
  const group = new THREE.Group();
  group.name = 'working-landscape';
  const colors = [0x667048, 0x6d6042, 0x566a48, 0x756b4b, 0x5d6342];
  const plots = [
    [520, 520, 150, 92, 0.18], [700, 480, 132, 82, -0.12], [560, 700, 170, 76, 0.08],
    [275, 760, 124, 88, -0.18], [790, 680, 116, 74, 0.27], [420, 900, 160, 86, 0.06],
    [-5, 875, 122, 70, -0.14], [170, 930, 138, 82, 0.20], [810, 125, 120, 72, -0.25],
    [965, -40, 145, 84, 0.11], [925, 260, 115, 70, 0.32], [620, 80, 105, 62, -0.16],
  ];
  plots.forEach(([x, z, width, depth, rotation], index) => {
    const geometry = new THREE.PlaneGeometry(width, depth, 8, 8);
    geometry.rotateX(-Math.PI / 2);
    geometry.rotateY(rotation);
    const positions = geometry.attributes.position;
    for (let cursor = 0; cursor < positions.count; cursor += 1) {
      const localX = positions.getX(cursor);
      const localZ = positions.getZ(cursor);
      const worldX = x + localX;
      const worldZ = z + localZ;
      positions.setY(cursor, terrainHeight(worldX, worldZ, spatial.seedValue) + 0.08);
    }
    geometry.translate(x, 0, z);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color: colors[index % colors.length], roughness: 0.98, polygonOffset: true, polygonOffsetFactor: -1 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    group.add(mesh);
    const rowMaterial = new THREE.MeshBasicMaterial({ color: 0x433d2b, transparent: true, opacity: 0.16, depthWrite: false });
    for (let row = -2; row <= 2; row += 1) {
      const rowGeometry = new THREE.PlaneGeometry(width * 0.92, 0.34);
      rowGeometry.rotateX(-Math.PI / 2);
      rowGeometry.rotateY(rotation);
      rowGeometry.translate(x, terrainHeight(x, z, spatial.seedValue) + 0.13, z + row * depth * 0.14);
      group.add(new THREE.Mesh(rowGeometry, rowMaterial));
    }
  });
  return group;
}

class TrafficLayer {
  constructor(simulation, materials) {
    this.simulation = simulation;
    this.random = createRandom(hashString(`${simulation.seed}:v3-traffic`));
    this.maximum = 48;
    this.descriptors = Array.from({ length: this.maximum }, (_, index) => ({
      index,
      roadIndex: Math.floor(this.random() * simulation.roads.length),
      offset: this.random(),
      direction: this.random() > 0.5 ? 1 : -1,
      speed: 7 + this.random() * 8,
      color: new THREE.Color().setHSL(this.random(), 0.28 + this.random() * 0.30, 0.28 + this.random() * 0.38),
    }));
    const bodyGeometry = new RoundedBoxGeometry(1, 1, 1, 3, 0.12);
    const cabinGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.35, vertexColors: true });
    this.body = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, this.maximum);
    this.cabin = new THREE.InstancedMesh(cabinGeometry, materials.glassDark, this.maximum);
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cabin.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.body.castShadow = true;
    this.cabin.castShadow = true;
    this.body.frustumCulled = false;
    this.cabin.frustumCulled = false;
    this.descriptors.forEach((descriptor, index) => this.body.setColorAt(index, descriptor.color));
    this.body.instanceColor.needsUpdate = true;
    this.group = new THREE.Group();
    this.group.name = 'traffic';
    this.group.add(this.body, this.cabin);
    this.activeCount = 0;
    this.year = 0;
  }
  setYear(year, snapshot) {
    this.year = year;
    this.activeCount = Math.min(this.maximum, Math.max(0, Math.floor((snapshot.population - 110) / 145)));
  }
  update(elapsed) {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const euler = new THREE.Euler();
    const activeRoads = this.simulation.roads.filter((road) => road.openYear <= this.year && road.class !== 'track');
    for (let index = 0; index < this.maximum; index += 1) {
      const descriptor = this.descriptors[index];
      if (index >= this.activeCount || !activeRoads.length) {
        scale.set(0.0001, 0.0001, 0.0001);
        matrix.compose(position.set(0, -100, 0), quaternion.identity(), scale);
        this.body.setMatrixAt(index, matrix);
        this.cabin.setMatrixAt(index, matrix);
        continue;
      }
      const road = activeRoads[descriptor.roadIndex % activeRoads.length];
      const length = road.length || polylineLength(road.points);
      let progress = (descriptor.offset + elapsed * descriptor.speed / Math.max(1, length)) % 1;
      if (descriptor.direction < 0) progress = 1 - progress;
      const sample = samplePolyline(road.points, progress * length);
      const laneOffset = ROAD_STANDARDS[road.class].width * 0.19 * descriptor.direction;
      const nx = -sample.tangent.z;
      const nz = sample.tangent.x;
      const angle = Math.atan2(sample.tangent.x * descriptor.direction, sample.tangent.z * descriptor.direction);
      const x = sample.x + nx * laneOffset;
      const z = sample.z + nz * laneOffset;
      euler.set(0, angle, 0);
      quaternion.setFromEuler(euler);
      position.set(x, sample.y + 0.76, z);
      scale.set(1.75, 0.52, 3.8);
      matrix.compose(position, quaternion, scale);
      this.body.setMatrixAt(index, matrix);
      position.y += 0.46;
      scale.set(1.48, 0.48, 1.95);
      matrix.compose(position, quaternion, scale);
      this.cabin.setMatrixAt(index, matrix);
    }
    this.body.instanceMatrix.needsUpdate = true;
    this.cabin.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.body.geometry.dispose();
    this.body.material.dispose();
    this.cabin.geometry.dispose();
  }
}

class StreetLightLayer {
  constructor(simulation, materials) {
    const descriptors = [];
    for (const road of simulation.roads) {
      if (!['collector', 'arterial', 'boulevard'].includes(road.class)) continue;
      const standard = ROAD_STANDARDS[road.class];
      for (let distance = 24; distance < road.length - 20; distance += road.class === 'collector' ? 42 : 48) {
        const sample = samplePolyline(road.points, distance);
        const side = Math.round(distance / 42) % 2 ? 1 : -1;
        descriptors.push({
          road,
          x: sample.x - sample.tangent.z * side * (standard.width * 0.5 + standard.shoulder * 0.75),
          y: sample.y,
          z: sample.z + sample.tangent.x * side * (standard.width * 0.5 + standard.shoulder * 0.75),
          rotation: Math.atan2(sample.tangent.x, sample.tangent.z),
        });
      }
    }
    this.descriptors = descriptors;
    this.poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.055, 0.09, 1, 8), materials.metal, descriptors.length);
    this.arms = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.metal, descriptors.length);
    this.lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.laneWhite, descriptors.length);
    this.group = new THREE.Group();
    this.group.name = 'street-lighting';
    this.group.add(this.poles, this.arms, this.lamps);
    this.group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
  }
  setYear(year) {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    this.descriptors.forEach((descriptor, index) => {
      const visible = descriptor.road.openYear <= year ? 1 : 0.0001;
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), descriptor.rotation);
      matrix.compose(position.set(descriptor.x, descriptor.y + 3.7 * visible, descriptor.z), quaternion, scale.set(0.12 * visible, 7.4 * visible, 0.12 * visible));
      this.poles.setMatrixAt(index, matrix);
      matrix.compose(position.set(descriptor.x, descriptor.y + 7.25 * visible, descriptor.z), quaternion, scale.set(0.12 * visible, 0.12 * visible, 2.2 * visible));
      this.arms.setMatrixAt(index, matrix);
      matrix.compose(position.set(descriptor.x, descriptor.y + 7.12 * visible, descriptor.z), quaternion, scale.set(0.36 * visible, 0.16 * visible, 0.72 * visible));
      this.lamps.setMatrixAt(index, matrix);
    });
    this.poles.instanceMatrix.needsUpdate = true;
    this.arms.instanceMatrix.needsUpdate = true;
    this.lamps.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.poles.geometry.dispose();
    this.arms.geometry.dispose();
    this.lamps.geometry.dispose();
  }
}

export class CityScene {
  constructor(canvas, simulation, options = {}) {
    this.canvas = canvas;
    this.simulation = simulation;
    this.options = options;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xaebac1);
    this.scene.fog = new THREE.FogExp2(0xbfc4bd, 0.00020);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.materials = createMaterialLibrary(this.renderer);

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.5, 7600);
    this.camera.position.set(430, 345, 570);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(80, 12, 90);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.minDistance = 28;
    this.controls.maxDistance = 3200;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.screenSpacePanning = false;
    this.controls.zoomToCursor = true;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

    options.onProgress?.(0.12, '지형 표면 생성');
    this.sky = createSkyDome();
    this.localGroup = new THREE.Group();
    this.localGroup.name = 'local-settlement';
    this.terrain = createTerrainObject(simulation.spatial, this.materials);
    this.river = createRiverObject(simulation.spatial, this.materials);
    this.fields = createFarmFields(simulation.spatial);
    this.scene.add(this.sky, this.localGroup);
    this.localGroup.add(this.terrain, this.fields, this.river);

    options.onProgress?.(0.35, '도로 단면 생성');
    this.roadLayer = new RoadLayer(simulation.roads, this.materials);
    this.localGroup.add(this.roadLayer.group);

    options.onProgress?.(0.56, '건축 구성요소 배치');
    this.buildingLayer = new BuildingLayer(simulation.buildings, this.materials);
    this.localGroup.add(this.buildingLayer.group);

    options.onProgress?.(0.74, '식생과 생활 요소 배치');
    this.vegetationLayer = new VegetationLayer(simulation.spatial, simulation, this.materials);
    this.trafficLayer = new TrafficLayer(simulation, this.materials);
    this.streetLights = new StreetLightLayer(simulation, this.materials);
    this.localGroup.add(this.vegetationLayer.group, this.trafficLayer.group, this.streetLights.group);
    const MacroLayerClass = options.macroLayerClass || MacroWorldLayer;
    this.macroLayer = options.macroWorld ? new MacroLayerClass(options.macroWorld) : null;
    if (this.macroLayer) {
      this.macroLayer.group.visible = false;
      this.scene.add(this.macroLayer.group);
    }

    const hemisphere = new THREE.HemisphereLight(0xcbd9e2, 0x5d5a48, 1.6);
    this.sun = new THREE.DirectionalLight(0xffe7c1, 3.5);
    this.sun.position.set(-720, 980, 540);
    this.sun.castShadow = true;
    const shadowResolution = Math.min(window.devicePixelRatio || 1, 1.5) > 1.2 ? 2048 : 1536;
    this.sun.shadow.mapSize.set(shadowResolution, shadowResolution);
    this.sun.shadow.camera.left = -920;
    this.sun.shadow.camera.right = 920;
    this.sun.shadow.camera.top = 920;
    this.sun.shadow.camera.bottom = -920;
    this.sun.shadow.camera.near = 120;
    this.sun.shadow.camera.far = 2200;
    this.sun.shadow.bias = -0.00012;
    this.sun.shadow.normalBias = 0.65;
    this.scene.add(hemisphere, this.sun);

    this.startedAt = performance.now();
    this.year = -1;
    this.buildingRevision = simulation.buildingRevision ?? simulation.buildings.length;
    this.lastDynamicSync = 0;
    this.lastVegetationSync = 0;
    this.mode = 'settlement';
    this.running = true;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement || canvas);
    this.resize();
    this.setYear(0, true);
    this.setView('settlement');
    options.onProgress?.(1, '완료');
    this.renderer.setAnimationLoop(() => this.render());
  }

  setYear(year, force = false) {
    const value = clamp(Number(year) || 0, 0, this.simulation.years);
    if (!force && Math.abs(value - this.year) < 0.08) return;
    this.year = value;
    const simulationSnapshot = this.simulation.getSnapshot(value);
    const snapshot = simulationSnapshot.settlement || simulationSnapshot;
    this.roadLayer.setYear(value);
    this.buildingLayer.setYear(value);
    this.vegetationLayer.setYear(value);
    this.streetLights.setYear(value);
    this.trafficLayer.setYear(value, snapshot);
  }

  syncSimulation(force = false) {
    const revision = this.simulation.buildingRevision ?? this.simulation.buildings.length;
    if (revision === this.buildingRevision) return false;
    const now = performance.now();
    if (!force && now - this.lastDynamicSync < 360) return false;
    this.lastDynamicSync = now;
    this.localGroup.remove(this.buildingLayer.group);
    this.buildingLayer.dispose();
    this.buildingLayer = new BuildingLayer(this.simulation.buildings, this.materials);
    this.localGroup.add(this.buildingLayer.group);
    if (force || now - this.lastVegetationSync > 1200) {
      this.localGroup.remove(this.vegetationLayer.group);
      this.vegetationLayer.dispose();
      this.vegetationLayer = new VegetationLayer(this.simulation.spatial, this.simulation, this.materials);
      this.localGroup.add(this.vegetationLayer.group);
      this.lastVegetationSync = now;
    }
    this.buildingRevision = revision;
    this.setYear(this.year, true);
    return true;
  }

  setWorldSnapshot(snapshot, selectedCountryId = null) {
    this.macroLayer?.setSnapshot?.(snapshot, selectedCountryId);
  }

  pickCountry(clientX, clientY) {
    if (this.mode !== 'world') return null;
    return this.macroLayer?.pickCountry?.(clientX, clientY, this.camera, this.canvas) ?? null;
  }

  focusCountry(countryId) {
    if (this.mode !== 'world') return;
    this.macroLayer?.focusCountry?.(countryId, this.camera, this.controls);
  }

  setView(preset) {
    if (this.mode === 'world') {
      this.camera.position.set(1760, 1680, 1940);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
      return;
    }
    const presets = {
      settlement: { position: [430, 345, 570], target: [80, 12, 90] },
      street: { position: [220, 49, 140], target: [340, 52, 28] },
      center: { position: [395, 300, 440], target: [165, 25, -30] },
      region: { position: [10, 2020, 1800], target: [30, 0, 20] },
    };
    const next = presets[preset] || presets.settlement;
    this.camera.position.fromArray(next.position);
    this.controls.target.fromArray(next.target);
    this.controls.update();
  }

  setMode(mode) {
    this.mode = mode === 'world' && this.macroLayer ? 'world' : 'settlement';
    this.localGroup.visible = this.mode === 'settlement';
    if (this.macroLayer) this.macroLayer.group.visible = this.mode === 'world';
    this.scene.fog.density = this.mode === 'world' ? 0.00013 : 0.00020;
    this.controls.minDistance = this.mode === 'world' ? 420 : 28;
    this.controls.maxDistance = this.mode === 'world' ? 4700 : 3200;
    this.setView(this.mode === 'world' ? 'world' : 'settlement');
  }

  resize() {
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth || window.innerWidth);
    const height = Math.max(1, parent?.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render() {
    if (!this.running) return;
    const elapsed = (performance.now() - this.startedAt) / 1000;
    this.sky.position.copy(this.camera.position);
    if (this.materials.water.normalMap) {
      this.materials.water.normalMap.offset.x = elapsed * 0.006;
      this.materials.water.normalMap.offset.y = elapsed * -0.004;
    }
    if (this.mode === 'settlement') this.trafficLayer.update(elapsed);
    else this.macroLayer?.update(elapsed);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.roadLayer.dispose();
    this.buildingLayer.dispose();
    this.vegetationLayer.dispose();
    this.trafficLayer.dispose();
    this.streetLights.dispose();
    this.macroLayer?.dispose();
    this.terrain.geometry.dispose();
    this.river.geometry.dispose();
    this.fields.traverse((object) => { object.geometry?.dispose(); object.material?.dispose?.(); });
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    disposeMaterialLibrary(this.materials);
    this.renderer.dispose();
  }
}
