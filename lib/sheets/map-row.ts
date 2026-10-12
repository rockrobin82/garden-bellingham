/**
 * Maps a header row + data row into a keyed object using column order.
 */
export function mapRowToRecord<T extends string>(
  headers: readonly T[],
  row: string[],
): Record<T, string> {
  const record = {} as Record<T, string>;

  headers.forEach((header, index) => {
    record[header] = row[index] ?? "";
  });

  return record;
}
