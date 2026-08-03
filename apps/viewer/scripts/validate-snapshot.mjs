import { readFile } from "node:fs/promises";
import process from "node:process";

const path = process.argv[2] ?? new URL("../public/snapshots/latest.json", import.meta.url);
const raw = await readFile(path, "utf8");
const snapshot = JSON.parse(raw);

const fail = (message) => {
  throw new Error(`RenderSnapshot validation failed: ${message}`);
};

if (snapshot.schemaVersion !== "render-snapshot.v1") {
  fail(`unexpected schemaVersion ${String(snapshot.schemaVersion)}`);
}
if (snapshot.source !== "kernel") {
  fail(`unexpected source ${String(snapshot.source)}`);
}
if (!Number.isSafeInteger(snapshot.tick) || snapshot.tick < 0) {
  fail("tick must be a non-negative safe integer");
}
if (!Number.isSafeInteger(snapshot.seed) || snapshot.seed < 0) {
  fail("seed must be a non-negative safe integer");
}
if (typeof snapshot.digest !== "string" || !/^[0-9a-fA-F]{16}$/.test(snapshot.digest)) {
  fail("digest must be 16 hexadecimal characters");
}
if (typeof snapshot.lodCounts !== "object" || snapshot.lodCounts === null) {
  fail("lodCounts must be an object");
}
for (const level of ["A", "B", "C", "D"]) {
  const count = snapshot.lodCounts[level];
  if (!Number.isSafeInteger(count) || count < 0) {
    fail(`lodCounts.${level} must be a non-negative safe integer`);
  }
}
for (const field of ["regions", "entities", "events"]) {
  if (!Array.isArray(snapshot[field])) {
    fail(`${field} must be an array`);
  }
}

console.log(
  JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    tick: snapshot.tick,
    seed: snapshot.seed,
    digest: snapshot.digest,
    regions: snapshot.regions.length,
    entities: snapshot.entities.length,
    events: snapshot.events.length,
  }),
);
