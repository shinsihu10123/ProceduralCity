import { clamp, clamp01, createRandom, fbm, hashString, lerp, smoothstep } from './core.js';

export const MACRO_BIOMES = Object.freeze([
  'ocean', 'tundra', 'boreal', 'temperate-forest', 'grassland', 'desert', 'savanna', 'tropical-forest', 'alpine', 'wetland',
]);

const NEIGHBORS_4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const NEIGHBORS_8 = [...NEIGHBORS_4, [1, 1], [-1, 1], [1, -1], [-1, -1]];
const indexOf = (x, z, size) => z * size + x;

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * clamp01(q))];
}

function makePlates(size, random) {
  const count = 13;
  return Array.from({ length: count }, (_, id) => {
    const angle = random() * Math.PI * 2;
    return {
      id,
      x: random() * (size - 1),
      z: random() * (size - 1),
      continental: random() < 0.52,
      velocity: { x: Math.cos(angle) * (0.4 + random()), z: Math.sin(angle) * (0.4 + random()) },
    };
  });
}

function buildElevation(size, seed, random) {
  const plates = makePlates(size, random);
  const raw = new Float32Array(size * size);
  const plateId = new Uint8Array(size * size);
  const uplift = new Float32Array(size * size);
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const nearest = plates
        .map((plate) => ({ plate, distance: Math.hypot(x - plate.x, z - plate.z) }))
        .sort((a, b) => a.distance - b.distance);
      const first = nearest[0];
      const second = nearest[1];
      const boundary = Math.abs(first.distance - second.distance);
      const bx = second.plate.x - first.plate.x;
      const bz = second.plate.z - first.plate.z;
      const bl = Math.hypot(bx, bz) || 1;
      const relativeX = second.plate.velocity.x - first.plate.velocity.x;
      const relativeZ = second.plate.velocity.z - first.plate.velocity.z;
      const convergence = Math.max(0, -(relativeX * bx / bl + relativeZ * bz / bl));
      const boundaryUplift = Math.exp(-boundary * 0.36) * convergence * 0.62;
      const continental = first.plate.continental ? 0.42 : -0.42;
      const continentalNoise = fbm(x / 31, z / 31, seed + 71, 5) * 0.46;
      const ridgeNoise = Math.abs(fbm(x / 13, z / 13, seed + 193, 4)) * boundaryUplift * 0.55;
      const edgeDistance = Math.min(x, z, size - 1 - x, size - 1 - z);
      const oceanMargin = 1 - smoothstep(size * 0.035, size * 0.16, edgeDistance);
      const index = indexOf(x, z, size);
      raw[index] = continental + continentalNoise + Math.min(0.92, boundaryUplift + ridgeNoise) - oceanMargin * 1.8;
      uplift[index] = boundaryUplift;
      plateId[index] = first.plate.id;
    }
  }
  const seaLevel = quantile(raw, 0.56);
  const elevation = new Float32Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    const relative = raw[index] - seaLevel;
    elevation[index] = relative >= 0 ? Math.pow(relative, 1.24) * 3150 : -Math.pow(-relative, 0.88) * 2250;
  }
  for (let pass = 0; pass < 4; pass += 1) {
    const next = new Float32Array(elevation);
    for (let z = 1; z < size - 1; z += 1) {
      for (let x = 1; x < size - 1; x += 1) {
        const index = indexOf(x, z, size);
        let sum = elevation[index] * 4;
        let weight = 4;
        for (const [dx, dz] of NEIGHBORS_8) { sum += elevation[indexOf(x + dx, z + dz, size)]; weight += 1; }
        next[index] = lerp(elevation[index], sum / weight, 0.36);
      }
    }
    elevation.set(next);
  }
  return { plates, plateId, uplift, elevation };
}

function oceanDistance(elevation, size) {
  const distance = new Float32Array(elevation.length);
  distance.fill(Infinity);
  const queue = new Int32Array(elevation.length);
  let head = 0;
  let tail = 0;
  for (let index = 0; index < elevation.length; index += 1) {
    if (elevation[index] <= 0) { distance[index] = 0; queue[tail++] = index; }
  }
  while (head < tail) {
    const current = queue[head++];
    const x = current % size;
    const z = Math.floor(current / size);
    for (const [dx, dz] of NEIGHBORS_4) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const next = indexOf(nx, nz, size);
      if (distance[next] <= distance[current] + 1) continue;
      distance[next] = distance[current] + 1;
      queue[tail++] = next;
    }
  }
  return distance;
}

function classifyBiome(elevation, temperature, precipitation, wetness) {
  if (elevation <= 0) return 0;
  if (elevation > 3000) return 8;
  if (temperature < -5) return 1;
  if (temperature < 5) return 2;
  if (wetness > 0.78 && elevation < 120) return 9;
  if (precipitation < 280) return 5;
  if (temperature > 22 && precipitation > 1750) return 7;
  if (temperature > 20 && precipitation > 620) return 6;
  if (precipitation > 900) return 3;
  return 4;
}

function buildClimate(elevation, size, spanKm, seed) {
  const distanceToOcean = oceanDistance(elevation, size);
  const temperature = new Float32Array(elevation.length);
  const precipitation = new Float32Array(elevation.length);
  const biome = new Uint8Array(elevation.length);
  const suitability = new Float32Array(elevation.length);
  const cellKm = spanKm / (size - 1);
  for (let z = 0; z < size; z += 1) {
    const latitude = Math.abs(z / (size - 1) * 2 - 1);
    for (let x = 0; x < size; x += 1) {
      const index = indexOf(x, z, size);
      const altitude = Math.max(0, elevation[index]);
      const noise = fbm(x / 24, z / 24, seed + 611, 3);
      const maritime = Math.exp(-distanceToOcean[index] * cellKm / 410);
      temperature[index] = 28 - latitude * 41 - altitude * 0.0061 + noise * 2.1;
      precipitation[index] = clamp(170 + maritime * 1180 + Math.exp(-Math.pow(latitude / 0.36, 2)) * 520 + noise * 310 - altitude * 0.13, 80, 2900);
      const wetness = clamp01(precipitation[index] / 1600 + maritime * 0.18);
      biome[index] = classifyBiome(elevation[index], temperature[index], precipitation[index], wetness);
      if (elevation[index] > 0) {
        const climate = 1 - clamp01(Math.abs(temperature[index] - 16) / 31);
        const rain = 1 - clamp01(Math.abs(precipitation[index] - 920) / 1450);
        const altitudeScore = 1 - clamp01(altitude / 2700);
        const coast = Math.exp(-distanceToOcean[index] / 3.6);
        suitability[index] = clamp01(climate * 0.34 + rain * 0.20 + altitudeScore * 0.30 + coast * 0.16);
      }
    }
  }
  return { distanceToOcean, temperature, precipitation, biome, suitability };
}

function buildDrainage(elevation, precipitation, size) {
  const downstream = new Int32Array(elevation.length);
  downstream.fill(-1);
  const accumulation = new Float64Array(elevation.length);
  for (let z = 1; z < size - 1; z += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const index = indexOf(x, z, size);
      if (elevation[index] <= 0) continue;
      accumulation[index] = 0.35 + precipitation[index] / 1700;
      let best = index;
      for (const [dx, dz] of NEIGHBORS_8) {
        const next = indexOf(x + dx, z + dz, size);
        if (elevation[next] < elevation[best]) best = next;
      }
      if (best !== index) downstream[index] = best;
    }
  }
  const order = Array.from({ length: elevation.length }, (_, index) => index).sort((a, b) => elevation[b] - elevation[a]);
  for (const index of order) if (downstream[index] >= 0) accumulation[downstream[index]] += accumulation[index];
  const river = new Float32Array(elevation.length);
  for (let index = 0; index < elevation.length; index += 1) {
    if (elevation[index] > 0) river[index] = clamp01((Math.log1p(accumulation[index]) - 2.7) / 4.6);
  }
  return { downstream, accumulation, river };
}

const NAME_START = ['Ari', 'Bel', 'Cae', 'Dae', 'Eli', 'Han', 'Ira', 'Jun', 'Lun', 'Mer', 'Nor', 'Sol', 'Tae', 'Val'];
const NAME_END = ['ria', 'land', 'mere', 'on', 'ia', 'ara', 'en', 'ora', 'via'];

function buildCountries(fields, size, cellKm, random) {
  const candidates = [];
  for (let z = 2; z < size - 2; z += 1) {
    for (let x = 2; x < size - 2; x += 1) {
      const index = indexOf(x, z, size);
      if (fields.suitability[index] > 0.43) candidates.push({ index, x, z, score: fields.suitability[index] + random() * 0.12 });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const seeds = [];
  for (const candidate of candidates) {
    if (seeds.every((seed) => Math.hypot(seed.x - candidate.x, seed.z - candidate.z) > size * 0.16)) seeds.push(candidate);
    if (seeds.length >= 12) break;
  }
  const countryId = new Int16Array(size * size);
  countryId.fill(-1);
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = indexOf(x, z, size);
      if (fields.elevation[index] <= 0) continue;
      let best = -1;
      let bestCost = Infinity;
      seeds.forEach((seed, id) => {
        const mountain = 1 + clamp01(fields.elevation[index] / 2600) * 0.38;
        const plate = fields.plateId[index] === fields.plateId[seed.index] ? 0.88 : 1.12;
        const cost = Math.hypot(x - seed.x, z - seed.z) * mountain * plate;
        if (cost < bestCost) { best = id; bestCost = cost; }
      });
      countryId[index] = best;
    }
  }
  const used = new Set();
  const countries = seeds.map((seed, id) => {
    let name;
    do name = `${NAME_START[Math.floor(random() * NAME_START.length)]}${NAME_END[Math.floor(random() * NAME_END.length)]}`; while (used.has(name));
    used.add(name);
    return {
      id, name, capital: { x: seed.x, z: seed.z, index: seed.index }, cells: 0, areaKm2: 0,
      population: 0, gdpPerCapita: 0, institution: 0.45 + random() * 0.48, openness: 0.30 + random() * 0.58,
      color: [0.42 + random() * 0.28, 0.42 + random() * 0.25, 0.40 + random() * 0.25],
    };
  });
  const border = new Uint8Array(size * size);
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = indexOf(x, z, size);
      const id = countryId[index];
      if (id < 0) continue;
      const country = countries[id];
      country.cells += 1;
      country.areaKm2 += cellKm * cellKm;
      for (const [dx, dz] of NEIGHBORS_4) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
        const neighbor = countryId[indexOf(nx, nz, size)];
        if (neighbor >= 0 && neighbor !== id) border[index] = 1;
      }
    }
  }
  for (const country of countries) {
    const suitability = fields.suitability[country.capital.index];
    country.population = Math.round(country.areaKm2 * (11 + suitability * 47) * (0.58 + random() * 0.65));
    country.gdpPerCapita = Math.round(6800 + country.institution * 38000 + country.openness * 8500);
    country.gdp = country.population * country.gdpPerCapita;
  }
  return { countries, countryId, border };
}

function buildTrade(countries) {
  const candidates = [];
  for (let a = 0; a < countries.length; a += 1) {
    for (let b = a + 1; b < countries.length; b += 1) {
      const left = countries[a];
      const right = countries[b];
      const distance = Math.hypot(left.capital.x - right.capital.x, left.capital.z - right.capital.z);
      const score = Math.sqrt(left.gdp * right.gdp) * (left.openness + right.openness) / Math.pow(distance + 5, 1.25);
      candidates.push({ a, b, distance, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const degree = new Uint8Array(countries.length);
  const edges = [];
  for (const candidate of candidates) {
    if (degree[candidate.a] >= 4 || degree[candidate.b] >= 4) continue;
    edges.push({ ...candidate, volume: candidate.score * 0.000016 });
    degree[candidate.a] += 1;
    degree[candidate.b] += 1;
    if (edges.length >= countries.length * 1.5) break;
  }
  return edges;
}

function selectSettlement(fields, countries, countryId, size, random) {
  let best = null;
  for (let z = 2; z < size - 2; z += 1) {
    for (let x = 2; x < size - 2; x += 1) {
      const index = indexOf(x, z, size);
      const id = countryId[index];
      if (id < 0) continue;
      const water = Math.max(fields.river[index], Math.exp(-fields.distanceToOcean[index] / 2.7));
      const score = fields.suitability[index] * 0.72 + water * 0.23 + random() * 0.05;
      if (!best || score > best.score) best = { index, x, z, countryId: id, score };
    }
  }
  return { ...best, countryName: countries[best.countryId].name, biome: MACRO_BIOMES[fields.biome[best.index]], elevationM: fields.elevation[best.index] };
}

export function createMacroWorld(input = {}) {
  const seedText = String(input.seed || 'new-horizon');
  const seed = hashString(`${seedText}:v3-macro`);
  const random = createRandom(seed);
  const size = clamp(Math.round(input.size || 96), 72, 128);
  const spanKm = clamp(input.spanKm || 3600, 2400, 5200);
  const cellKm = spanKm / (size - 1);
  const physical = buildElevation(size, seed, random);
  const climate = buildClimate(physical.elevation, size, spanKm, seed);
  const drainage = buildDrainage(physical.elevation, climate.precipitation, size);
  const fields = { ...physical, ...climate, ...drainage };
  const political = buildCountries(fields, size, cellKm, random);
  const trade = buildTrade(political.countries);
  const settlement = selectSettlement(fields, political.countries, political.countryId, size, random);
  return {
    version: '3.0.0-macro-world', seed: seedText, seedValue: seed, size, spanKm, cellKm,
    fields, ...political, trade, settlement,
    diagnostics: {
      landRatio: Array.from(physical.elevation).filter((value) => value > 0).length / physical.elevation.length,
      countries: political.countries.length,
      riverCells: Array.from(drainage.river).filter((value) => value > 0.18).length,
      tradeLinks: trade.length,
      plates: physical.plates.length,
    },
  };
}
