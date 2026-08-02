export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const clamp01 = (value) => clamp(value, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inverseLerp = (a, b, value) => a === b ? 0 : (value - a) / (b - a);
export const smoothstep = (edge0, edge1, value) => {
  const t = clamp01(inverseLerp(edge0, edge1, value));
  return t * t * (3 - 2 * t);
};

export function hashString(value) {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return hash >>> 0;
}

export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, z, seed = 0) {
  let value = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function valueNoise(x, z, seed = 0) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = fade(x - x0);
  const tz = fade(z - z0);
  const a = lerp(hash2(x0, z0, seed), hash2(x0 + 1, z0, seed), tx);
  const b = lerp(hash2(x0, z0 + 1, seed), hash2(x0 + 1, z0 + 1, seed), tx);
  return lerp(a, b, tz) * 2 - 1;
}

export function fbm(x, z, seed = 0, octaves = 5) {
  let frequency = 1;
  let amplitude = 0.5;
  let total = 0;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise(x * frequency, z * frequency, seed + octave * 1013) * amplitude;
    normalization += amplitude;
    frequency *= 2.03;
    amplitude *= 0.51;
  }
  return total / normalization;
}

export function gaussian2(x, z, cx, cz, radiusX, radiusZ = radiusX) {
  const dx = (x - cx) / radiusX;
  const dz = (z - cz) / radiusZ;
  return Math.exp(-(dx * dx + dz * dz) * 0.5);
}

export const distance2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function pointSegmentDistance(point, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq > 0 ? clamp01(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq) : 0;
  const x = a.x + dx * t;
  const z = a.z + dz * t;
  return { distance: Math.hypot(point.x - x, point.z - z), t, x, z };
}

export function polylineLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += distance2(points[index - 1], points[index]);
  return total;
}

export function samplePolyline(points, distanceAlong) {
  if (!points.length) return null;
  let remaining = Math.max(0, distanceAlong);
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const segment = distance2(a, b);
    if (remaining <= segment || index === points.length - 1) {
      const t = segment > 0 ? clamp01(remaining / segment) : 0;
      return {
        x: lerp(a.x, b.x, t),
        z: lerp(a.z, b.z, t),
        y: lerp(a.y || 0, b.y || 0, t),
        tangent: segment > 0 ? { x: (b.x - a.x) / segment, z: (b.z - a.z) / segment } : { x: 1, z: 0 },
        segmentIndex: index - 1,
        t,
      };
    }
    remaining -= segment;
  }
  return { ...points[points.length - 1], tangent: { x: 1, z: 0 }, segmentIndex: points.length - 2, t: 1 };
}

export function chaikin(points, iterations = 2) {
  let result = points.map((point) => ({ ...point }));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (result.length < 3) return result;
    const next = [{ ...result[0] }];
    for (let index = 0; index < result.length - 1; index += 1) {
      const a = result[index];
      const b = result[index + 1];
      next.push({ x: lerp(a.x, b.x, 0.25), z: lerp(a.z, b.z, 0.25) });
      next.push({ x: lerp(a.x, b.x, 0.75), z: lerp(a.z, b.z, 0.75) });
    }
    next.push({ ...result[result.length - 1] });
    result = next;
  }
  return result;
}

export function resamplePolyline(points, spacing = 14) {
  const length = polylineLength(points);
  const count = Math.max(2, Math.ceil(length / spacing));
  const sampled = [];
  for (let index = 0; index <= count; index += 1) {
    const sample = samplePolyline(points, length * index / count);
    sampled.push({ x: sample.x, z: sample.z });
  }
  return sampled;
}

export function weightedChoice(random, options) {
  const total = options.reduce((sum, option) => sum + Math.max(0, option.weight), 0);
  if (total <= 0) return options[0]?.value;
  let cursor = random() * total;
  for (const option of options) {
    cursor -= Math.max(0, option.weight);
    if (cursor <= 0) return option.value;
  }
  return options[options.length - 1]?.value;
}

export function formatCompact(value, locale = 'ko-KR') {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

