function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function emptyStat() {
  return { calls: 0, exclusiveMs: 0, inclusiveMs: 0, maxExclusiveMs: 0 };
}

export class RuntimeProfiler {
  constructor({ historyLimit = 60 } = {}) {
    this.historyLimit = Math.max(1, Number(historyLimit || 60));
    this.reset();
  }

  reset() {
    this.stats = new Map();
    this.months = [];
    this.currentMonth = null;
    this.stack = [];
    this.totalObservedMs = 0;
    this.measuredMonths = 0;
  }

  beginMonth(month) {
    this.currentMonth = {
      month: Number(month || 0),
      totalMs: 0,
      attributedMs: 0,
      unattributedMs: 0,
      phases: {}
    };
    this.stack = [];
  }

  enter(label) {
    const frame = {
      label: String(label),
      start: nowMs(),
      childInclusiveMs: 0
    };
    this.stack.push(frame);
    return frame;
  }

  exit(frame) {
    const ended = nowMs();
    const inclusiveMs = Math.max(0, ended - frame.start);
    const exclusiveMs = Math.max(0, inclusiveMs - frame.childInclusiveMs);

    const top = this.stack[this.stack.length - 1];
    if (top === frame) this.stack.pop();
    else {
      const index = this.stack.lastIndexOf(frame);
      if (index >= 0) this.stack.splice(index, 1);
    }

    const parent = this.stack[this.stack.length - 1];
    if (parent) parent.childInclusiveMs += inclusiveMs;

    const stat = this.stats.get(frame.label) || emptyStat();
    stat.calls += 1;
    stat.exclusiveMs += exclusiveMs;
    stat.inclusiveMs += inclusiveMs;
    stat.maxExclusiveMs = Math.max(stat.maxExclusiveMs, exclusiveMs);
    this.stats.set(frame.label, stat);

    if (this.currentMonth) {
      this.currentMonth.phases[frame.label] = (this.currentMonth.phases[frame.label] || 0) + exclusiveMs;
    }
    return { inclusiveMs, exclusiveMs };
  }

  measure(label, fn) {
    const frame = this.enter(label);
    try {
      return fn();
    } finally {
      this.exit(frame);
    }
  }

  wrap(target, methodName, label = methodName) {
    if (!target || typeof target[methodName] !== 'function') return false;
    const current = target[methodName];
    if (current.__economicLabProfiled) return false;
    const profiler = this;

    function profiledMethod(...args) {
      const frame = profiler.enter(label);
      try {
        return current.apply(this, args);
      } finally {
        profiler.exit(frame);
      }
    }

    Object.defineProperty(profiledMethod, '__economicLabProfiled', { value: true });
    Object.defineProperty(profiledMethod, '__economicLabOriginal', { value: current });
    target[methodName] = profiledMethod;
    return true;
  }

  endMonth(totalMs) {
    if (!this.currentMonth) return null;
    const row = this.currentMonth;
    row.totalMs = Math.max(0, Number(totalMs || 0));
    row.attributedMs = Object.values(row.phases).reduce((sum, value) => sum + Number(value || 0), 0);
    row.unattributedMs = Math.max(0, row.totalMs - row.attributedMs);
    row.phases.unattributed = row.unattributedMs;

    this.totalObservedMs += row.totalMs;
    this.measuredMonths += 1;
    this.months.push(structuredClone(row));
    if (this.months.length > this.historyLimit) this.months.shift();
    this.currentMonth = null;
    this.stack = [];
    return row;
  }

  report() {
    const total = Math.max(1e-12, this.totalObservedMs);
    const phases = [...this.stats.entries()]
      .map(([label, stat]) => ({
        label,
        calls: stat.calls,
        exclusiveMs: stat.exclusiveMs,
        inclusiveMs: stat.inclusiveMs,
        maxExclusiveMs: stat.maxExclusiveMs,
        meanExclusiveMsPerMonth: stat.exclusiveMs / Math.max(1, this.measuredMonths),
        shareOfObservedTime: stat.exclusiveMs / total
      }))
      .sort((a, b) => b.exclusiveMs - a.exclusiveMs || a.label.localeCompare(b.label));

    const attributedMs = phases.reduce((sum, row) => sum + row.exclusiveMs, 0);
    const unattributedMs = Math.max(0, this.totalObservedMs - attributedMs);
    return {
      measuredMonths: this.measuredMonths,
      totalObservedMs: this.totalObservedMs,
      attributedMs,
      unattributedMs,
      attributedShare: this.totalObservedMs > 0 ? attributedMs / this.totalObservedMs : 0,
      phases,
      recentMonths: this.months.map(row => structuredClone(row))
    };
  }
}
