// Výchozí měna
const DEFAULT_CURRENCY = 'CZK';

// Cache pro nastavení měny
let cachedCurrency: string | null = null;

/**
 * Nastaví měnu globálně
 */
export const setCurrency = (currency: string) => {
  cachedCurrency = currency;
};

/**
 * Vrátí aktuální měnu
 */
export const getCurrency = (): string => {
  return cachedCurrency || DEFAULT_CURRENCY;
};

/**
 * Formátuje cenu s měnou
 */
export const formatPrice = (price: number | undefined | null, currency?: string): string => {
  if (price === undefined || price === null) return '—';
  
  const curr = currency || getCurrency();
  
  // Převod na lokální formát
  const formatted = price.toLocaleString('cs-CZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  
  return `${formatted} ${curr}`;
};

/**
 * Vrátí symbol měny pro dané kódy
 */
export const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    'CZK': 'Kč',
    'EUR': '€',
    'USD': '$',
    'GBP': '£',
  };
  return symbols[currency] || currency;
};

/**
 * Formátuje cenu se symbolem místo kódu
 */
export const formatPriceWithSymbol = (price: number | undefined | null, currency?: string): string => {
  if (price === undefined || price === null) return '—';
  
  const curr = currency || getCurrency();
  const symbol = getCurrencySymbol(curr);
  
  const formatted = price.toLocaleString('cs-CZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  
  return `${formatted} ${symbol}`;
};
