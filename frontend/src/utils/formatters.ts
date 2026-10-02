export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateIndo(dateString: string | Date | null | undefined, withTime = false): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  };

  return new Intl.DateTimeFormat('id-ID', options).format(date);
}

export function toRomanNumeral(num: number): string {
  const romanMap: [number, string][] = [
    [12, 'XII'],
    [11, 'XI'],
    [10, 'X'],
    [9, 'IX'],
    [8, 'VIII'],
    [7, 'VII'],
    [6, 'VI'],
    [5, 'V'],
    [4, 'IV'],
    [3, 'III'],
    [2, 'II'],
    [1, 'I'],
  ];

  for (const [val, roman] of romanMap) {
    if (num >= val) return roman;
  }
  return 'I';
}

export function formatLetterNumberPreview(typeCode: string, sequence: number, month: number, year: number): string {
  const paddedSeq = String(sequence).padStart(3, '0');
  const romanMonth = toRomanNumeral(month);
  return `${paddedSeq}/${typeCode}/APII-JB/${romanMonth}/${year}`;
}
