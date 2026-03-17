// Parse "₹9,91,200" → 991200
export function parseAmount(str) {
  if (!str || str === '—') return 0;
  return Number(str.replace(/[₹,]/g, ''));
}

// Format 991200 → "₹9,91,200"
export function formatAmount(num) {
  return '₹' + num.toLocaleString('en-IN');
}

// Format large amounts: 10000000 → "₹1Cr", 500000 → "₹5L"
export function formatShort(num) {
  if (num >= 10000000) return '₹' + (num / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
  if (num >= 100000) return '₹' + (num / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  if (num >= 1000) return '₹' + (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return '₹' + num;
}
