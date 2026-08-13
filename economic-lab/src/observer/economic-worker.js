import { EconomicWorld } from '../core/world-v10-stable.js';
import { buildLiveObserverSnapshot } from './live-observer-bridge.js';

const WORLD_SEED = 'ECON-4-001';
let world = null;

function makeWorld() {
  return new EconomicWorld(WORLD_SEED, { healthCheckInterval: 0 });
}

function compactAccounting(countryId) {
  const report = world.accountingReport(countryId) || {};
  return {
    settlement: {
      ok: report.settlement?.ok !== false,
      moneyError: Number(report.settlement?.moneyError || 0)
    },
    general: {
      ok: report.general?.ok !== false,
      maxEquationError: Number(report.general?.maxEquationError || report.general?.equationError || 0),
      depositReconciliationError: Number(report.general?.depositReconciliationError || 0),
      loanReconciliationError: Number(report.general?.loanReconciliationError || 0)
    },
    fiscal: {
      accountingOk: report.fiscal?.accountingOk !== false,
      governmentEquationError: Number(report.fiscal?.governmentEquationError || 0),
      bondReconciliationError: Number(report.fiscal?.bondReconciliationError || 0)
    },
    monetary: {
      accountingOk: report.monetary?.accountingOk !== false,
      centralBankEquationError: Number(report.monetary?.centralBankEquationError || 0)
    },
    international: {
      accountingOk: report.international?.accountingOk !== false,
      error: Number(report.international?.error || 0)
    }
  };
}

function payload(requestId) {
  const observer = buildLiveObserverSnapshot(world);
  const accounting = Object.fromEntries(observer.countries.map(country => [country.id, compactAccounting(country.id)]));
  return {
    type: 'state',
    requestId,
    observer,
    accounting,
    runtime: {
      lastStepMs: Number(world.runtime?.lastStepMs || 0),
      meanStepMs: Number(world.runtime?.meanStepMs || 0),
      activeGovernmentBonds: Object.fromEntries(world.countries.map(country => [
        country.id,
        country.governmentBonds.filter(bond => bond.status === 'active').length
      ]))
    }
  };
}

self.onmessage = event => {
  const message = event.data || {};
  const requestId = message.requestId ?? null;
  try {
    if (message.type === 'init' || message.type === 'reset') {
      world = makeWorld();
      self.postMessage(payload(requestId));
      return;
    }

    if (!world) world = makeWorld();

    if (message.type === 'step') {
      const months = Math.max(1, Math.min(120, Math.round(Number(message.months || 1))));
      world.step(months);
      self.postMessage(payload(requestId));
      return;
    }

    if (message.type === 'state') {
      self.postMessage(payload(requestId));
      return;
    }

    throw new Error(`Unknown worker message type: ${String(message.type)}`);
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null
    });
  }
};
