import { EconomicWorld as MonetaryFinancialWorld } from './world-v07.js';
import { InternationalEconomySystem } from '../international/international-economy.js';

export class EconomicWorld extends MonetaryFinancialWorld {
  constructor(seedText = 'ECON-4-001') {
    super(seedText);
    this.international = new InternationalEconomySystem({ ledger: this.ledger, accounting: this.accounting, rng: this.rng });
    this.international.initializeWorld(this.countries);
    for (const country of this.countries) {
      this.refreshV08Macro(country);
      country.history[country.history.length - 1] = { month: this.month, ...country.macro };
    }
  }

  stepMonth() {
    this.month += 1;

    // International orders are matched before the domestic production cycle.
    // Imported intermediate inputs therefore arrive with a one-month planning/shipping lag
    // and can be used by the current domestic production round.
    this.international.beginMonth(this.countries, this.month);

    for (const country of this.countries) super.stepCountry(country);

    for (const country of this.countries) {
      for (const f of country.firms) {
        if ((f.internationalSalesUnits || 0) > 0) {
          // Exports contribute to the next period's observed demand anchor without rewriting
          // the already-recorded domestic market-clearing result.
          f.previousSales = Math.max(0.01, Number(f.previousSales || 0) + Number(f.internationalSalesUnits || 0));
        }
      }
      this.refreshV08Macro(country);
      country.history[country.history.length - 1] = { month: this.month, ...country.macro };
    }
  }

  refreshV08Macro(country) {
    const intl = country.lastInternational || {};
    const importConsumption = Number(intl.consumerImportsLocal || 0);
    const importCapital = Number(intl.capitalImportsLocal || 0);
    const exportsLocal = Number(intl.exportsLocal || 0);
    const importsLocal = Number(intl.importsLocal || 0);
    const consumption = Number(country.macro?.consumption || 0) + importConsumption;
    const grossInvestment = Number(country.macro?.grossInvestment || 0) + importCapital;
    const netExports = exportsLocal - importsLocal;
    const gdp = Number(country.macro?.gdp || 0) + importConsumption + importCapital + netExports;

    country.macro = {
      ...country.macro,
      gdp,
      consumption,
      grossInvestment,
      exports: exportsLocal,
      imports: importsLocal,
      netExports,
      tradeBalance: netExports,
      exportsWXU: Number(intl.exportsWXU || 0),
      importsWXU: Number(intl.importsWXU || 0),
      currentAccountWXU: Number(intl.currentAccountWXU || 0),
      currentAccount: Number(intl.currentAccountWXU || 0) * Number(country.fx?.rate || 1),
      financialAccountNetInflowWXU: Number(intl.financialAccountNetInflowWXU || 0),
      formalForeignFundingInflowWXU: Number(intl.formalFundingInflowWXU || 0),
      formalForeignFundingOutflowWXU: Number(intl.formalFundingOutflowWXU || 0),
      foreignDebtWXU: Number(intl.foreignDebtWXU || 0),
      foreignDebt: Number(intl.foreignDebtWXU || 0) * Number(country.fx?.rate || 1),
      netForeignAssetsWXU: Number(intl.netForeignAssetsWXU || 0),
      netForeignAssets: Number(intl.netForeignAssetsWXU || 0) * Number(country.fx?.rate || 1),
      exchangeRate: Number(country.fx?.rate || 1),
      exchangeRateChange: Number(country.fx?.lastChange || 0),
      tariffRate: Number(country.tradePolicy?.tariffRate || 0),
      tariffRevenue: Number(intl.tariffRevenue || 0),
      taxRevenue: Number(country.macro?.taxRevenue || 0) + Number(intl.tariffRevenue || 0),
      internationalTradeTransactions: Number(intl.tradeTransactions || 0),
      externalStress: Number(intl.externalStress || 0),
      nominalSales: Number(country.macro?.nominalSales || 0) + exportsLocal,
      internationalAccountingBalanced: intl.accountingOk === false ? 0 : 1
    };
  }

  accountingReport(countryId) {
    const base = super.accountingReport(countryId);
    const country = this.countries.find(c => c.id === countryId);
    if (!country) return base;
    return {
      ...base,
      international: this.international.verifyCountry(country, this.countries),
      internationalSummary: { ...country.lastInternational },
      globalInternational: this.globalInternationalReport()
    };
  }

  globalInternationalReport() {
    const exportsWXU = this.countries.reduce((s, c) => s + Number(c.lastInternational?.exportsWXU || 0), 0);
    const importsWXU = this.countries.reduce((s, c) => s + Number(c.lastInternational?.importsWXU || 0), 0);
    const currentAccountWXU = this.countries.reduce((s, c) => s + Number(c.lastInternational?.currentAccountWXU || 0), 0);
    const netForeignAssetsWXU = this.countries.reduce((s, c) => s + this.international.netForeignAssetsWXU(c), 0);
    const foreignLoansWXU = this.countries.reduce((s, c) => s + Number(c.internationalPosition?.foreignLoansWXU || 0), 0);
    const foreignBorrowingWXU = this.countries.reduce((s, c) => s + Number(c.internationalPosition?.foreignBorrowingWXU || 0), 0);
    return {
      exportsWXU,
      importsWXU,
      currentAccountWXU,
      netForeignAssetsWXU,
      foreignLoansWXU,
      foreignBorrowingWXU,
      tradeErrorWXU: exportsWXU - importsWXU,
      currentAccountErrorWXU: currentAccountWXU,
      nfaErrorWXU: netForeignAssetsWXU,
      fundingErrorWXU: foreignLoansWXU - foreignBorrowingWXU,
      ok:
        Math.abs(exportsWXU - importsWXU) < 1e-6 &&
        Math.abs(currentAccountWXU) < 1e-6 &&
        Math.abs(netForeignAssetsWXU) < 1e-6 &&
        Math.abs(foreignLoansWXU - foreignBorrowingWXU) < 1e-6
    };
  }

  snapshot() {
    const base = super.snapshot();
    const global = this.globalInternationalReport();
    for (const snapCountry of base.countries) {
      const country = this.countries.find(c => c.id === snapCountry.id);
      snapCountry.international = structuredClone(country.lastInternational);
      snapCountry.internationalAccounting = this.international.verifyCountry(country, this.countries);
      snapCountry.fx = structuredClone(country.fx);
      snapCountry.tradePolicy = structuredClone(country.tradePolicy);
      snapCountry.internationalPosition = structuredClone(country.internationalPosition);
      snapCountry.foreignFundingTrace = structuredClone(country.lastForeignFundingTrace);
      snapCountry.activeForeignFundingContracts = this.international.fundingContracts.filter(x =>
        x.status === 'active' && (x.lenderCountryId === country.id || x.borrowerCountryId === country.id)
      ).length;
      snapCountry.sampleForeignFundingContract = structuredClone(
        this.international.fundingContracts.find(x => x.status === 'active' && (x.lenderCountryId === country.id || x.borrowerCountryId === country.id)) ||
        this.international.fundingContracts.find(x => x.lenderCountryId === country.id || x.borrowerCountryId === country.id) || null
      );
      snapCountry.recentInternationalTrades = structuredClone(this.international.recentTrades(this.month, country.id, 18));
      snapCountry.recentForeignFunding = structuredClone(this.international.recentFunding(country.id, 12));
      snapCountry.internationalHistory = structuredClone(country.internationalHistory.slice());
      snapCountry.bilateralExchangeRates = this.countries
        .filter(other => other.id !== country.id)
        .map(other => ({
          countryId: other.id,
          currency: other.fx.currency,
          unitsOfOtherPerOneLocal: this.international.bilateralRate(country, other)
        }));
      snapCountry.globalInternational = structuredClone(global);
    }
    base.globalInternational = global;
    return base;
  }
}
