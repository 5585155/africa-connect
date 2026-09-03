// Preserve the existing whole-dollar fee policy, including the $274 demo trade.
// This calculation is an estimate, not proof of payment.
export function computeEscrowBreakdown(quantity: number, unitPriceUSD: number) {
  const cropCostUSD = quantity * unitPriceUSD
  const logisticsUSD = quantity * 18
  const escrowFeeUSD = Math.round(cropCostUSD * 0.025)
  const totalUSD = cropCostUSD + logisticsUSD + escrowFeeUSD
  return { cropCostUSD, logisticsUSD, escrowFeeUSD, totalUSD }
}

export interface EscrowBreakdown {
  unitPriceUSD: number
  logisticsUSD: number
  escrowFeeUSD: number
  totalUSD: number
  receiptReference: string
}

// Mapping only: authorization and payment verification must happen server-side.
export function toFundingUpdate(breakdown: EscrowBreakdown) {
  return {
    escrow_status: 'Escrow Funded',
    unit_price_usd: breakdown.unitPriceUSD,
    logistics_usd: breakdown.logisticsUSD,
    escrow_fee_usd: breakdown.escrowFeeUSD,
    total_amount: breakdown.totalUSD,
    receipt_reference: breakdown.receiptReference,
  }
}
