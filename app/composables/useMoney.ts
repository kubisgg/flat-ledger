export function useMoney() {
  const floorMoney = (value: number) => Math.round(value)
  const formatMoney = (value: number | null | undefined) => new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN'
  }).format(floorMoney(value || 0))
  const formatExact = (value: number | null | undefined) => new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0)

  return { formatMoney, formatExact }
}
