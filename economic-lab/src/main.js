import { EconomicWorld } from './core/world.js';

let world = new EconomicWorld('ECON-4-001');
let selectedCountryId = 'AST';

const fmt = (n, digits = 1) => Number(n || 0).toLocaleString('ko-KR', { maximumFractionDigits: digits });
const pct = n => `${(Number(n || 0) * 100).toFixed(1)}%`;
const sci = n => Number(n || 0).toExponential(2);

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
        <div><small>민간소비 C</small><strong>${fmt(c.macro.consumption)}</strong></div>
        <div><small>민간투자</small><strong>${fmt(c.macro.grossInvestment)}</strong></div>
        <div><small>정부수요</small><strong>${fmt(c.macro.governmentDemand)}</strong></div>
        <div><small>공공부채</small><strong>${fmt(c.macro.publicDebt)}</strong></div>
        <div><small>예금통화</small><strong>${fmt(c.macro.moneySupply)}</strong></div>
      </div>
      <footer>활성기업 ${fmt(c.activeFirms,0)}/${fmt(c.firms,0)} · 은행 ${fmt(c.banks,0)} · 정부 ${fmt(c.governments,0)} · 국채 ${fmt(c.activeGovernmentBonds,0)} · SFC ${c.generalAccounting.ok && c.fiscalAccounting.accountingOk ? 'PASS' : 'FAIL'}</footer>
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
  document.getElementById('governmentTrace').textContent = formatGovernment(country);
  document.getElementById('fiscalTrace').textContent = formatFiscal(country);
  document.getElementById('industryTrace').textContent = formatIndustry(country);
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
    `고용: ${h.employed ? '고용' : '실업'} / 예금 ${fmt(h.wealth)} / 대출 ${fmt(h.loanBalance)}`,
    `임금 ${fmt(h.income)} - 소득세 ${fmt(h.incomeTaxPaid)} + 이전소득 ${fmt(h.transferIncome)} = 가처분소득 ${fmt(h.disposableIncome)}`,
    `실제소비 ${fmt(h.consumption)} / 임금미수 ${fmt(h.wageArrears)} / 신용미스 ${fmt(h.creditMisses,0)}`,
    '',
    '[관찰·인식]',
    `인지 물가상승 ${pct(t.perception.inflation)} / 인지 실직위험 ${pct(t.perception.jobRisk)}`,
    `예상 소득증가 ${pct(t.perception.expectedIncomeGrowth)}`,
    '',
    '[가설]',
    ...(t.hypotheses || []).map(x => `- ${x.name}: 확신 ${pct(x.confidence)}`),
    '',
    `[선택] ${t.selected}`,
    `이유: ${t.reason}`,
    '',
    '[최종재 구매]',
    ...(purchases.length ? purchases.map(x => `- ${x.firmId}: ${fmt(x.units,2)} × ${fmt(x.price,3)} = ${fmt(x.amount)}`) : ['- 체결 거래 없음'])
  ].join('\n');
}

function formatFirm(f) {
  const t = f.lastTrace;
  if (!t) return `${f.id}\n산업 ${f.industryId || '-'}\n아직 첫 판단 전입니다.`;
  const inputs = Object.entries(f.inputInventory || {}).map(([k,v]) => `${k} ${fmt(v,2)}`).join(' / ') || '직접 투입재 없음';
  return [
    `${f.id} · ${f.industryId} · ${f.industryName}`,
    `생산물 ${f.product} / ${f.active === false ? 'EXITED' : 'ACTIVE'}`,
    `가격 ${fmt(f.price,3)} / 근로자 ${fmt(f.workers,0)} / 예금 ${fmt(f.cash)} / 대출 ${fmt(f.loanBalance)}`,
    `생산 ${fmt(f.output,2)} / 완제품재고 ${fmt(f.inventory,2)} / 생산능력 ${fmt(f.capacity,2)}`,
    `투입재고 ${inputs} / 공급부족 ${fmt(f.supplyShortage,2)}`,
    `자본스톡 ${fmt(f.capitalStock,2)} / 투입재구매 ${fmt(f.inputSpend)} / 설비투자 ${fmt(f.investmentSpend)}`,
    `B2B매출 ${fmt(f.b2bRevenue)} / 소비재매출 ${fmt(f.consumerRevenue)} / 자본재매출 ${fmt(f.capitalRevenue)}`,
    '',
    '[반사실적 전략 비교]',
    ...(t.candidates || []).map(x => `- ${x.name}: 효용 ${fmt(x.utility,3)}`),
    '',
    `[선택] ${t.selected}`,
    `이유: ${t.reason}`
  ].join('\n');
}

function formatGovernment(c) {
  const g = c.sampleGovernment;
  const t = g?.lastTrace;
  if (!g) return '정부 Agent가 없습니다.';
  const out = [
    `${g.id} · ${g.name}`,
    `성장선호 ${fmt(g.growthPreference,2)} / 부채회피 ${fmt(g.debtAversion,2)} / 안정화강도 ${fmt(g.stabilizerStrength,2)}`,
    `모형불확실성 ${fmt(g.modelUncertainty,2)} / 낙관편향 ${fmt(g.optimism,2)}`,
    ''
  ];
  if (!t) {
    out.push('아직 첫 재정정책 판단 전입니다.');
    return out.join('\n');
  }
  out.push('[정부가 인식한 경제]');
  out.push(`실업률 ${pct(t.perception.unemployment)} / 물가상승 ${pct(t.perception.inflation)}`);
  out.push(`부채/GDP ${pct(t.perception.debtRatio)} / 직전 재정수지비율 ${pct(t.perception.priorBalanceRatio)}`);
  out.push('', '[정책 후보 비교]');
  out.push(...(t.candidates || []).map(x => `- ${x.name}: 효용 ${fmt(x.utility,3)}`));
  out.push('', `[선택] ${t.selected}`);
  out.push(`소득세 ${pct(t.policy.incomeTaxRate)} / 소비세 ${pct(t.policy.consumptionTaxRate)} / 법인세 ${pct(t.policy.corporateTaxRate)}`);
  out.push(`실업급여 대체율 ${pct(t.policy.benefitReplacementRate)}`);
  out.push(`정부소비 배수 ${fmt(t.policy.spendingMultiplier,2)} / 공공투자 배수 ${fmt(t.policy.investmentMultiplier,2)}`);
  out.push(`이유: ${t.reason}`);
  return out.join('\n');
}

function formatFiscal(c) {
  const f = c.fiscal || {};
  const bond = c.sampleGovernmentBond;
  const recent = c.recentFiscal || [];
  const out = [
    `${c.id} · 재정계정`,
    `정책기조: ${f.policyStance || '-'}`,
    '',
    '[조세]',
    `소득세 ${fmt(f.incomeTax)} / 소비세 ${fmt(f.consumptionTax)} / 법인세 ${fmt(f.corporateTax)}`,
    `총세수 ${fmt(f.taxRevenue)}`,
    '',
    '[지출]',
    `실업·사회이전 ${fmt(f.transfers)} (${fmt(f.transferRecipients,0)}명)` ,
    `정부 최종소비 ${fmt(f.governmentConsumption)} / 공공투자 ${fmt(f.publicInvestment)}`,
    `공공자본 장부가 ${fmt(f.publicCapital)}`,
    '',
    '[재정수지·부채]',
    `기초재정수지 ${fmt(f.primaryBalance)} / 종합재정수지 ${fmt(f.overallBalance)}`,
    `국채 신규발행 ${fmt(f.bondIssued)} / 원금상환 ${fmt(f.principalRepaid)} / 이자지급 ${fmt(f.interestPaid)}`,
    `국채잔액 ${fmt(f.outstandingDebt)} / 부채비율 ${pct(f.debtRatio)} / 국고예금 ${fmt(f.governmentCash)}`,
    `정부회계 ${f.accountingOk ? 'PASS' : 'FAIL'} · 국채대사 ${sci(f.bondReconciliationError)} · 은행증권대사 ${sci(f.securitiesReconciliationError)}`
  ];
  if (bond) {
    out.push('', '[표본 국채]');
    out.push(`${bond.id} · ${bond.status} · 발행월 ${bond.originatedMonth}`);
    out.push(`발행 ${fmt(bond.originalPrincipal)} / 잔액 ${fmt(bond.outstanding)} / 금리 ${pct(bond.annualRate)} / ${bond.termMonths}개월`);
  }
  out.push('', '[최근 재정 Settlement]');
  out.push(...(recent.length ? recent.slice().reverse().map(e => `- ${e.kind}: ${fmt(e.amount)} · 통화변동 ${fmt(e.monetaryDelta,2)}`) : ['- 이번 달 거래 없음']));
  return out.join('\n');
}

function formatIndustry(c) {
  const ind = c.industry || {};
  const sf = c.sectorFirms || {};
  const so = ind.sectorOutputs || {};
  const recent = c.recentB2B || [];
  return [
    `${c.id} · 산업·공급망`,
    '',
    '[산업 구조 / 활성기업]',
    `RESOURCE   ${fmt(sf.RESOURCE,0)}개 · 생산 ${fmt(so.RESOURCE,2)}`,
    `MATERIALS  ${fmt(sf.MATERIALS,0)}개 · 생산 ${fmt(so.MATERIALS,2)}`,
    `CAPITAL    ${fmt(sf.CAPITAL,0)}개 · 생산 ${fmt(so.CAPITAL,2)}`,
    `CONSUMER   ${fmt(sf.CONSUMER,0)}개 · 생산 ${fmt(so.CONSUMER,2)}`,
    '',
    '[기업 간 공급망]',
    `B2B ${fmt(ind.b2bTransactions,0)}건 / ${fmt(ind.b2bSpend)} · 물량 ${fmt(ind.b2bUnits,2)}`,
    `미충족 투입재 ${fmt(ind.inputShortageUnits,2)}`,
    `민간 설비투자 ${fmt(ind.investmentTransactions,0)}건 / ${fmt(ind.grossInvestment)}`,
    `퇴출 ${fmt(ind.exits,0)} / 진입 ${fmt(ind.entries,0)} / 활성 ${fmt(ind.activeFirms,0)}`,
    '',
    '[최근 B2B / 투자]',
    ...(recent.length ? recent.slice().reverse().map(e => `- ${e.kind}: ${e.meta?.buyerId || '?'} ← ${e.meta?.sellerId || '?'} · ${e.meta?.product || 'capital_good'} · ${fmt(e.amount)}`) : ['- 이번 달 체결 없음'])
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
    '',
    '[이번 달 민간신용]',
    `신청 ${fmt(cr.applications,0)} / 승인 ${fmt(cr.approved,0)} / 거절 ${fmt(cr.rejected,0)}`,
    `신규대출 ${fmt(cr.newCredit)} / 원금상환 ${fmt(cr.principalRepaid)} / 이자 ${fmt(cr.interestPaid)}`,
    `부도 ${fmt(cr.defaults,0)} / 상각 ${fmt(cr.chargeOffs)} / 대출잔액 ${fmt(cr.outstandingLoans)}`,
    ''
  ];
  if (t) {
    out.push('[최근 신용 추론]');
    out.push(`차주 ${t.borrowerId} (${t.borrowerKind}) / 신청 ${fmt(t.requestedAmount)}`);
    out.push(`추정부도확률 ${pct(t.forecast.estimatedDefaultProbability)} / 예상 자본비율 ${pct(t.forecast.projectedCapitalRatio)}`);
    out.push(`제시금리 ${pct(t.forecast.annualRate)} / 상환부담 ${pct(t.forecast.paymentBurden)}`);
    out.push(`[판단] ${t.selected} · ${t.reason}`);
  }
  if (loan) {
    out.push('', '[표본 민간대출]');
    out.push(`${loan.id} · ${loan.borrowerId} · ${loan.status}`);
    out.push(`원금 ${fmt(loan.originalPrincipal)} / 잔액 ${fmt(loan.outstanding)} / 금리 ${pct(loan.annualRate)}`);
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
  const fgdp = c.macro.consumption + c.macro.grossInvestment + c.macro.publicInvestment + c.macro.governmentConsumption + c.macro.inventoryInvestment;
  return [
    `${c.id} · ${c.name}`,
    '',
    '[노동·최종재시장]',
    `채용 ${fmt(l.hires,0)} / 해고 ${fmt(l.layoffs,0)} / 미충원 ${fmt(l.unfilled,0)}`,
    `발생 임금 ${fmt(ac.accrued)} / 실제 급여 ${fmt(p.payroll)} / 지급 실패 ${fmt(p.unpaid)}`,
    `가계 최종재 거래 ${fmt(g.transactions,0)}건 / 소비 ${fmt(g.nominalConsumption)} / 미충족 ${pct(c.macro.unmetDemandRatio)}`,
    '',
    '[GDP 지출접근]',
    `C ${fmt(c.macro.consumption)}`,
    `+ 민간 I ${fmt(c.macro.grossInvestment)}`,
    `+ 공공 I ${fmt(c.macro.publicInvestment)}`,
    `+ 정부소비 G ${fmt(c.macro.governmentConsumption)}`,
    `+ Δ재고 ${fmt(c.macro.inventoryInvestment)}`,
    `= ${fmt(fgdp)} / GDP ${fmt(c.macro.gdp)}`,
    '',
    '[Endogenous Money / SFC]',
    `기초예금 ${fmt(settlement.openingMoney)} + 승인통화변동 ${fmt(settlement.authorizedMoneyDelta)} = 기대 ${fmt(settlement.expectedMoney)}`,
    `실제 예금통화 ${fmt(settlement.currentMoney)} / 오차 ${sci(settlement.moneyError)}`,
    `은행예금부채 ${fmt(gl.bankDeposits)} ↔ 전체 Settlement 예금 ${fmt(settlement.currentMoney)}`,
    `은행대출자산 ${fmt(gl.bankLoans)} ↔ 민간 대출부채 ${fmt(gl.borrowerLoanLiabilities)}`,
    `예금대사 ${sci(gl.depositReconciliationError)} / 대출대사 ${sci(gl.loanReconciliationError)}`,
    `최대 A=L+E 오차 ${sci(gl.maxEquationError)}`,
    `통합 판정 ${c.macro.accountingBalanced ? 'PASS' : 'FAIL'}`
  ].join('\n');
}

function formatStatement(title, id, statement) {
  const bs = statement.balanceSheet;
  const is = statement.incomeStatement;
  return [
    `[${title}] ${id}`,
    `자산 ${fmt(bs.assets)} / 부채 ${fmt(bs.liabilities)} / 자본 ${fmt(bs.equity)} / 오차 ${sci(bs.equationError)}`,
    `당월 수익 ${fmt(is.revenue)} / 비용 ${fmt(is.expense)} / 순이익 ${fmt(is.netIncome)}`,
    ...Object.entries(bs.accounts).map(([k,v]) => `  ${k.padEnd(24,' ')} ${fmt(v,2)}`)
  ].join('\n');
}

function formatFinancials(c) {
  return [
    formatStatement('가계', c.sampleHousehold.id, c.sampleHouseholdFinancials),
    '', '────────────────────────', '',
    formatStatement('기업', c.sampleFirm.id, c.sampleFirmFinancials),
    '', '────────────────────────', '',
    formatStatement('은행', c.sampleBank.id, c.sampleBankFinancials),
    '', '────────────────────────', '',
    formatStatement('정부', c.sampleGovernment.id, c.sampleGovernmentFinancials)
  ].join('\n');
}

function formatJournals(c) {
  const renderJournal = j => {
    const lines = j.lines.map(line => `  ${line.account.padEnd(24,' ')} ${line.debit ? `DR ${fmt(line.debit,2)}` : `CR ${fmt(line.credit,2)}`}`);
    return `${j.id} · ${j.kind}\n${lines.join('\n')}`;
  };
  const blocks = [
    ['가계', c.sampleHousehold.id, c.sampleHouseholdJournals || []],
    ['기업', c.sampleFirm.id, c.sampleFirmJournals || []],
    ['은행', c.sampleBank.id, c.sampleBankJournals || []],
    ['정부', c.sampleGovernment.id, c.sampleGovernmentJournals || []]
  ];
  return blocks.map(([label,id,journals]) => `[` + label + `] ${id}\n` + (journals.length ? journals.slice(-5).map(renderJournal).join('\n\n') : '분개 없음')).join('\n\n────────────────────────\n\n');
}

function formatTransactions(c) {
  const tx = c.recentTransactions || [];
  if (!tx.length) return '아직 실제 거래가 없습니다.';
  const labels = {
    wage: '임금', goods_purchase: '가계 최종재', interfirm_purchase: '기업간 투입재', capital_investment: '민간 설비투자',
    bank_loan_origination: '민간대출·예금창조', bank_loan_payment: '민간대출상환·예금소멸',
    income_tax: '소득세', consumption_tax: '소비세', corporate_tax: '법인세', unemployment_transfer: '실업급여',
    government_consumption: '정부 최종소비', public_investment: '공공투자',
    government_bond_issue: '국채발행·국고예금창조', government_bond_payment: '국채원리금·예금소멸'
  };
  return tx.slice().reverse().map(e => {
    const changes = (e.postings || []).map(p => `${p.accountId} ${p.delta >= 0 ? '+' : ''}${fmt(p.delta,2)}`).join('\n');
    return `${e.id} · ${labels[e.kind] || e.kind}\n${changes}\n금액 ${fmt(e.amount,2)} · 통화변동 ${fmt(e.monetaryDelta,2)}`;
  }).join('\n\n');
}

document.getElementById('step1').addEventListener('click', () => { world.step(1); render(); });
document.getElementById('step12').addEventListener('click', () => { world.step(12); render(); });
document.getElementById('reset').addEventListener('click', () => { world = new EconomicWorld('ECON-4-001'); render(); });

render();