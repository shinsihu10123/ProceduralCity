import { EconomicWorld } from './core/world.js';

let world = new EconomicWorld('ECON-4-001');
let selectedCountryId = 'AST';

const fmt = (n, digits = 1) => Number(n || 0).toLocaleString('ko-KR', { maximumFractionDigits: digits });
const pct = n => `${(Number(n || 0) * 100).toFixed(1)}%`;

function render() {
  const snap = world.snapshot();
  document.getElementById('month').textContent = `${snap.month}개월`;
  const root = document.getElementById('countries');
  root.innerHTML = snap.countries.map(c => `
    <article class="country-card ${c.id === selectedCountryId ? 'selected' : ''}" data-country="${c.id}">
      <div class="country-head"><span>${c.id}</span><h2>${c.name}</h2></div>
      <div class="metrics">
        <div><small>GDP</small><strong>${fmt(c.macro.gdp)}</strong></div>
        <div><small>CPI</small><strong>${fmt(c.macro.priceIndex, 3)}</strong></div>
        <div><small>실업률</small><strong>${pct(c.macro.unemployment)}</strong></div>
        <div><small>평균임금</small><strong>${fmt(c.macro.avgWage)}</strong></div>
        <div><small>예금통화</small><strong>${fmt(c.macro.moneySupply)}</strong></div>
        <div><small>대출잔액</small><strong>${fmt(c.macro.outstandingLoans)}</strong></div>
        <div><small>신규신용</small><strong>${fmt(c.macro.newCredit)}</strong></div>
        <div><small>은행이익</small><strong>${fmt(c.macro.bankProfit)}</strong></div>
      </div>
      <footer>가계 ${fmt(c.households,0)} · 기업 ${fmt(c.firms,0)} · 은행 ${fmt(c.banks,0)} · 활성대출 ${fmt(c.activeLoans,0)} · SFC ${c.generalAccounting.ok ? 'PASS' : 'FAIL'}</footer>
    </article>`).join('');

  for (const el of root.querySelectorAll('[data-country]')) {
    el.addEventListener('click', () => {
      selectedCountryId = el.dataset.country;
      document.getElementById('countrySelect').value = selectedCountryId;
      render();
    });
  }

  const select = document.getElementById('countrySelect');
  if (!select.options.length) {
    for (const c of snap.countries) select.add(new Option(`${c.id} · ${c.name}`, c.id));
    select.value = selectedCountryId;
    select.addEventListener('change', () => { selectedCountryId = select.value; render(); });
  }

  const country = snap.countries.find(c => c.id === selectedCountryId) || snap.countries[0];
  document.getElementById('householdTrace').textContent = formatHousehold(country.sampleHousehold);
  document.getElementById('firmTrace').textContent = formatFirm(country.sampleFirm);
  document.getElementById('bankTrace').textContent = formatBank(country);
  document.getElementById('marketTrace').textContent = formatMarkets(country);
  document.getElementById('financialTrace').textContent = formatFinancials(country);
  document.getElementById('journalTrace').textContent = formatJournals(country);
  document.getElementById('transactionTrace').textContent = formatTransactions(country);
}

function formatHousehold(h) {
  const t = h.lastTrace;
  if (!t) return `${h.id}\n아직 첫 판단 전입니다. +1개월을 눌러주세요.`;
  const purchases = (h.lastPurchases || []).slice(0, 4);
  return [
    h.id,
    `고용: ${h.employed ? '고용' : '실업'} / 예금: ${fmt(h.wealth)} / 대출: ${fmt(h.loanBalance || 0)}`,
    `임금수령: ${fmt(h.income)} / 실제소비: ${fmt(h.consumption)} / 순저축: ${fmt(h.savings)}`,
    `임금미수: ${fmt(h.wageArrears || 0)} / 신용미스: ${fmt(h.creditMisses || 0,0)}`,
    '',
    '[관찰·인식]',
    `인지 물가상승: ${pct(t.perception.inflation)}`,
    `인지 실직위험: ${pct(t.perception.jobRisk)}`,
    `예상 소득증가: ${pct(t.perception.expectedIncomeGrowth)}`,
    '',
    '[가설]',
    ...t.hypotheses.map(x => `- ${x.name}: 확신 ${pct(x.confidence)}`),
    '',
    `[선택] ${t.selected}`,
    `주된 이유: ${t.reason}`,
    '',
    '[실제 구매]',
    ...(purchases.length ? purchases.map(x => `- ${x.firmId}: ${fmt(x.units,2)}단위 × ${fmt(x.price,3)} = ${fmt(x.amount)}`) : ['- 체결 거래 없음'])
  ].join('\n');
}

function formatFirm(f) {
  const t = f.lastTrace;
  if (!t) return `${f.id}\n아직 첫 판단 전입니다. +1개월을 눌러주세요.`;
  return [
    f.id,
    `가격: ${fmt(f.price,3)} / 근로자: ${fmt(f.workers,0)} / 예금: ${fmt(f.cash)} / 대출: ${fmt(f.loanBalance || 0)}`,
    `생산: ${fmt(f.output,2)} / 판매: ${fmt(f.sales,2)} / 매출: ${fmt(f.revenue)}`,
    `임금미지급: ${fmt(f.wageArrears || 0)} / 장부 단위원가: ${fmt(f.bookUnitCost || 0,3)}`,
    '',
    '[관찰·예상]',
    `관찰 수요증가: ${pct(t.perception.observedDemandGrowth)}`,
    `예상 수요증가: ${pct(t.perception.expectedDemandGrowth)}`,
    `예상 비용증가: ${pct(t.perception.expectedCostGrowth)}`,
    `재고압력: ${fmt(t.perception.inventoryPressure,2)}`,
    `현금스트레스: ${pct(t.perception.cashStress)}`,
    '',
    '[반사실적 전략 비교]',
    ...t.candidates.map(x => `- ${x.name}: 효용 ${fmt(x.utility,3)}`),
    '',
    `[선택] ${t.selected}`,
    `주된 이유: ${t.reason}`
  ].join('\n');
}

function formatBank(c) {
  const b = c.sampleBank;
  const t = b?.lastTrace;
  const cr = c.credit || {};
  const loan = c.sampleLoan;
  if (!b) return '은행이 없습니다.';
  const out = [
    `${b.id} · ${b.name}`,
    `기준금리 ${pct(b.baseAnnualRate)} / 대출마진 ${pct(b.loanMarkup)} / 최소자본비율 ${pct(b.minCapitalRatio)}`,
    `위험회피 ${fmt(b.riskAversion,2)} / 모형불확실성 ${fmt(b.modelUncertainty,2)}`,
    '',
    '[이번 달 신용시장]',
    `신청 ${fmt(cr.applications,0)} / 승인 ${fmt(cr.approved,0)} / 거절 ${fmt(cr.rejected,0)}`,
    `신규대출 ${fmt(cr.newCredit)} / 원금상환 ${fmt(cr.principalRepaid)} / 이자 ${fmt(cr.interestPaid)}`,
    `연체 ${fmt(cr.missedPayments,0)} / 부도 ${fmt(cr.defaults,0)} / 상각 ${fmt(cr.chargeOffs)}`,
    `대출잔액 ${fmt(cr.outstandingLoans)}`,
    ''
  ];
  if (t) {
    out.push('[최근 신용 추론]');
    out.push(`차주 ${t.borrowerId} (${t.borrowerKind}) / 신청 ${fmt(t.requestedAmount)}`);
    out.push(`부채/소득 ${fmt(t.perception.debtToIncome,2)} / 유동성개월 ${fmt(t.perception.liquidityMonths,2)}`);
    out.push(`추정부도확률 ${pct(t.forecast.estimatedDefaultProbability)} / 예상 자본비율 ${pct(t.forecast.projectedCapitalRatio)}`);
    out.push(`제시 연금리 ${pct(t.forecast.annualRate)} / 상환부담 ${pct(t.forecast.paymentBurden)}`);
    out.push(...t.hypotheses.slice(0,3).map(x => `- ${x.name}: ${pct(x.confidence)}`));
    out.push(`[판단] ${t.selected} · ${t.reason}`);
  } else out.push('아직 신용판단 기록이 없습니다.');
  if (loan) {
    out.push('', '[표본 대출]');
    out.push(`${loan.id} · ${loan.borrowerId} · ${loan.status}`);
    out.push(`원금 ${fmt(loan.originalPrincipal)} / 잔액 ${fmt(loan.outstanding)} / 금리 ${pct(loan.annualRate)} / ${loan.termMonths}개월`);
  }
  return out.join('\n');
}

function formatMarkets(c) {
  const g = c.markets.goods;
  const l = c.markets.labor;
  const p = c.markets.payroll;
  const ac = c.markets.accrual || {};
  const settlement = c.accounting;
  const gl = c.generalAccounting;
  return [
    `${c.id} · ${c.name}`,
    '',
    '[노동·상품시장]',
    `채용 ${fmt(l.hires,0)} / 해고 ${fmt(l.layoffs,0)} / 미충원 ${fmt(l.unfilled,0)}`,
    `발생 임금 ${fmt(ac.accrued)} / 실제 급여 ${fmt(p.payroll)} / 지급 실패 ${fmt(p.unpaid)}`,
    `상품거래 ${fmt(g.transactions,0)}건 / 소비 ${fmt(g.nominalConsumption)} / 미충족 ${pct(c.macro.unmetDemandRatio)}`,
    '',
    '[Endogenous Money]',
    `기초 예금통화 ${fmt(settlement.openingMoney)}`,
    `누적 승인 통화변동 ${fmt(settlement.authorizedMoneyDelta)}`,
    `기대 통화량 ${fmt(settlement.expectedMoney)} / 실제 ${fmt(settlement.currentMoney)}`,
    `통화 대사오차 ${Number(settlement.moneyError || 0).toExponential(2)}`,
    '',
    '[Stock-Flow / Double Entry]',
    `판정: ${gl.ok ? 'PASS' : 'FAIL'}`,
    `은행 예금부채 ${fmt(gl.bankDeposits)} ↔ 고객예금 ${fmt(settlement.currentMoney)}`,
    `은행 대출자산 ${fmt(gl.bankLoans)} ↔ 차주 대출부채 ${fmt(gl.borrowerLoanLiabilities)}`,
    `예금 대사오차 ${Number(gl.depositReconciliationError || 0).toExponential(2)}`,
    `대출 대사오차 ${Number(gl.loanReconciliationError || 0).toExponential(2)}`,
    `최대 A=L+E 오차 ${Number(gl.maxEquationError || 0).toExponential(2)}`
  ].join('\n');
}

function formatStatement(title, id, statement) {
  const bs = statement.balanceSheet;
  const is = statement.incomeStatement;
  return [
    `[${title}] ${id}`,
    `자산 ${fmt(bs.assets)} / 부채 ${fmt(bs.liabilities)} / 자본 ${fmt(bs.equity)}`,
    `회계식 오차 ${Number(bs.equationError || 0).toExponential(2)}`,
    `당월 수익 ${fmt(is.revenue)} / 비용 ${fmt(is.expense)} / 순이익 ${fmt(is.netIncome)}`,
    '',
    ...Object.entries(bs.accounts).map(([k,v]) => `${k.padEnd(22,' ')} ${fmt(v,2)}`)
  ].join('\n');
}

function formatFinancials(c) {
  return [
    formatStatement('가계', c.sampleHousehold.id, c.sampleHouseholdFinancials),
    '', '────────────────────────', '',
    formatStatement('기업', c.sampleFirm.id, c.sampleFirmFinancials),
    '', '────────────────────────', '',
    formatStatement('은행', c.sampleBank.id, c.sampleBankFinancials)
  ].join('\n');
}

function formatJournals(c) {
  const renderJournal = j => {
    const lines = j.lines.map(line => {
      const dr = line.debit ? `DR ${fmt(line.debit,2)}` : '';
      const cr = line.credit ? `CR ${fmt(line.credit,2)}` : '';
      return `  ${line.account.padEnd(22,' ')} ${dr}${cr}`;
    });
    return `${j.id} · ${j.kind}\n${lines.join('\n')}`;
  };
  const household = (c.sampleHouseholdJournals || []).slice(-3).map(renderJournal);
  const firm = (c.sampleFirmJournals || []).slice(-4).map(renderJournal);
  const bank = (c.sampleBankJournals || []).slice(-5).map(renderJournal);
  return [
    `[가계] ${c.sampleHousehold.id}`,
    ...(household.length ? household : ['분개 없음']),
    '',
    `[기업] ${c.sampleFirm.id}`,
    ...(firm.length ? firm : ['분개 없음']),
    '',
    `[은행] ${c.sampleBank.id}`,
    ...(bank.length ? bank : ['분개 없음'])
  ].join('\n\n');
}

function formatTransactions(c) {
  const tx = c.recentTransactions || [];
  if (!tx.length) return '아직 실제 거래가 없습니다. +1개월을 눌러주세요.';
  return tx.slice().reverse().map(e => {
    const labels = {
      wage: '임금',
      goods_purchase: '상품구매',
      bank_loan_origination: '대출·예금창조',
      bank_loan_payment: '대출상환·예금소멸'
    };
    const changes = e.postings.map(p => `${p.accountId} ${p.delta >= 0 ? '+' : ''}${fmt(p.delta,2)}`).join('\n');
    return `${e.id}  ${labels[e.kind] || e.kind}\n${changes}\n금액 ${fmt(e.amount,2)} · 통화변동 ${fmt(e.monetaryDelta || 0,2)}`;
  }).join('\n\n');
}

document.getElementById('step1').addEventListener('click', () => { world.step(1); render(); });
document.getElementById('step12').addEventListener('click', () => { world.step(12); render(); });
document.getElementById('reset').addEventListener('click', () => { world = new EconomicWorld('ECON-4-001'); render(); });

render();
