import * as THREE from 'three';

function seededNoise(x, y, seed = 0) {
  let value = Math.imul(x + seed * 17, 374761393) ^ Math.imul(y - seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function canvasTexture(size, painter, colorSpace = THREE.SRGBColorSpace) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { alpha: false });
  painter(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = colorSpace;
  texture.anisotropy = 4;
  return texture;
}

function noiseTexture(base, spread, scale = 1, seed = 0) {
  const baseColor = new THREE.Color(base);
  return canvasTexture(256, (context, size) => {
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const coarse = seededNoise(Math.floor(x / scale), Math.floor(y / scale), seed);
        const fine = seededNoise(x, y, seed + 29);
        const delta = (coarse * 0.72 + fine * 0.28 - 0.5) * spread;
        const index = (y * size + x) * 4;
        image.data[index] = Math.max(0, Math.min(255, (baseColor.r + delta) * 255));
        image.data[index + 1] = Math.max(0, Math.min(255, (baseColor.g + delta) * 255));
        image.data[index + 2] = Math.max(0, Math.min(255, (baseColor.b + delta) * 255));
        image.data[index + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  });
}

function brickTexture(base = '#8f4e3b', mortar = '#c8b9a6', seed = 0) {
  return canvasTexture(256, (context, size) => {
    context.fillStyle = mortar;
    context.fillRect(0, 0, size, size);
    const rowHeight = 24;
    const brickWidth = 50;
    for (let row = 0; row < Math.ceil(size / rowHeight); row += 1) {
      const offset = row % 2 ? -brickWidth * 0.5 : 0;
      for (let column = -1; column < Math.ceil(size / brickWidth) + 1; column += 1) {
        const noise = seededNoise(column, row, seed);
        const color = new THREE.Color(base).offsetHSL((noise - 0.5) * 0.015, (noise - 0.5) * 0.08, (noise - 0.5) * 0.11);
        context.fillStyle = `#${color.getHexString()}`;
        context.fillRect(offset + column * brickWidth + 2, row * rowHeight + 2, brickWidth - 4, rowHeight - 4);
        context.fillStyle = 'rgba(255,255,255,.055)';
        context.fillRect(offset + column * brickWidth + 3, row * rowHeight + 3, brickWidth - 6, 2);
      }
    }
  });
}

function roofTileTexture(base = '#6f2f28', seed = 0) {
  return canvasTexture(256, (context, size) => {
    context.fillStyle = base;
    context.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 18) {
      const offset = (y / 18) % 2 ? 12 : 0;
      for (let x = -24; x < size + 24; x += 24) {
        const lightness = 36 + seededNoise(x, y, seed) * 10;
        context.strokeStyle = `hsl(7 38% ${lightness}%)`;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x + offset, y);
        context.quadraticCurveTo(x + offset + 12, y + 15, x + offset + 24, y);
        context.stroke();
      }
      context.fillStyle = 'rgba(22,12,10,.18)';
      context.fillRect(0, y + 16, size, 2);
    }
  });
}

function glassTexture() {
  return canvasTexture(128, (context, size) => {
    const gradient = context.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#294451');
    gradient.addColorStop(0.42, '#617b82');
    gradient.addColorStop(0.47, '#b9cbd0');
    gradient.addColorStop(0.53, '#4e6872');
    gradient.addColorStop(1, '#1e333e');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    context.fillStyle = 'rgba(220,235,238,.18)';
    for (let y = 7; y < size; y += 16) context.fillRect(0, y, size, 1);
    for (let x = 11; x < size; x += 24) context.fillRect(x, 0, 1, size);
  });
}

function waterNormalTexture() {
  return canvasTexture(256, (context, size) => {
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const angleA = x * 0.19 + y * 0.07;
        const angleB = x * -0.06 + y * 0.23;
        const dx = Math.cos(angleA) * 0.55 - Math.cos(angleB) * 0.25;
        const dy = Math.cos(angleA) * 0.20 + Math.cos(angleB) * 0.62;
        const length = Math.hypot(dx, dy, 2.7);
        const index = (y * size + x) * 4;
        image.data[index] = (dx / length * 0.5 + 0.5) * 255;
        image.data[index + 1] = (dy / length * 0.5 + 0.5) * 255;
        image.data[index + 2] = (2.7 / length * 0.5 + 0.5) * 255;
        image.data[index + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  }, THREE.NoColorSpace);
}

function configureTexture(texture, repeatX, repeatY) {
  texture.repeat.set(repeatX, repeatY);
  return texture;
}

export function createMaterialLibrary(renderer) {
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const texture = (value, x, y) => {
    value.anisotropy = Math.min(maxAnisotropy, 8);
    return configureTexture(value, x, y);
  };

  const terrainMap = texture(noiseTexture('#d5d4c9', 0.08, 5, 3), 92, 92);
  const asphaltMap = texture(noiseTexture('#303336', 0.075, 2, 19), 24, 5);
  const concreteMap = texture(noiseTexture('#a8a39a', 0.07, 4, 31), 10, 10);
  const plasterMap = texture(noiseTexture('#d4c7ae', 0.052, 5, 43), 5, 5);
  const stoneMap = texture(noiseTexture('#918f87', 0.085, 3, 57), 6, 3);
  const brickRed = texture(brickTexture('#8b4938', '#b8aa97', 13), 5, 5);
  const brickWarm = texture(brickTexture('#b07855', '#c9bda9', 29), 5, 5);
  const roofRed = texture(roofTileTexture('#71352e', 37), 4, 7);
  const roofSlate = texture(roofTileTexture('#3e474c', 49), 4, 7);
  const glassMap = texture(glassTexture(), 3, 5);
  const waterNormal = texture(waterNormalTexture(), 5, 24);
  const dirtMap = texture(noiseTexture('#79684d', 0.105, 3, 73), 16, 3);

  const standard = (parameters) => new THREE.MeshStandardMaterial(parameters);
  const physical = (parameters) => new THREE.MeshPhysicalMaterial(parameters);
  const materials = {
    terrain: standard({ map: terrainMap, vertexColors: true, roughness: 0.96, metalness: 0.0 }),
    asphalt: standard({ map: asphaltMap, color: 0xffffff, roughness: 0.87, metalness: 0.02, polygonOffset: true, polygonOffsetFactor: -1 }),
    asphaltWet: physical({ map: asphaltMap, color: 0xd7d9d9, roughness: 0.52, metalness: 0.04, clearcoat: 0.18, clearcoatRoughness: 0.46 }),
    shoulder: standard({ map: concreteMap, color: 0xf0eee8, roughness: 0.91 }),
    paving: standard({ map: concreteMap, color: 0xffffff, roughness: 0.86 }),
    laneWhite: standard({ color: 0xe9e5d7, roughness: 0.72, emissive: 0x11100d }),
    laneYellow: standard({ color: 0xd9aa42, roughness: 0.70 }),
    rail: standard({ color: 0x63686a, roughness: 0.48, metalness: 0.72 }),
    stone: standard({ map: stoneMap, color: 0xffffff, roughness: 0.95 }),
    concrete: standard({ map: concreteMap, color: 0xbdb8ae, roughness: 0.88 }),
    concreteDark: standard({ map: concreteMap, color: 0x777a78, roughness: 0.89 }),
    plaster: standard({ map: plasterMap, color: 0xdacdb6, roughness: 0.89 }),
    plasterLight: standard({ map: plasterMap, color: 0xe2ddd0, roughness: 0.88 }),
    plasterOchre: standard({ map: plasterMap, color: 0xc8a77f, roughness: 0.90 }),
    brickRed: standard({ map: brickRed, color: 0xffffff, roughness: 0.91 }),
    brickWarm: standard({ map: brickWarm, color: 0xffffff, roughness: 0.90 }),
    wood: standard({ map: noiseTexture('#6e4a31', 0.065, 3, 61), color: 0xa4856c, roughness: 0.78 }),
    roofRed: standard({ map: roofRed, color: 0xffffff, roughness: 0.79 }),
    roofSlate: standard({ map: roofSlate, color: 0xffffff, roughness: 0.74 }),
    roofMetal: standard({ color: 0x69777a, roughness: 0.46, metalness: 0.62 }),
    glass: physical({ map: glassMap, color: 0x76909a, roughness: 0.18, metalness: 0.16, clearcoat: 0.45, clearcoatRoughness: 0.16 }),
    glassDark: physical({ map: glassMap, color: 0x304954, roughness: 0.16, metalness: 0.24, clearcoat: 0.56, clearcoatRoughness: 0.12 }),
    windowFrame: standard({ color: 0x282d2e, roughness: 0.38, metalness: 0.64 }),
    metal: standard({ color: 0x5a6264, roughness: 0.42, metalness: 0.72 }),
    copper: standard({ color: 0x6c8274, roughness: 0.50, metalness: 0.58 }),
    door: standard({ color: 0x4a3022, roughness: 0.69 }),
    canopy: standard({ color: 0xffffff, roughness: 0.94, vertexColors: true, emissive: 0x1b2b16, emissiveIntensity: 0.46 }),
    trunk: standard({ color: 0x5f4933, roughness: 0.98 }),
    grass: standard({ color: 0x71815d, roughness: 0.96, vertexColors: true }),
    water: physical({ color: 0x4b8491, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.84, depthWrite: false, clearcoat: 0.68, clearcoatRoughness: 0.12 }),
    construction: standard({ color: 0xb8a47d, roughness: 0.76, transparent: true, opacity: 0.70 }),
    scaffolding: standard({ color: 0x6e7575, roughness: 0.40, metalness: 0.70 }),
    solar: physical({ color: 0x172b3e, roughness: 0.20, metalness: 0.38, clearcoat: 0.65 }),
    roadEdge: standard({ color: 0x71736f, roughness: 0.90 }),
    dirt: standard({ map: dirtMap, color: 0xffffff, roughness: 0.99 }),
  };

  materials.water.normalMap = waterNormal;
  materials.water.normalScale = new THREE.Vector2(0.48, 0.48);

  for (const material of Object.values(materials)) {
    material.envMapIntensity = material === materials.glass || material === materials.glassDark ? 0.72 : 0.34;
  }
  return materials;
}

export function disposeMaterialLibrary(materials) {
  const textures = new Set();
  for (const material of Object.values(materials)) {
    if (material.map) textures.add(material.map);
    if (material.normalMap) textures.add(material.normalMap);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
}
