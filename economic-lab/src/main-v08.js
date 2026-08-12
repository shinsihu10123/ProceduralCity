import { EconomicWorld } from './core/world-v08.js';

let world = new EconomicWorld('ECON-4-001');
let selectedCountryId = 'AST';

const fmt = (n, digits = 1) => Number(n || 0).toLocaleString('ko-KR', { maximumFractionDigits: digits });
const pct = n => `${(Number(n || 0) * 100).toFixed(1)}%`;
const signedPct = n => `${Number(n || 0) >= 0 ? '+' : ''}${(Number(n || 0) * 100).toFixed(2)}%`;
const sci = n => Number(n || 0).toExponential(2);
const line = (name, value) => `${name.padEnd(18, ' ')} ${value}`;

function render() {
  const snap = world.snapshot();
  document.getElementById('month').textContent = `${snap.month}개월`;
  renderCountryCards(snap);
  setupCountrySelect(snap);

  const c = snap.countries.find(x => x.id === selectedCountryId) || snap.countries[0];
  document.getElementById('householdTrace').textContent = formatHousehold(c.sampleHousehold);
  document.getElementById('firmTrace').textContent = formatFirm(c.sampleFirm);
  document.getElementById('centralBankTrace').textContent = formatCentralBank(c);
  document.getElementById('monetaryTrace').textContent = formatMonetary(c);
  document.getElementById('internationalTrace').textContent = formatInternational(c);
  document.getElementById('assetTrace').textContent = formatAssets(c);
  document.getElementById('bankTrace').textContent = formatBank(c);
  document.getElementById('governmentTrace').textContent = formatGovernment(c);
  document.getElementById('fiscalTrace').textContent = formatFiscal(c);
  document.getElementById('industryTrace').textContent = formatIndustry(c);
  document.getElementById('marketTrace').textContent = formatMacroAndAccounting(c);
  document.getElementById('financialTrace').textContent = formatFinancials(c);
  document.getElementById('journalTrace').textContent = formatJournals(c);
  document.getElementById('transactionTrace').textContent = formatTransactions(c);
}

function renderCountryCards(snap) {
  const root = document.getElementById('countries');
  root.innerHTML = snap.countries.map(c => {
    const intl = c.international || {};
    return `
      <article class="country-card ${c.id === selectedCountryId ? 'selected' : ''}" data-country="${c.id}">
        <div class="country-head"><span>${c.id}</span><h2>${c.name}</h2></div>
        <div class="metrics">
          <div><small>GDP</small><strong>${fmt(c.macro.gdp)}</strong></div>
          <div><small>실업률</small><strong>${pct(c.macro.unemployment)}</strong></div>
          <div><small>정책금리</small><strong>${pct(c.macro.policyRate)}</strong></div>
          <div><small>환율 / WXU</small><strong>${fmt(c.fx?.rate, 3)}</strong></div>
          <div><small>수출</small><strong>${fmt(intl.exportsWXU, 2)} WXU</strong></div>
          <div><small>수입</small><strong>${fmt(intl.importsWXU, 2)} WXU</strong></div>
          <div><small>경상수지</small><strong>${fmt(intl.currentAccountWXU, 2)} WXU</strong></div>
          <div><small>대외부채</small><strong>${fmt(intl.foreignDebtWXU, 2)} WXU</strong></div>
        </div>
        <footer>기업 ${fmt(c.activeFirms,0)} · 국내대출 ${fmt(c.activeLoans,0)} · 해외금융계약 ${fmt(c.activeForeignFundingContracts,0)} · 국제회계 ${c.internationalAccounting?.accountingOk ? 'PASS' : 'FAIL'}</footer>
      </article>`;
  }).join('');

  for (const el of root.querySelectorAll('[data-country]')) {
    el.addEventListener('click', () => {
      selectedCountryId = el.dataset.country;
      document.getElementById('countrySelect').value = selectedCountryId;
      render();
    });
  }
}

function setupCountrySelect(snap) {
  const select = document.getElementById('countrySelect');
  if (!select.options.length) {
    for (const c of snap.countries) select.add(new Option(`${c.id} · ${c.name}`, c.id));
    select.addEventListener('change', () => { selectedCountryId = select.value; render(); });
  }
  select.value = selectedCountryId;
}

function formatHousehold(h) {
  if (!h) return '가계 표본 없음';
  const t = h.lastTrace;
  const positions = Object.entries(h.portfolio || {}).slice(0, 5);
  return [
    `${h.id}`,
    line('고용', h.employed ? '고용' : '실업'),
    line('예금', fmt(h.wealth)),
    line('대출', fmt(h.loanBalance)),
    line('가처분소득', fmt(h.disposableIncome)),
    line('소비', fmt(h.consumption)),
    line('주식 평가액', fmt(h.portfolioMarketValue)),
    '',
    '[추론]',
    ...(t ? [
      `인지 물가 ${pct(t.perception?.inflation)} · 실직위험 ${pct(t.perception?.jobRisk)}`,
      `예상 소득증가 ${signedPct(t.perception?.expectedIncomeGrowth)}`,
      ...(t.hypotheses || []).slice(0, 3).map(x => `- ${x.name}: ${pct(x.confidence)}`),
      `선택: ${t.selected} · ${t.reason}`
    ] : ['아직 판단 기록 없음']),
    '',
    '[주식 보유]',
    ...(positions.length ? positions.map(([firmId, p]) => `- ${firmId}: ${fmt(p.shares,3)}주 / 장부 ${fmt(p.bookValue)}`) : ['- 없음'])
  ].join('\n');
}

function formatFirm(f) {
  if (!f) return '기업 표본 없음';
  const t = f.lastTrace;
  return [
    `${f.id} · ${f.industryId} · ${f.industryName}`,
    line('상품', f.product || '-'),
    line('상태', f.active === false ? 'EXITED' : 'ACTIVE'),
    line('가격', fmt(f.price, 3)),
    line('고용', `${fmt(f.workers,0)}명`),
    line('예금', fmt(f.cash)),
    line('대출', fmt(f.loanBalance)),
    line('생산', fmt(f.output,2)),
    line('재고', fmt(f.inventory,2)),
    line('국제매출', fmt(f.internationalRevenue)),
    line('국제구매', fmt(f.internationalPurchases)),
    '',
    '[전략 추론]',
    ...(t ? [
      ...(t.candidates || []).map(x => `- ${x.name}: 효용 ${fmt(x.utility,3)}`),
      `선택: ${t.selected} · ${t.reason}`
    ] : ['아직 판단 기록 없음'])
  ].join('\n');
}

function formatCentralBank(c) {
  const cb = c.sampleCentralBank;
  const t = cb?.lastTrace;
  if (!cb) return '중앙은행 없음';
  return [
    `${cb.id} · ${cb.name}`,
    line('정책금리', pct(cb.policyRate)),
    line('중립금리', pct(cb.neutralRate)),
    line('물가목표', pct(cb.inflationTarget)),
    line('모형불확실성', fmt(cb.modelUncertainty,2)),
    '', '[정책 추론]',
    ...(t ? [
      `인지 물가 ${pct(t.perception?.inflation)} · 실업 ${pct(t.perception?.unemployment)}`,
      `신용스트레스 ${fmt(t.perception?.creditStress,2)} · 은행스트레스 ${fmt(t.perception?.bankStress,2)}`,
      `자산가격 모멘텀 ${signedPct(t.perception?.assetMomentum)}`,
      ...(t.candidates || []).map(x => `- ${x.name}: 효용 ${fmt(x.utility,3)}`),
      `선택: ${t.selected} · ${t.reason}`
    ] : ['아직 판단 기록 없음'])
  ].join('\n');
}

function formatMonetary(c) {
  const m = c.monetary || {};
  return [
    `${c.id} · Monetary System`,
    line('정책기조', m.stance || '-'),
    line('정책금리', pct(m.policyRate)),
    line('준비금', fmt(m.reserves)),
    line('목표 준비금', fmt(m.targetReserves)),
    line('준비율', pct(m.bankReserveRatio)),
    line('목표 준비율', pct(m.reserveTargetRatio)),
    line('OMO 매입', fmt(m.openMarketPurchases)),
    line('OMO 매도', fmt(m.openMarketSales)),
    line('중앙은행 대출', fmt(m.centralBankLending)),
    line('대출잔액', fmt(m.outstandingFacilities)),
    '', '[회계대사]',
    `준비금 오차 ${sci(c.monetaryAccounting?.reserveReconciliationError)}`,
    `중앙은행대출 오차 ${sci(c.monetaryAccounting?.facilityReconciliationError)}`,
    `판정 ${c.monetaryAccounting?.accountingOk ? 'PASS' : 'FAIL'}`
  ].join('\n');
}

function formatInternational(c) {
  const i = c.international || {};
  const p = c.internationalPosition || {};
  const funding = c.foreignFundingTrace;
  const contract = c.sampleForeignFundingContract;
  const trades = c.recentInternationalTrades || [];
  const bilateral = c.bilateralExchangeRates || [];
  const g = c.globalInternational || {};

  return [
    `${c.id} · International Economy`,
    '', '[환율]',
    `${c.fx?.currency || c.id} / WXU = ${fmt(c.fx?.rate,4)}  (${signedPct(c.fx?.lastChange)})`,
    ...bilateral.map(x => `1 ${c.fx?.currency || c.id} = ${fmt(x.unitsOfOtherPerOneLocal,4)} ${x.currency}`),
    '', '[무역·국제수지]',
    line('수출', `${fmt(i.exportsWXU,2)} WXU`),
    line('수입', `${fmt(i.importsWXU,2)} WXU`),
    line('무역수지', `${fmt(i.tradeBalanceWXU,2)} WXU`),
    line('본원소득', `${fmt(i.netPrimaryIncomeWXU,2)} WXU`),
    line('경상수지', `${fmt(i.currentAccountWXU,2)} WXU`),
    line('금융계정 대응', `${fmt(i.financialAccountNetInflowWXU,2)} WXU`),
    line('관세율', pct(i.tariffRate)),
    line('관세수입', fmt(i.tariffRevenue)),
    '', '[대외 포지션]',
    line('결제채권', `${fmt(p.receivablesWXU,2)} WXU`),
    line('결제채무', `${fmt(p.payablesWXU,2)} WXU`),
    line('해외대출자산', `${fmt(p.foreignLoansWXU,2)} WXU`),
    line('해외차입', `${fmt(p.foreignBorrowingWXU,2)} WXU`),
    line('순대외자산', `${fmt(i.netForeignAssetsWXU,2)} WXU`),
    line('대외부채', `${fmt(i.foreignDebtWXU,2)} WXU`),
    line('대외스트레스', fmt(i.externalStress,3)),
    '', '[해외자금 추론]',
    ...(funding ? [
      `${funding.lenderCountryId} → ${funding.borrowerCountryId} / 신청 ${fmt(funding.requestedWXU,2)} WXU`,
      `추정부도확률 ${pct(funding.forecast?.estimatedDefaultProbability)} / 제시금리 ${pct(funding.forecast?.annualRate)}`,
      `판단: ${funding.selected} · ${funding.reason}`
    ] : ['- 아직 해외자금 판단 기록 없음']),
    ...(contract ? ['', '[표본 해외금융계약]', `${contract.id}: ${contract.lenderCountryId} → ${contract.borrowerCountryId}`, `잔액 ${fmt(contract.outstandingWXU,2)} WXU / 금리 ${pct(contract.annualRate)} / ${contract.status}`] : []),
    '', '[최근 국제거래]',
    ...(trades.length ? trades.slice().reverse().slice(0,8).map(t => `- ${t.exporterId} → ${t.importerId} · ${t.product} · ${fmt(t.units,2)} · ${fmt(t.worldValue,2)} WXU`) : ['- 이번 달 국제거래 없음']),
    '', '[세계 불변식]',
    `세계 X-M 오차 ${sci(g.tradeErrorWXU)} / CA합 ${sci(g.currentAccountErrorWXU)}`,
    `세계 NFA합 ${sci(g.nfaErrorWXU)} / 해외대출-차입 ${sci(g.fundingErrorWXU)}`,
    `판정 ${g.ok ? 'PASS' : 'FAIL'}`
  ].join('\n');
}

function formatAssets(c) {
  const a = c.assetMarket || {};
  return [
    `${c.id} · Equity Market`,
    line('주가지수', fmt(a.equityIndex,2)),
    line('월수익률', signedPct(a.indexReturn)),
    line('시가총액', fmt(a.marketCapitalization)),
    line('신주발행', fmt(a.primaryIssuance)),
    line('신주거래', fmt(a.primaryTransactions,0)),
    line('2차시장 거래액', fmt(a.secondaryTurnover)),
    line('2차시장 거래', fmt(a.secondaryTransactions,0)),
    line('가계 주식 장부', fmt(a.householdEquityBook)),
    line('가계 주식 평가', fmt(a.householdEquityMarketValue)),
    '', `주식 장부오차 ${sci(c.assetMarketAccounting?.equityBookError)} · 소유주식오차 ${sci(c.assetMarketAccounting?.shareOwnershipError)}`,
    `판정 ${c.assetMarketAccounting?.accountingOk ? 'PASS' : 'FAIL'}`
  ].join('\n');
}

function formatBank(c) {
  const b = c.sampleBank;
  const cr = c.credit || {};
  const t = b?.lastTrace;
  if (!b) return '은행 없음';
  return [
    `${b.id} · ${b.name}`,
    line('대출 기준금리', pct(b.baseAnnualRate)),
    line('대출마진', pct(b.loanMarkup)),
    line('최소자본비율', pct(b.minCapitalRatio)),
    '', '[국내 신용시장]',
    `신청 ${fmt(cr.applications,0)} / 승인 ${fmt(cr.approved,0)} / 거절 ${fmt(cr.rejected,0)}`,
    `신규대출 ${fmt(cr.newCredit)} / 대출잔액 ${fmt(cr.outstandingLoans)}`,
    `부도 ${fmt(cr.defaults,0)} / 상각 ${fmt(cr.chargeOffs)}`,
    '', '[최근 신용판단]',
    ...(t ? [
      `차주 ${t.borrowerId} · 신청 ${fmt(t.requestedAmount)}`,
      `부도확률 ${pct(t.forecast?.estimatedDefaultProbability)} · 금리 ${pct(t.forecast?.annualRate)}`,
      `판단: ${t.selected} · ${t.reason}`
    ] : ['- 없음'])
  ].join('\n');
}

function formatGovernment(c) {
  const g = c.sampleGovernment;
  const t = g?.lastTrace;
  if (!g) return '정부 없음';
  return [
    `${g.id} · ${g.name}`,
    line('성장선호', fmt(g.growthPreference,2)),
    line('부채회피', fmt(g.debtAversion,2)),
    '', '[재정정책 추론]',
    ...(t ? [
      `실업 ${pct(t.perception?.unemployment)} · 물가 ${pct(t.perception?.inflation)} · 부채/GDP ${pct(t.perception?.debtRatio)}`,
      ...(t.candidates || []).map(x => `- ${x.name}: 효용 ${fmt(x.utility,3)}`),
      `선택: ${t.selected} · ${t.reason}`
    ] : ['아직 판단 기록 없음'])
  ].join('\n');
}

function formatFiscal(c) {
  const f = c.fiscal || {};
  return [
    `${c.id} · Fiscal`,
    line('정책기조', f.policyStance || '-'),
    line('소득세', fmt(f.incomeTax)),
    line('소비세', fmt(f.consumptionTax)),
    line('법인세', fmt(f.corporateTax)),
    line('관세', fmt(c.international?.tariffRevenue)),
    line('이전지출', fmt(f.transfers)),
    line('정부소비', fmt(f.governmentConsumption)),
    line('공공투자', fmt(f.publicInvestment)),
    line('재정수지', fmt(f.overallBalance)),
    line('공공부채', fmt(f.outstandingDebt)),
    line('부채비율', pct(f.debtRatio)),
    '', `정부회계 ${f.accountingOk ? 'PASS' : 'FAIL'} · 국채대사 ${sci(f.bondReconciliationError)}`
  ].join('\n');
}

function formatIndustry(c) {
  const i = c.industry || {};
  const o = i.sectorOutputs || {};
  return [
    `${c.id} · Supply Chain`,
    `RESOURCE  ${fmt(o.RESOURCE,2)}`,
    `MATERIALS ${fmt(o.MATERIALS,2)}`,
    `CAPITAL   ${fmt(o.CAPITAL,2)}`,
    `CONSUMER  ${fmt(o.CONSUMER,2)}`,
    '',
    line('국내 B2B', fmt(i.b2bSpend)),
    line('투입재 부족', fmt(i.inputShortageUnits,2)),
    line('민간 설비투자', fmt(i.grossInvestment)),
    line('국제 중간재수입', fmt(c.international?.intermediateImportsLocal)),
    line('국제 자본재수입', fmt(c.international?.capitalImportsLocal)),
    line('기업 퇴출/진입', `${fmt(i.exits,0)} / ${fmt(i.entries,0)}`)
  ].join('\n');
}

function formatMacroAndAccounting(c) {
  const m = c.macro;
  const a = c.accounting || {};
  const g = c.generalAccounting || {};
  return [
    `${c.id} · Open-Economy Macro`,
    '', '[GDP 지출접근]',
    `C ${fmt(m.consumption)}`,
    `+ I민간 ${fmt(m.grossInvestment)}`,
    `+ I공공 ${fmt(m.publicInvestment)}`,
    `+ G ${fmt(m.governmentConsumption)}`,
    `+ Δ재고 ${fmt(m.inventoryInvestment)}`,
    `+ X ${fmt(m.exports)} - M ${fmt(m.imports)}`,
    `= GDP ${fmt(m.gdp)}`,
    '', '[국내 SFC]',
    `예금통화 ${fmt(m.moneySupply)} / 통화오차 ${sci(a.moneyError)}`,
    `은행예금 ${fmt(g.bankDeposits)} / 은행대출 ${fmt(g.bankLoans)}`,
    `예금대사 ${sci(g.depositReconciliationError)} / 대출대사 ${sci(g.loanReconciliationError)}`,
    `A=L+E 최대오차 ${sci(g.maxEquationError)}`,
    '', '[국제 SFC]',
    `대외채권 장부오차 ${sci(c.internationalAccounting?.receivableBookError)}`,
    `대외채무 장부오차 ${sci(c.internationalAccounting?.payableBookError)}`,
    `해외대출 장부오차 ${sci(c.internationalAccounting?.foreignLoanBookError)}`,
    `해외차입 장부오차 ${sci(c.internationalAccounting?.foreignBorrowingBookError)}`,
    `종합판정 ${g.ok && c.fiscalAccounting?.accountingOk && c.monetaryAccounting?.accountingOk && c.assetMarketAccounting?.accountingOk && c.internationalAccounting?.accountingOk ? 'PASS' : 'FAIL'}`
  ].join('\n');
}

function statement(label, s) {
  const bs = s?.balanceSheet || { assets: 0, liabilities: 0, equity: 0 };
  const inc = s?.incomeStatement || { revenue: 0, expense: 0, netIncome: 0 };
  return `${label}\n자산 ${fmt(bs.assets)} / 부채 ${fmt(bs.liabilities)} / 자본 ${fmt(bs.equity)}\n수익 ${fmt(inc.revenue)} / 비용 ${fmt(inc.expense)} / 순이익 ${fmt(inc.netIncome)}\n검증 ${s?.verification?.ok ? 'PASS' : 'FAIL'}`;
}

function formatFinancials(c) {
  return [
    statement(`[가계] ${c.sampleHousehold?.id}`, c.sampleHouseholdFinancials),
    '', '────────────────────────', '',
    statement(`[기업] ${c.sampleFirm?.id}`, c.sampleFirmFinancials),
    '', '────────────────────────', '',
    statement(`[은행] ${c.sampleBank?.id}`, c.sampleBankFinancials),
    '', '────────────────────────', '',
    statement(`[중앙은행] ${c.sampleCentralBank?.id}`, c.sampleCentralBankFinancials),
    '', '────────────────────────', '',
    statement(`[정부] ${c.sampleGovernment?.id}`, c.sampleGovernmentFinancials)
  ].join('\n');
}

function formatJournals(c) {
  const groups = [
    ['가계', c.sampleHouseholdJournals],
    ['기업', c.sampleFirmJournals],
    ['은행', c.sampleBankJournals],
    ['중앙은행', c.sampleCentralBankJournals],
    ['정부', c.sampleGovernmentJournals]
  ];
  return groups.map(([label, journals]) => {
    const latest = (journals || []).slice(-2);
    return `[${label}]\n${latest.length ? latest.map(j => `${j.kind}\n${j.lines.map(x => `  ${x.account}: ${x.debit ? `DR ${fmt(x.debit,2)}` : `CR ${fmt(x.credit,2)}`}`).join('\n')}`).join('\n\n') : '분개 없음'}`;
  }).join('\n\n────────────────────────\n\n');
}

function formatTransactions(c) {
  const tx = c.recentTransactions || [];
  const intl = c.recentInternationalTrades || [];
  const domestic = tx.slice().reverse().slice(0, 10).map(e => `${e.kind}: ${fmt(e.amount,2)} / 통화변동 ${fmt(e.monetaryDelta,2)}`);
  const foreign = intl.slice().reverse().slice(0, 8).map(t => `INTL ${t.exporterId} → ${t.importerId}: ${t.product} ${fmt(t.units,2)} / ${fmt(t.worldValue,2)} WXU`);
  return [
    '[국내 Settlement]',
    ...(domestic.length ? domestic : ['- 없음']),
    '', '[국제 Settlement]',
    ...(foreign.length ? foreign : ['- 없음'])
  ].join('\n');
}

document.getElementById('step1').addEventListener('click', () => { world.step(1); render(); });
document.getElementById('step12').addEventListener('click', () => { world.step(12); render(); });
document.getElementById('reset').addEventListener('click', () => { world = new EconomicWorld('ECON-4-001'); render(); });

render();
