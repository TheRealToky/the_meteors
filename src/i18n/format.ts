export type SupportedLocale = 'en' | 'rw' | 'fr';

/**
 * Custom number formatter complying with the project spec:
 * - en: comma for thousands, period for decimals (e.g. 14,108,217)
 * - fr: narrow non-breaking space (\u202F) for thousands, comma for decimals (e.g. 14 108 217)
 * - rw: space for thousands, period/comma for decimals (e.g. 14 108 217)
 */
export function formatNumber(
  value: number,
  locale: SupportedLocale = 'en',
  options?: Intl.NumberFormatOptions
): string {
  if (isNaN(value)) return '0';

  // Attempt Intl.NumberFormat with fallbacks
  try {
    const localeTag = locale === 'rw' ? 'rw-RW' : locale === 'fr' ? 'fr-FR' : 'en-US';
    const formatter = new Intl.NumberFormat(localeTag, options);
    const formatted = formatter.format(value);

    // Ensure French uses narrow non-breaking space if browser formatted with standard space
    if (locale === 'fr') {
      return formatted.replace(/\s/g, '\u202F');
    }
    return formatted;
  } catch (_e) {
    // Fallback manual formatter
    return formatNumberFallback(value, locale, options);
  }
}

function formatNumberFallback(
  value: number,
  locale: SupportedLocale,
  options?: Intl.NumberFormatOptions
): string {
  const maximumFractionDigits = options?.maximumFractionDigits ?? 1;
  const parts = value.toFixed(maximumFractionDigits).split('.');
  const integerPart = parts[0];
  const decimalPart = parts.length > 1 ? parts[1] : '';

  const thousandsSeparator = locale === 'fr' ? '\u202F' : locale === 'rw' ? ' ' : ',';
  const decimalSeparator = locale === 'fr' ? ',' : '.';

  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

  if (!decimalPart || maximumFractionDigits === 0 || decimalPart === '0') {
    return withThousands;
  }
  return `${withThousands}${decimalSeparator}${decimalPart}`;
}

export function formatPercent(
  value: number,
  locale: SupportedLocale = 'en',
  decimals = 1
): string {
  const formatted = formatNumber(value, locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return locale === 'fr' ? `${formatted}\u202F%` : `${formatted}%`;
}
