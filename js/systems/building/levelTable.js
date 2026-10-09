export function levelTable(arr, level, label) {
  const entry = arr[level];
  if (entry === undefined) throw new Error(`${label}: no entry for level ${level}`);
  return entry;
}
