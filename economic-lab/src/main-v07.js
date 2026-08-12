import { EconomicWorld } from './core/world-v07.js';

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
        <div><small>정책금리</small><strong>${pct(c.macro.policyRate)}</strong></div>
        <div><small>은행 준비율</small><strong>${pct(c.macro.bankReserveRatio)}</strong></div>
        <div><small>주가지수</small><strong>${fmt(c.macro.equityIndex, 2)}</strong></div>
        <div><small>공공부채</small><strong>${fmt(c.macro.publicDebt)}</strong></div>
        <div><small>예금통화</small><strong>${fmt(c.macro.moneySupply)}</strong></div>
      </div>
      <footer>기업 ${fmt(c.activeFirms,0)} · 은행 ${fmt(c.banks,0)} · 중앙은행 ${fmt(c.centralBanks,0)} · 정부 ${fmt(c.governments,0)} · 회계 ${allPass(c) ? 'PASS' : 'FAIL'}</footer>
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
    select.addEventListener('change', () => { selectedCountryId = select.value; render(); });
  }
  select.value = selectedCountryId;

  const c = snap.countries.find(x => x.id === selectedCountryId) || snap.countries[0];
  set('householdTrace', formatHousehold(c));
  set('firmTrace', formatFirm(c));
  set('centralBankTrace', formatCentralBank(c));
  set('monetaryTrace', formatMonetary(c));
  set('assetTrace', formatAssetMarket(c));
  set('bankTrace', formatBank(c));
  set('governmentTrace', formatGovernment(c));
  set('fiscalTrace', formatFiscal(c));
  set('industryTrace', formatIndustry(c));
  set('marketTrace', formatMarkets(c));
  set('financialTrace', formatFinancials(c));
  set('journalTrace', formatJournals(c));
  set('transactionTrace', formatTransactions(c));
}

function allPass(c) {
  return c.generalAccounting?.ok && c.fiscalAccounting?.accountingOk && c.monetaryAccounting?.accountingOk && c.assetMarketAccounting?.accountingOk;
}

function set(id, text) { document.getElementById(id).textContent = text; }

function formatHousehold(c) {
  const h = c.sampleHousehold;
  const t = h.lastTrace;
  const portfolio = Object.entries(h.portfolio || {});
  return [
    h.id,
    `고용 ${h.employed ? '고용' : '실업'} · 예금 ${fmt(h.wealth)} · 주식시장가치 ${fmt(h.portfolioMarketValue)} · 순자산 ${fmt(h.netWorth)}`,
    `대출 ${fmt(h.loanBalance)} · 가처분소득 ${fmt(h.disposableIncome)} · 소비 ${fmt(h.consumption)}`,
    '',
    t ? `[판단] ${t.selected} · ${t.reason}` : '아직 판단 전',
    ...(t ? [
      `인지 물가 ${pct(t.perception.inflation)} · 실직위험 ${pct(t.perception.jobRisk)} · 예상소득증가 ${pct(t.perception.expectedIncomeGrowth)}`,
      ...(t.hypotheses || []).map(x => `- ${x.name}: ${pct(x.confidence)}`)
    ] : []),
    '',
    '[보유 주식]',
    ...(portfolio.length ? portfolio.slice(0, 8).map(([firmId, p]) => `- ${firmId}: ${fmt(p.shares,3)}주 · 장부 ${fmt(p.bookValue)}`) : ['- 없음'])
  ].join('\n');
}

function formatFirm(c) {
  const f = c.sampleFirm;
  const t = f.lastTrace;
  const e = f.equityMarket || {};
  return [
    `${f.id} · ${f.industryId} · ${f.industryName}`,
    `가격 ${fmt(f.price,3)} · 근로자 ${fmt(f.workers,0)} · 예금 ${fmt(f.cash)} · 대출 ${fmt(f.loanBalance)}`,
    `생산 ${fmt(f.output,2)} · 재고 ${fmt(f.inventory,2)} · 자본스톡 ${fmt(f.capitalStock,2)}`,
    `주가 ${fmt(e.sharePrice,4)} · 월수익률 ${pct(e.lastReturn)} · 시가총액 ${fmt(e.marketCap)} · 공개주식 ${fmt(e.publicShares,3)}`,
    '',
    t ? `[전략] ${t.selected} · ${t.reason}` : '아직 전략 판단 전',
    ...(t?.candidates || []).map(x => `- ${x.name}: 효용 ${fmt(x.utility,3)}`)
  ].join('\n');
}

function formatCentralBank(c) {
  const cb = c.sampleCentralBank;
  const t = cb?.lastTrace;
  if (!cb) return '중앙은행이 없습니다.';
  const out = [
    `${cb.id} · ${cb.name}`,
    `정책금리 ${pct(cb.policyRate)} · 중립금리 ${pct(cb.neutralRate)} · 물가목표 ${pct(cb.inflationTarget)}`,
    `인플레 반응 ${fmt(cb.inflationResponse,2)} · 실업 반응 ${fmt(cb.unemploymentResponse,2)} · 금융안정가중치 ${fmt(cb.financialStabilityWeight,2)}`,
    `모형불확실성 ${fmt(cb.modelUncertainty,2)}`,
    ''
  ];
  if (!t) return [...out, '아직 첫 통화정책 판단 전입니다.'].join('\n');
  out.push('[중앙은행이 인식한 경제]');
  out.push(`물가 ${pct(t.perception.inflation)} · 실업 ${pct(t.perception.unemployment)} · 신용스트레스 ${fmt(t.perception.creditStress,3)} · 은행스트레스 ${fmt(t.perception.bankStress,3)}`);
  out.push(`자산가격 모멘텀 ${pct(t.perception.assetMomentum)}`);
  out.push('', '[정책 후보]');
  out.push(...(t.candidates || []).map(x => `- ${x.name}: 효용 ${fmt(x.utility,3)}`));
  out.push('', `[선택] ${t.selected}`);
  out.push(`목표금리 ${pct(t.forecast.desiredRate)} → 실제 정책금리 ${pct(t.forecast.policyRate)}`);
  out.push(`이유: ${t.reason}`);
  return out.join('\n');
}

function formatMonetary(c) {
  const m = c.monetary || {};
  const facility = c.sampleCentralBankFacility;
  const ops = c.recentCentralBankOperations || [];
  return [
    `${c.id} · Monetary / Reserve System`,
    `기조 ${m.stance || '-'} · 정책금리 ${pct(m.policyRate)}`,
    `은행준비금 ${fmt(m.reserves)} · 목표준비금 ${fmt(m.targetReserves)} · 실제준비율 ${pct(m.bankReserveRatio)} · 목표 ${pct(m.reserveTargetRatio)}`,
    `공개시장 매입 ${fmt(m.openMarketPurchases)} · 매도 ${fmt(m.openMarketSales)}`,
    `당월 중앙은행대출 ${fmt(m.centralBankLending)} · 대출잔액 ${fmt(m.outstandingFacilities)}`,
    `시설원금상환 ${fmt(m.facilityPrincipalRepaid)} · 시설이자 ${fmt(m.facilityInterestPaid)}`,
    `중앙은행 보유 시장증권 ${fmt(m.centralBankSecurities)}`,
    '',
    `[회계] ${m.accountingOk ? 'PASS' : 'FAIL'} · 준비금대사 ${sci(m.reserveReconciliationError)} · 시설대사 ${sci(m.facilityReconciliationError)}`,
    ...(facility ? ['', '[표본 중앙은행 대출]', `${facility.id} · ${facility.status} · 잔액 ${fmt(facility.outstanding)} · 금리 ${pct(facility.annualRate)}`] : []),
    '',
    '[최근 중앙은행 Operation]',
    ...(ops.length ? ops.slice().reverse().map(x => `- M${x.month} ${x.kind}: ${fmt(x.amount)}`) : ['- 준비금이 충분해 개입 없음'])
  ].join('\n');
}

function formatAssetMarket(c) {
  const a = c.assetMarket || {};
  const tx = c.recentFinancialTransactions || [];
  const portfolio = Object.entries(c.samplePortfolio || {});
  return [
    `${c.id} · Equity Market`,
    `주가지수 ${fmt(a.equityIndex,2)} · 월수익률 ${pct(a.indexReturn)} · 시가총액 ${fmt(a.marketCapitalization)}`,
    `신주발행 ${fmt(a.primaryIssuance)} (${fmt(a.primaryTransactions,0)}건)` ,
    `2차시장 거래 ${fmt(a.secondaryTurnover)} (${fmt(a.secondaryTransactions,0)}건)`,
    `가계 주식 장부가 ${fmt(a.householdEquityBook)} · 시장가치 ${fmt(a.householdEquityMarketValue)}`,
    `금융자산 부효과 ${pct(a.financialWealthEffect)}`,
    `[회계] ${a.accountingOk ? 'PASS' : 'FAIL'} · 장부대사 ${sci(a.equityBookError)} · 주식수대사 ${sci(a.shareOwnershipError)}`,
    '',
    '[표본 포트폴리오]',
    ...(portfolio.length ? portfolio.slice(0, 8).map(([id,p]) => `- ${id}: ${fmt(p.shares,3)}주 · 원가 ${fmt(p.bookValue)}`) : ['- 아직 공개주식 보유 없음']),
    '',
    '[이번 달 금융거래]',
    ...(tx.length ? tx.slice().reverse().map(e => `- ${e.kind}: ${fmt(e.amount)} · ${e.meta?.firmId || ''}`) : ['- 이번 달 없음'])
  ].join('\n');
}

function formatBank(c) {
  const b = c.sampleBank;
  const t = b?.lastTrace;
  const cr = c.credit || {};
  return [
    `${b.id} · ${b.name}`,
    `정책금리 ${pct(b.policyRate)} → 은행 기준조달금리 ${pct(b.baseAnnualRate)} → 대출마진 ${pct(b.loanMarkup)}`,
    `민간대출잔액 ${fmt(cr.outstandingLoans)} · 신규대출 ${fmt(cr.newCredit)} · 상각 ${fmt(cr.chargeOffs)}`,
    `신청 ${fmt(cr.applications,0)} · 승인 ${fmt(cr.approved,0)} · 거절 ${fmt(cr.rejected,0)}`,
    '',
    t ? `[최근 신용판단] ${t.selected} · ${t.reason}` : '신용판단 기록 없음',
    ...(t ? [`차주 ${t.borrowerId} · 부도확률 ${pct(t.forecast.estimatedDefaultProbability)} · 제시금리 ${pct(t.forecast.annualRate)}`] : [])
  ].join('\n');
}

function formatGovernment(c) {
  const g = c.sampleGovernment;
  const t = g?.lastTrace;
  return [
    `${g.id} · ${g.name}`,
    `성장선호 ${fmt(g.growthPreference,2)} · 부채회피 ${fmt(g.debtAversion,2)} · 안정화강도 ${fmt(g.stabilizerStrength,2)}`,
    '',
    t ? `[재정기조] ${t.selected} · ${t.reason}` : '아직 재정판단 전',
    ...(t ? [`소득세 ${pct(t.policy.incomeTaxRate)} · 소비세 ${pct(t.policy.consumptionTaxRate)} · 법인세 ${pct(t.policy.corporateTaxRate)}`] : [])
  ].join('\n');
}

function formatFiscal(c) {
  const f = c.fiscal || {};
  return [
    `${c.id} · Fiscal`,
    `총세수 ${fmt(f.taxRevenue)} · 이전지출 ${fmt(f.transfers)} · 정부소비 ${fmt(f.governmentConsumption)} · 공공투자 ${fmt(f.publicInvestment)}`,
    `기초수지 ${fmt(f.primaryBalance)} · 전체수지 ${fmt(f.overallBalance)}`,
    `공공부채 ${fmt(f.outstandingDebt)} · 부채비율 ${pct(f.debtRatio)} · 국고예금 ${fmt(f.governmentCash)}`,
    `국채발행 ${fmt(f.bondIssued)} · 원금상환 ${fmt(f.principalRepaid)} · 이자 ${fmt(f.interestPaid)}`,
    `[회계] ${f.accountingOk ? 'PASS' : 'FAIL'} · 국채 ${sci(f.bondReconciliationError)} · 증권 ${sci(f.securitiesReconciliationError)}`
  ].join('\n');
}

function formatIndustry(c) {
  const i = c.industry || {};
  const o = i.sectorOutputs || {};
  return [
    `${c.id} · Supply Chain`,
    `RESOURCE ${fmt(o.RESOURCE,2)} · MATERIALS ${fmt(o.MATERIALS,2)} · CAPITAL ${fmt(o.CAPITAL,2)} · CONSUMER ${fmt(o.CONSUMER,2)}`,
    `B2B ${fmt(i.b2bSpend)} / ${fmt(i.b2bTransactions,0)}건 · 투입재부족 ${fmt(i.inputShortageUnits,2)}`,
    `민간설비투자 ${fmt(i.grossInvestment)} · 퇴출 ${fmt(i.exits,0)} · 진입 ${fmt(i.entries,0)}`
  ].join('\n');
}

function formatMarkets(c) {
  const g = c.markets.goods || {};
  const l = c.markets.labor || {};
  const gl = c.generalAccounting || {};
  const s = c.accounting || {};
  return [
    `${c.id} · Macro / SFC`,
    `GDP = C ${fmt(c.macro.consumption)} + I민간 ${fmt(c.macro.grossInvestment)} + I공공 ${fmt(c.macro.publicInvestment)} + G ${fmt(c.macro.governmentConsumption)} + Δ재고 ${fmt(c.macro.inventoryInvestment)} = ${fmt(c.macro.gdp)}`,
    `실업률 ${pct(c.macro.unemployment)} · 채용 ${fmt(l.hires,0)} · 해고 ${fmt(l.layoffs,0)} · 최종재거래 ${fmt(g.transactions,0)}`,
    `예금통화 ${fmt(s.currentMoney)} · 승인 통화변동 ${fmt(s.authorizedMoneyDelta)} · 통화오차 ${sci(s.moneyError)}`,
    `은행예금부채 ${fmt(gl.bankDeposits)} ↔ 예금 ${fmt(s.currentMoney)} · 오차 ${sci(gl.depositReconciliationError)}`,
    `은행대출 ${fmt(gl.bankLoans)} ↔ 차주부채 ${fmt(gl.borrowerLoanLiabilities)} · 오차 ${sci(gl.loanReconciliationError)}`,
    `A=L+E 최대오차 ${sci(gl.maxEquationError)}`
  ].join('\n');
}

function statement(title, id, s) {
  const b = s.balanceSheet;
  const i = s.incomeStatement;
  return `[${title}] ${id}\n자산 ${fmt(b.assets)} / 부채 ${fmt(b.liabilities)} / 자본 ${fmt(b.equity)} / 오차 ${sci(b.equationError)}\n당월 수익 ${fmt(i.revenue)} / 비용 ${fmt(i.expense)} / 순이익 ${fmt(i.netIncome)}`;
}

function formatFinancials(c) {
  return [
    statement('가계', c.sampleHousehold.id, c.sampleHouseholdFinancials),
    '', statement('기업', c.sampleFirm.id, c.sampleFirmFinancials),
    '', statement('은행', c.sampleBank.id, c.sampleBankFinancials),
    '', statement('중앙은행', c.sampleCentralBank.id, c.sampleCentralBankFinancials),
    '', statement('정부', c.sampleGovernment.id, c.sampleGovernmentFinancials)
  ].join('\n');
}

function formatJournals(c) {
  const show = (title, js) => [title, ...(js || []).slice(-4).map(j => `${j.id} ${j.kind}\n${j.lines.map(x => `  ${x.account} ${x.debit ? `DR ${fmt(x.debit,2)}` : `CR ${fmt(x.credit,2)}`}`).join('\n')}`)].join('\n\n');
  return [
    show(`[가계] ${c.sampleHousehold.id}`, c.sampleHouseholdJournals),
    show(`[기업] ${c.sampleFirm.id}`, c.sampleFirmJournals),
    show(`[은행] ${c.sampleBank.id}`, c.sampleBankJournals),
    show(`[중앙은행] ${c.sampleCentralBank.id}`, c.sampleCentralBankJournals),
    show(`[정부] ${c.sampleGovernment.id}`, c.sampleGovernmentJournals)
  ].join('\n\n────────────────────────\n\n');
}

function formatTransactions(c) {
  const labels = {
    wage: '임금', goods_purchase: '최종재', interfirm_purchase: '기업간 투입재', capital_investment: '민간설비투자',
    bank_loan_origination: '은행대출', bank_loan_payment: '은행대출상환', income_tax: '소득세', consumption_tax: '소비세',
    corporate_tax: '법인세', unemployment_transfer: '실업급여', government_consumption: '정부소비', public_investment: '공공투자',
    government_bond_issue: '국채발행', government_bond_payment: '국채상환', equity_subscription: '신주인수', equity_secondary_trade: '주식2차거래'
  };
  const tx = c.recentTransactions || [];
  return tx.length ? tx.slice().reverse().map(e => `${e.id} · ${labels[e.kind] || e.kind}\n금액 ${fmt(e.amount)} · 통화변동 ${fmt(e.monetaryDelta || 0)}`).join('\n\n') : '이번 달 실제 Settlement 없음';
}

document.getElementById('step1').addEventListener('click', () => { world.step(1); render(); });
document.getElementById('step12').addEventListener('click', () => { world.step(12); render(); });
document.getElementById('reset').addEventListener('click', () => { world = new EconomicWorld('ECON-4-001'); render(); });

render();
