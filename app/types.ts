export interface Month {
  id: number
  name: string
  year: number
  month: number
  isClosed: boolean
  note?: string | null
}

export interface PaymentType {
  id: number
  name: string
  kind: 'fixed' | 'metered' | 'variable'
  isMetered: boolean
  isRequired: boolean
  defaultActive: boolean
  defaultAmount?: number | null
  unitPrice?: number | null
  unit?: string | null
  notes?: string | null
}
