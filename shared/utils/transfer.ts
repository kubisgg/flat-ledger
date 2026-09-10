export function roundToWholePln(amount: number) {
  return Math.round(amount)
}

export function sumTransferCharges(charges: ReadonlyArray<{ amount: number, isRequired: boolean }>) {
  return charges.filter(charge => charge.isRequired).reduce((sum, charge) => sum + charge.amount, 0)
}
