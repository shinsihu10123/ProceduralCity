import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ExperimentSystem } from '../src/research/experiment-system.js';

const ROOT = process.cwd();
const target = process.argv[2];
assert.ok(target, 'Usage: node rv08-r4-cu-d3d-b6-s3-scenario-axis-runner.mjs <signed-runtime-script>');

const originalApplyEvent = ExperimentSystem.prototype.applyEvent;
const FACTOR_FIELD = '__r4CuD3dB6S3ExpectedProductivityFactor';
const PRODUCTIVITY_FLOOR = 0.01;

ExperimentSystem.prototype.applyEvent = function patchedS3ApplyEvent(country, event) {
  if (event?.kind === 'productivity_shock') {
    const factor = Number(event.factor ?? 1);
    assert.ok(Number.isFinite(factor) && factor > 0, `Invalid S3 productivity shock factor ${event.factor}`);

    for (const firm of country.firms || []) {
      if (firm.active === false) continue;
      if (event.industryId && firm.industryId !== event.industryId) continue;

      const current = Number(firm.productivity || 0);
      assert.ok(Number.isFinite(current) && current > 0, `Invalid pre-shock firm productivity ${firm.productivity}`);
      const postShock = Math.max(PRODUCTIVITY_FLOOR, current * factor);
      const effectiveFactor = postShock / current;
      const previous = Number(firm[FACTOR_FIELD] ?? 1);

      Object.defineProperty(firm, FACTOR_FIELD, {
        value: previous * effectiveFactor,
        enumerable: false,
        configurable: true,
        writable: true
      });
    }
  }
  return originalApplyEvent.call(this, country, event);
};

try {
  await import(pathToFileURL(resolve(ROOT, 'economic-lab/scripts/rv08-r4-cu-d3d-b6-s3-contract-compat-runner.mjs')).href);
} finally {
  ExperimentSystem.prototype.applyEvent = originalApplyEvent;
}
