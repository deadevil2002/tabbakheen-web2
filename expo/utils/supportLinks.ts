export function normalizeWhatsAppNumber(value: string | undefined): string | null {
  const digits = (value ?? '').replace(/[^\d]/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function createWhatsAppUrl(
  value: string | undefined,
  message?: string,
): string | null {
  const number = normalizeWhatsAppNumber(value);
  if (!number) return null;
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}