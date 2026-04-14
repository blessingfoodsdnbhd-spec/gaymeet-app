const RATES = { MYR: 1, SGD: 0.31, THB: 7.85, USD: 0.21 };
const SYMBOLS = { MYR: 'RM', SGD: 'S$', THB: '฿', USD: '$' };
module.exports = {
  RATES,
  SYMBOLS,
  convert(amount, from, to) { return (amount / RATES[from]) * RATES[to]; },
  format(amount, currency) { return `${SYMBOLS[currency]}${amount.toFixed(2)}`; },
  supported: ['MYR', 'SGD', 'THB', 'USD'],
};
