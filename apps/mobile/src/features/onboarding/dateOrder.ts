export type DatePart = 'day' | 'month' | 'year';

/** Ordre des champs jour/mois/année selon la langue et le pays (ex. US : mois/jour/année). */
export function dateFieldOrder(locale: string): DatePart[] {
  try {
    const parts = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(
      new Date(Date.UTC(2000, 0, 31)),
    );
    const order = parts
      .map((p) => p.type)
      .filter((t): t is DatePart => t === 'day' || t === 'month' || t === 'year');
    return order.length === 3 ? order : ['day', 'month', 'year'];
  } catch {
    return ['day', 'month', 'year'];
  }
}
