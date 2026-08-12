import { EconomicWorld as FiscalEconomicWorld } from './world.js';
import { CentralBankSystem } from '../monetary/central-bank-system.js';
import { AssetMarketSystem } from '../financial/asset-market.js';

export class EconomicWorld extends FiscalEconomicWorld {
  constructor(seedText = 'ECON-4-001') {
    super(seedText);
    this.monetary = new CentralBankSystem({ accounting: this.accounting, rng: this.rng });
    this.assetMarket = new AssetMarketSystem({ ledger: this.ledger, accounting: this.accounting, rng: this.rng });

    for (const country of this.countries) {
      this.monetary.initializeCountry(country);
      this.assetMarket.initializeCountry(country);
      this.refreshV07Macro(country);
      country.history[country.history.length - 1] = { month: this.month, ...country.macro };
    }
  }

  createEntrant(country, industryId) {
    const firm = super.createEntrant(country, industryId);
    if (this.assetMarket) this.assetMarket.registerFirm(firm);
    return firm;
  }

  stepCountry(country) {
    const prev = country.previousMacro;
    const prev2 = country.history.length > 1 ? country.history[country.history.length - 2] : prev;
    const inflation = prev2?.priceIndex ? prev.priceIndex / prev2.priceIndex - 1 : 0;
    const wageGrowth = prev2?.avgWage ? prev.avgWage / prev2.avgWage - 1 : 0;
    const demandGrowth = prev2?.nominalSales ? prev.nominalSales / prev2.nominalSales - 1 : 0;
    const signals = { inflation, wageGrowth, demandGrowth, unemployment: prev?.unemployment || 0 };

    this.monetary.beginMonth(country, this.month, signals);
    this.assetMarket.runMarket(country, this.month);
    this.syncBalances(country);

    super.stepCountry(country);

    this.monetary.manageLiquidity(country, this.month);
    this.rebaseLegacySecurities(country);
    this.accounting.gl.closeMonth(country.centralBanks[0].id, this.month);
    this.monetary.finalizeMonth(country);
    this.refreshV07Macro(country);
    country.history[country.history.length - 1] = { month: this.month, ...country.macro };
  }

  rebaseLegacySecurities(country) {
    const bank = country.banks[0];
    const government = country.governments[0];
    const bankSecurities = Math.max(0, this.accounting.gl.naturalBalance(bank.id, 'securities'));
    const publicDebt = this.fiscal.outstandingDebt(country);
    government.baselineBankSecurities = bankSecurities - publicDebt;
  }

  refreshV07Macro(country) {
    const monetary = country.lastMonetary || {};
    const asset = country.lastAssetMarket || {};
    country.macro = {
      ...country.macro,
      policyRate: Number(monetary.policyRate || 0),
      bankReserveRatio: Number(monetary.bankReserveRatio || 0),
      bankReserves: Number(monetary.reserves || 0),
      reserveTarget: Number(monetary.targetReserves || 0),
      centralBankLending: Number(monetary.outstandingFacilities || 0),
      openMarketPurchases: Number(monetary.openMarketPurchases || 0),
      openMarketSales: Number(monetary.openMarketSales || 0),
      monetaryAccountingBalanced: monetary.accountingOk === false ? 0 : 1,
      equityIndex: Number(asset.equityIndex || 100),
      equityIndexReturn: Number(asset.indexReturn || 0),
      equityMarketCap: Number(asset.marketCapitalization || 0),
      equityPrimaryIssuance: Number(asset.primaryIssuance || 0),
      equitySecondaryTurnover: Number(asset.secondaryTurnover || 0),
      householdEquityMarketValue: Number(asset.householdEquityMarketValue || 0),
      assetMarketAccountingBalanced: asset.accountingOk === false ? 0 : 1
    };
  }

  accountingReport(countryId) {
    const base = super.accountingReport(countryId);
    const country = this.countries.find(c => c.id === countryId);
    if (!country) return base;
    return {
      ...base,
      monetary: this.monetary.verifyCountry(country),
      assetMarket: this.assetMarket.verifyCountry(country),
      monetarySummary: { ...country.lastMonetary },
      assetMarketSummary: { ...country.lastAssetMarket }
    };
  }

  snapshot() {
    const base = super.snapshot();
    for (const snapCountry of base.countries) {
      const country = this.countries.find(c => c.id === snapCountry.id);
      const centralBank = country.centralBanks[0];
      snapCountry.monetary = structuredClone(country.lastMonetary);
      snapCountry.assetMarket = structuredClone(country.lastAssetMarket);
      snapCountry.monetaryAccounting = this.monetary.verifyCountry(country);
      snapCountry.assetMarketAccounting = this.assetMarket.verifyCountry(country);
      snapCountry.centralBanks = country.centralBanks.length;
      snapCountry.activeCentralBankFacilities = country.centralBankFacilities.filter(x => x.status === 'active').length;
      snapCountry.sampleCentralBank = structuredClone(centralBank);
      snapCountry.sampleCentralBankFinancials = this.accounting.entityStatement(centralBank.id, this.month);
      snapCountry.sampleCentralBankJournals = this.accounting.recentJournals(centralBank.id, 10);
      snapCountry.sampleCentralBankFacility = structuredClone(country.centralBankFacilities.find(x => x.status === 'active') || country.centralBankFacilities[0] || null);
      snapCountry.recentCentralBankOperations = structuredClone(country.centralBankOperations.slice(-14));
      snapCountry.assetMarketHistory = structuredClone(country.assetMarketHistory.slice());
      snapCountry.samplePortfolio = structuredClone(country.households.find(h => Object.keys(h.portfolio || {}).length)?.portfolio || {});
      snapCountry.recentFinancialTransactions = this.ledger.entriesFor({ month: this.month, countryId: country.id })
        .filter(e => e.kind === 'equity_subscription' || e.kind === 'equity_secondary_trade')
        .slice(-14);
    }
    return base;
  }
}
