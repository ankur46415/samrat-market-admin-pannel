/** Sort key for batches without expiry — deducts after dated batches (FEFO). */
export const NO_EXPIRY_BATCH_DATE = new Date(Date.UTC(9999, 11, 31))

export function isNoExpiryBatch(data: Record<string, unknown>): boolean {
  return data.noExpiry === true
}
