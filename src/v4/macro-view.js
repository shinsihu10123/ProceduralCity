import * as THREE from 'three';
import { clamp, clamp01 } from '../v3/core.js';

const RENDER_SIZE = 2600;
const HALF = RENDER_SIZE * 0.5;
const HEIGHT_SCALE = 38;
const RELATION_SEGMENTS = 22;
const MAX_FLOW_PARTICLES = 72;

const BIOME_COLORS = [
  0x315a67, 0x89908a, 0x536b5b, 0x587451, 0x7d8757,
  0xb49a61, 0x8d8b52, 0x47704e, 0x858783, 0x507467,
];

const STATUS_COLORS = Object.freeze({
  neutral: new THREE.Color(0xbba879),
  trade: new THREE.Color(0xd6bd73),
  alliance: new THREE.Color(0x76c8bb),
  tense: new THREE.Color(0xd78358),
  sanctions: new THREE.Color(0xdc694d),
  conflict: new THREE.Color(0xe33f32),
  migration: new THREE.Color(0x75aeda),
});

function worldPosition(world, cellX, cellZ, extraY = 0) {
  const x = cellX / (world.size - 1) * RENDER_SIZE - HALF;
  const z = cellZ / (world.size - 1) * RENDER_SIZE - HALF;
  const gx = clamp(Math.round(cellX), 0, world.size - 1);
  const gz = clamp(Math.round(cellZ), 0, world.size - 1);
  const elevation = world.fields.elevation[gz * world.size + gx] || 0;
  const y = elevation > 0 ? elevation / HEIGHT_SCALE + 1.5 : Math.max(-42, elevation / 72);
  return new THREE.Vector3(x, y + extraY, z);
}

function createRelief(world) {
  const segments = world.size - 1;
  const geometry = new THREE.PlaneGeometry(RENDER_SIZE, RENDER_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  const countryTint = new THREE.Color();
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const gx = Math.round((x + HALF) / RENDER_SIZE * segments);
    const gz = Math.round((z + HALF) / RENDER_SIZE * segments);
    const cell = gz * world.size + gx;
    const elevation = world.fields.elevation[cell];
    positions.setY(index, elevation > 0 ? elevation / HEIGHT_SCALE + 1.5 : Math.max(-42, elevation / 72));
    color.setHex(BIOME_COLORS[world.fields.biome[cell]] || BIOME_COLORS[4]);
    const country = world.countries[world.countryId[cell]];
    if (country && elevation > 0) {
      countryTint.setRGB(...country.color);
      color.lerp(countryTint, 0.12);
      color.offsetHSL(0, 0, clamp01(elevation / 4200) * 0.09);
    }
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.91, metalness: 0.01 }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'macro-relief';
  return mesh;
}

function createOcean() {
  const geometry = new THREE.PlaneGeometry(RENDER_SIZE * 1.08, RENDER_SIZE * 1.08);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x386d7b,
    roughness: 0.22,
    metalness: 0.08,
    transparent: true,
    opacity: 0.92,
    clearcoat: 0.72,
    clearcoatRoughness: 0.16,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0;
  mesh.receiveShadow = true;
  mesh.name = 'macro-ocean';
  return mesh;
}

function createBorders(world) {
  const positions = [];
  const size = world.size;
  for (let z = 0; z < size - 1; z += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const index = z * size + x;
      const id = world.countryId[index];
      if (id < 0) continue;
      const east = world.countryId[index + 1];
      const south = world.countryId[index + size];
      if (east >= 0 && east !== id) {
        const a = worldPosition(world, x + 0.5, z - 0.5, 4.0);
        const b = worldPosition(world, x + 0.5, z + 0.5, 4.0);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      if (south >= 0 && south !== id) {
        const a = worldPosition(world, x - 0.5, z + 0.5, 4.0);
        const b = worldPosition(world, x + 0.5, z + 0.5, 4.0);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xf2e3c2, transparent: true, opacity: 0.70, depthWrite: false }));
  lines.renderOrder = 5;
  lines.name = 'country-borders';
  return lines;
}

function createRivers(world) {
  const positions = [];
  for (let index = 0; index < world.fields.river.length; index += 1) {
    if (world.fields.river[index] < 0.16) continue;
    const next = world.fields.downstream[index];
    if (next < 0) continue;
    const x = index % world.size;
    const z = Math.floor(index / world.size);
    const nx = next % world.size;
    const nz = Math.floor(next / world.size);
    const a = worldPosition(world, x, z, 3.0);
    const b = worldPosition(world, nx, nz, 3.0);
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x72b4c0, transparent: true, opacity: 0.78, depthWrite: false }));
  lines.renderOrder = 4;
  lines.name = 'macro-rivers';
  return lines;
}

function relationCurve(world, relation) {
  const left = world.countries[relation.a];
  const right = world.countries[relation.b];
  const a = worldPosition(world, left.capital.x, left.capital.z, 17);
  const b = worldPosition(world, right.capital.x, right.capital.z, 17);
  const mid = a.clone().lerp(b, 0.5);
  mid.y += 48 + a.distanceTo(b) * 0.045;
  return new THREE.QuadraticBezierCurve3(a, mid, b);
}

class RelationNetwork {
  constructor(world) {
    this.world = world;
    this.relations = [];
    const positions = [];
    const colors = [];
    const relationCount = world.countries.length * (world.countries.length - 1) / 2;
    let cursor = 0;
    for (let a = 0; a < world.countries.length; a += 1) {
      for (let b = a + 1; b < world.countries.length; b += 1) {
        const curve = relationCurve(world, { a, b });
        const points = curve.getPoints(RELATION_SEGMENTS);
        const startVertex = cursor;
        for (let index = 1; index < points.length; index += 1) {
          const first = points[index - 1];
          const second = points[index];
          positions.push(first.x, first.y, first.z, second.x, second.y, second.z);
          colors.push(0, 0, 0, 0, 0, 0);
          cursor += 2;
        }
        this.relations.push({ a, b, curve, startVertex, vertexCount: RELATION_SEGMENTS * 2 });
      }
    }
    if (this.relations.length !== relationCount) throw new Error('Relation topology mismatch');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false });
    this.lines = new THREE.LineSegments(geometry, material);
    this.lines.name = 'dynamic-country-relations';
    this.lines.renderOrder = 7;
  }

  setSnapshot(snapshot, selectedId = null) {
    if (!snapshot) return;
    const maxTrade = Math.max(0.001, ...snapshot.relations.map((relation) => relation.tradeB));
    const attribute = this.lines.geometry.attributes.color;
    snapshot.relations.forEach((relation, index) => {
      const descriptor = this.relations[index];
      if (!descriptor) return;
      const involved = selectedId == null || relation.a === selectedId || relation.b === selectedId;
      const tradeStrength = clamp01(Math.log1p(relation.tradeB * 10) / Math.log1p(maxTrade * 10));
      const diplomaticStrength = relation.status === 'conflict' ? 1 : relation.status === 'sanctions' || relation.status === 'tense' ? 0.82 : tradeStrength;
      const brightness = involved ? 0.24 + diplomaticStrength * 0.76 : 0.025;
      const color = (STATUS_COLORS[relation.status] || STATUS_COLORS.neutral).clone().multiplyScalar(brightness);
      for (let vertex = descriptor.startVertex; vertex < descriptor.startVertex + descriptor.vertexCount; vertex += 1) {
        attribute.setXYZ(vertex, color.r, color.g, color.b);
      }
    });
    attribute.needsUpdate = true;
  }

  dispose() {
    this.lines.geometry.dispose();
    this.lines.material.dispose();
  }
}

class FlowParticles {
  constructor(world, relationNetwork) {
    this.world = world;
    this.network = relationNetwork;
    this.descriptors = [];
    const geometry = new THREE.SphereGeometry(1, 8, 6);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, emissive: 0x242018, emissiveIntensity: 0.42, roughness: 0.36 });
    this.mesh = new THREE.InstancedMesh(geometry, material, MAX_FLOW_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
    this.mesh.name = 'country-flow-particles';
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
  }

  setSnapshot(snapshot, selectedId = null) {
    if (!snapshot) return;
    const maxTrade = Math.max(0.001, ...snapshot.relations.map((relation) => relation.tradeB));
    const maxMigration = Math.max(1, ...snapshot.relations.map((relation) => relation.migrationAToB + relation.migrationBToA));
    const ranked = snapshot.relations
      .map((relation, index) => ({
        relation,
        index,
        score: relation.conflictIntensity * 2.4 + relation.tradeB / maxTrade + (relation.migrationAToB + relation.migrationBToA) / maxMigration * 0.42,
      }))
      .filter((item) => selectedId == null || item.relation.a === selectedId || item.relation.b === selectedId)
      .sort((a, b) => b.score - a.score)
      .slice(0, selectedId == null ? 20 : 14);
    this.descriptors = [];
    for (const item of ranked) {
      const relation = item.relation;
      const curve = this.network.relations[item.index]?.curve;
      if (!curve) continue;
      const forward = relation.aToB >= relation.bToA;
      this.descriptors.push({
        curve,
        reverse: !forward,
        offset: (item.index * 0.173) % 1,
        speed: relation.status === 'conflict' ? 0.05 : 0.025 + clamp01(relation.tradeB / maxTrade) * 0.045,
        size: relation.status === 'conflict' ? 5.5 : 2.4 + clamp01(relation.tradeB / maxTrade) * 3.2,
        color: (STATUS_COLORS[relation.status] || STATUS_COLORS.trade).clone(),
      });
      const migration = relation.migrationAToB + relation.migrationBToA;
      if (migration / maxMigration > 0.18 && this.descriptors.length < MAX_FLOW_PARTICLES) {
        this.descriptors.push({
          curve,
          reverse: relation.migrationAToB < relation.migrationBToA,
          offset: (item.index * 0.293 + 0.41) % 1,
          speed: 0.018 + clamp01(migration / maxMigration) * 0.035,
          size: 2.0 + clamp01(migration / maxMigration) * 2.5,
          color: STATUS_COLORS.migration.clone(),
        });
      }
    }
    this.descriptors = this.descriptors.slice(0, MAX_FLOW_PARTICLES);
    for (let index = 0; index < MAX_FLOW_PARTICLES; index += 1) {
      const descriptor = this.descriptors[index];
      this.mesh.setColorAt(index, descriptor?.color || new THREE.Color(0x000000));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(elapsed) {
    for (let index = 0; index < MAX_FLOW_PARTICLES; index += 1) {
      const descriptor = this.descriptors[index];
      if (!descriptor) {
        this.matrix.compose(this.position.set(0, -200, 0), this.quaternion.identity(), this.scale.setScalar(0.0001));
        this.mesh.setMatrixAt(index, this.matrix);
        continue;
      }
      let progress = (descriptor.offset + elapsed * descriptor.speed) % 1;
      if (descriptor.reverse) progress = 1 - progress;
      descriptor.curve.getPoint(progress, this.position);
      const pulse = 0.82 + Math.sin(elapsed * 4.2 + index) * 0.18;
      this.scale.setScalar(descriptor.size * pulse);
      this.matrix.compose(this.position, this.quaternion.identity(), this.scale);
      this.mesh.setMatrixAt(index, this.matrix);
    }
    this.mesh.count = MAX_FLOW_PARTICLES;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

class CapitalMarkers {
  constructor(world) {
    this.world = world;
    const geometry = new THREE.CylinderGeometry(0, 8, 22, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.40, metalness: 0.28 });
    this.mesh = new THREE.InstancedMesh(geometry, material, world.countries.length);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.name = 'country-capitals';
    const hitGeometry = new THREE.SphereGeometry(24, 8, 6);
    const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    this.hitMesh = new THREE.InstancedMesh(hitGeometry, hitMaterial, world.countries.length);
    this.hitMesh.name = 'country-capital-hit-targets';
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.selection = new THREE.Mesh(
      new THREE.TorusGeometry(23, 2.3, 10, 36),
      new THREE.MeshStandardMaterial({ color: 0xffe4a0, emissive: 0x76561a, emissiveIntensity: 0.68, roughness: 0.30 }),
    );
    this.selection.rotation.x = Math.PI / 2;
    this.selection.visible = false;
    this.selection.name = 'selected-country-ring';
  }

  setSnapshot(snapshot, selectedId = null) {
    if (!snapshot) return;
    const averagePopulation = snapshot.world.totalPopulation / Math.max(1, snapshot.countries.length);
    snapshot.countries.forEach((country, index) => {
      const base = this.world.countries[index];
      this.position.copy(worldPosition(this.world, base.capital.x, base.capital.z, 14));
      const markerScale = clamp(Math.sqrt(country.population / averagePopulation), 0.58, 1.65);
      this.scale.set(markerScale, markerScale, markerScale);
      this.matrix.compose(this.position, this.quaternion.identity(), this.scale);
      this.mesh.setMatrixAt(index, this.matrix);
      const color = new THREE.Color().setRGB(...base.color).lerp(new THREE.Color(0xffe6a5), index === selectedId ? 0.82 : 0.30);
      this.mesh.setColorAt(index, color);
      this.matrix.compose(this.position, this.quaternion.identity(), this.scale.setScalar(1));
      this.hitMesh.setMatrixAt(index, this.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.hitMesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.selection.visible = Number.isInteger(selectedId);
    if (Number.isInteger(selectedId)) {
      const country = this.world.countries[selectedId];
      this.selection.position.copy(worldPosition(this.world, country.capital.x, country.capital.z, 11));
    }
  }

  update(elapsed) {
    if (!this.selection.visible) return;
    const scale = 1 + Math.sin(elapsed * 2.4) * 0.09;
    this.selection.scale.setScalar(scale);
    this.selection.rotation.z = elapsed * 0.18;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.hitMesh.geometry.dispose();
    this.hitMesh.material.dispose();
    this.selection.geometry.dispose();
    this.selection.material.dispose();
  }
}

export class MacroWorldLayer {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'macro-world-v4';
    this.ocean = createOcean();
    this.relief = createRelief(world);
    this.borders = createBorders(world);
    this.rivers = createRivers(world);
    this.network = new RelationNetwork(world);
    this.flows = new FlowParticles(world, this.network);
    this.capitals = new CapitalMarkers(world);
    const settlementPosition = worldPosition(world, world.settlement.x, world.settlement.z, 20);
    this.settlementMarker = new THREE.Mesh(
      new THREE.TorusGeometry(16, 2.5, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0xdff5cf, emissive: 0x2e4d2a, emissiveIntensity: 0.72, roughness: 0.35 }),
    );
    this.settlementMarker.rotation.x = Math.PI / 2;
    this.settlementMarker.position.copy(settlementPosition);
    this.settlementMarker.name = 'settlement-marker';
    this.group.add(
      this.ocean,
      this.relief,
      this.rivers,
      this.borders,
      this.network.lines,
      this.flows.mesh,
      this.capitals.mesh,
      this.capitals.hitMesh,
      this.capitals.selection,
      this.settlementMarker,
    );
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
  }

  setSnapshot(snapshot, selectedId = null) {
    this.snapshot = snapshot;
    this.selectedId = selectedId;
    this.network.setSnapshot(snapshot, selectedId);
    this.flows.setSnapshot(snapshot, selectedId);
    this.capitals.setSnapshot(snapshot, selectedId);
  }

  pickCountry(clientX, clientY, camera, canvas) {
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = (clientX - rect.left) / Math.max(1, rect.width) * 2 - 1;
    this.pointer.y = -(clientY - rect.top) / Math.max(1, rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, camera);
    const hit = this.raycaster.intersectObject(this.capitals.hitMesh, false)[0];
    return Number.isInteger(hit?.instanceId) ? hit.instanceId : null;
  }

  focusCountry(countryId, camera, controls) {
    const country = this.world.countries[countryId];
    if (!country) return;
    const target = worldPosition(this.world, country.capital.x, country.capital.z, 0);
    const direction = camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(target);
    camera.position.copy(target).add(direction.multiplyScalar(720));
    controls.update();
  }

  update(elapsed) {
    const scale = 1 + Math.sin(elapsed * 2.1) * 0.08;
    this.settlementMarker.scale.setScalar(scale);
    this.settlementMarker.rotation.z = elapsed * 0.15;
    this.capitals.update(elapsed);
    this.flows.update(elapsed);
  }

  dispose() {
    this.network.dispose();
    this.flows.dispose();
    this.capitals.dispose();
    for (const object of [this.ocean, this.relief, this.borders, this.rivers, this.settlementMarker]) {
      object.geometry?.dispose();
      object.material?.dispose?.();
    }
  }
}

export { worldPosition };
