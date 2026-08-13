function finiteNumber(value) {
  return typeof value !== 'number' || Number.isFinite(value);
}

function agentCount(country) {
  return (country.households?.length || 0)
    + (country.firms?.filter(f => f.active !== false).length || 0)
    + (country.banks?.length || 0)
    + (country.governments?.length || 0)
    + (country.centralBanks?.length || 0);
}

export class LongRunHealthMonitor {
  constructor({ maxRecords = 240 } = {}) {
    this.maxRecords = Math.max(12, Number(maxRecords || 240));
    this.records = [];
  }

  record(world, elapsedMs = 0) {
    const failures = [];
    let agents = 0;
    let activeFirms = 0;

    for (const country of world.countries) {
      agents += agentCount(country);
      activeFirms += country.firms?.filter(f => f.active !== false).length || 0;

      for (const [key, value] of Object.entries(country.macro || {})) {
        if (!finiteNumber(value)) failures.push(`${country.id}:macro:${key}:non-finite`);
      }

      const report = world.accountingReport(country.id);
      if (report?.settlement?.ok === false) failures.push(`${country.id}:settlement`);
      if (report?.general?.ok === false) failures.push(`${country.id}:general-sfc`);
      if (report?.fiscal?.accountingOk === false) failures.push(`${country.id}:fiscal`);
      if (report?.monetary?.accountingOk === false) failures.push(`${country.id}:monetary`);
      if (report?.assetMarket?.accountingOk === false) failures.push(`${country.id}:asset-market`);
      if (report?.international?.accountingOk === false) failures.push(`${country.id}:international`);

      for (const agent of [
        ...(country.households || []),
        ...(country.firms || []).filter(f => f.active !== false),
        ...(country.banks || []),
        ...(country.governments || []),
        ...(country.centralBanks || [])
      ]) {
        const cognition = agent.cognition;
        if (!cognition?.enabled) continue;
        if ((cognition.memory?.episodes?.length || 0) > 48) failures.push(`${agent.id}:memory-bound`);
        if ((cognition.regime?.history?.length || 0) > 36) failures.push(`${agent.id}:regime-history-bound`);
        if ((cognition.social?.history?.length || 0) > 36) failures.push(`${agent.id}:social-history-bound`);
      }
    }

    if (typeof world.globalInternationalReport === 'function' && world.globalInternationalReport()?.ok === false) {
      failures.push('global:international');
    }

    const row = {
      month: world.month,
      elapsedMs: Number(elapsedMs || 0),
      agents,
      activeFirms,
      failures,
      ok: failures.length === 0
    };
    this.records.push(row);
    if (this.records.length > this.maxRecords) this.records.shift();
    return row;
  }

  summary() {
    const checked = this.records.length;
    const failed = this.records.filter(row => !row.ok);
    const elapsed = this.records.map(row => Number(row.elapsedMs || 0)).filter(value => value >= 0);
    return {
      checkedMonths: checked,
      ok: failed.length === 0,
      failureMonths: failed.length,
      failures: failed.flatMap(row => row.failures.map(failure => ({ month: row.month, failure }))).slice(-80),
      meanStepMs: elapsed.length ? elapsed.reduce((sum, value) => sum + value, 0) / elapsed.length : 0,
      maxStepMs: elapsed.length ? Math.max(...elapsed) : 0,
      last: this.records.length ? structuredClone(this.records[this.records.length - 1]) : null
    };
  }
}
