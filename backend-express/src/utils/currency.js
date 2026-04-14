/**
 * Multi-currency support.
 * Base currency: MYR (Malaysian Ringgit)
 * Rates are approximate and would be refreshed from an API in production.
 */

const CURRENCIES = {
  MYR: { code: 'MYR', symbol: 'RM',  name: 'Malaysian Ringgit', flag: '🇲🇾', rate: 1.0 },
  SGD: { code: 'SGD', symbol: 'S$',  name: 'Singapore Dollar',  flag: '🇸🇬', rate: 0.3 },
  THB: { code: 'THB', symbol: '฿',   name: 'Thai Baht',         flag: '🇹🇭', rate: 7.8 },
  USD: { code: 'USD', symbol: '$',   name: 'US Dollar',         flag: '🇺🇸', rate: 0.21 },
};

/**
 * Convert an amount from MYR to the target currency.
 * @param {number} amountMYR
 * @param {string} targetCode  e.g. 'SGD'
 * @returns {number}
 */
function convertFromMYR(amountMYR, targetCode) {
  const currency = CURRENCIES[targetCode];
  if (!currency) throw new Error(`Unknown currency: ${targetCode}`);
  return Math.round(amountMYR * currency.rate * 100) / 100;
}

/**
 * Format a MYR amount in the target currency string.
 * @param {number} amountMYR
 * @param {string} targetCode
 * @returns {string}  e.g. 'S$5.70'
 */
function formatPrice(amountMYR, targetCode = 'MYR') {
  const currency = CURRENCIES[targetCode];
  if (!currency) return `RM${amountMYR.toFixed(2)}`;
  const converted = convertFromMYR(amountMYR, targetCode);
  return `${currency.symbol}${converted.toFixed(2)}`;
}

module.exports = { CURRENCIES, convertFromMYR, formatPrice };
