export function pluralRu(count: number, one: string, few: string, many: string): string {
  const normalized = Math.abs(Math.trunc(count));
  const mod100 = normalized % 100;

  if (mod100 >= 11 && mod100 <= 14) return many;

  const mod10 = normalized % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function formatPluralRu(count: number, one: string, few: string, many: string): string {
  return `${count} ${pluralRu(count, one, few, many)}`;
}
