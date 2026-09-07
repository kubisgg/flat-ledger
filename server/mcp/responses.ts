import { z } from 'zod'
import { roundToWholePln, sumTransferCharges } from '#shared/utils/transfer'
import type { getDashboard, getMeterHistory, getMonth, listMonths } from '../services/ledger'

const transferSent = z.boolean().describe('Whether the user marked the single monthly transfer as sent. This is not bank confirmation.')

const transferAmount = z.number().describe('Sum of included charges in PLN before rounding. Use roundedTransferAmount for the actual transfer.')
const roundedTransferAmount = z.number().int().describe('Amount in PLN always sent to the landlord: transferAmount rounded to the nearest whole PLN.')

const monthSchema = z.object({
  id: z.number().describe('Month ID to pass to get_month_details.'),
  name: z.string(),
  year: z.number(),
  month: z.number().describe('Calendar month number, 1 through 12.'),
  transferSent,
  note: z.string().describe('User note for this month.').nullable()
})

const chargeSchema = z.object({
  id: z.number(),
  name: z.string(),
  amount: z.number().describe('Charge amount; contributes to the transfer only when includedInTransfer is true.'),
  includedInTransfer: z.boolean().describe('Whether this charge is included in the full monthly transfer amount.'),
  note: z.string().describe('User note for this charge.').nullable()
})

export const summarySchema = z.object({
  month: monthSchema.nullable().describe('Latest recorded month, which may differ from the current calendar month. Null if none exist.'),
  transferAmount,
  roundedTransferAmount,
  transferSent,
  charges: z.array(chargeSchema).describe('Monthly charge items, not separate transfers.'),
  unsentMonthCount: z.number().describe('Number of recorded months whose transfer has not been marked as sent.')
})

export const monthsSchema = z.object({
  months: z.array(monthSchema).describe('Requested page of months, newest first.'),
  totalMonthCount: z.number().describe('Total number of recorded months across all pages.')
})

export const monthDetailsSchema = z.object({
  month: monthSchema,
  transferAmount,
  roundedTransferAmount,
  charges: z.array(chargeSchema.extend({
    calculatedAmount: z.number().describe('Amount calculated from meter usage, if applicable.').nullable(),
    isManualAmount: z.boolean().describe('Whether the charge uses a manually entered amount.'),
    chargeType: z.object({
      id: z.number(),
      name: z.string(),
      kind: z.enum(['fixed', 'metered', 'variable'])
    }).nullable().describe('Charge category, if still available.'),
    meterReading: z.object({
      previousValue: z.number(),
      currentValue: z.number(),
      usage: z.number(),
      unitPrice: z.number(),
      unit: z.string().describe('Meter measurement unit, for example kWh or m3.').nullable()
    }).nullable().describe('Meter readings and unit price used for this charge, if applicable.')
  }))
})

function presentMonth(month: ReturnType<typeof getMonth>['month']) {
  return { id: month.id, name: month.name, year: month.year, month: month.month, transferSent: month.isClosed, note: month.note }
}

function presentCharge(charge: ReturnType<typeof getDashboard>['payments'][number]) {
  return { id: charge.id, name: charge.name, amount: charge.amount, includedInTransfer: charge.isRequired, note: charge.note }
}

export function presentSummary(data: ReturnType<typeof getDashboard>) {
  return {
    month: data.month ? presentMonth(data.month) : null,
    transferAmount: data.total,
    roundedTransferAmount: roundToWholePln(data.total),
    transferSent: data.paid,
    charges: data.payments.map(presentCharge),
    unsentMonthCount: data.openMonths ?? 0
  }
}

export function presentMonths(data: ReturnType<typeof listMonths>) {
  return { months: data.data.map(presentMonth), totalMonthCount: data.total }
}

export function presentMonthDetails(data: ReturnType<typeof getMonth>) {
  const amount = sumTransferCharges(data.payments)
  return {
    month: presentMonth(data.month),
    transferAmount: amount,
    roundedTransferAmount: roundToWholePln(amount),
    charges: data.payments.map(charge => ({
      ...presentCharge(charge),
      calculatedAmount: charge.calculatedAmount,
      isManualAmount: charge.isManualAmount,
      chargeType: charge.type ? { id: charge.type.id, name: charge.type.name, kind: charge.type.kind } : null,
      meterReading: charge.meter
        ? {
            previousValue: charge.meter.previousValue,
            currentValue: charge.meter.currentValue,
            usage: charge.meter.usage,
            unitPrice: charge.meter.unitPrice,
            unit: charge.meter.unit
          }
        : null
    }))
  }
}

export const meterHistorySchema = z.object({
  meters: z.array(z.object({
    id: z.number().describe('Meter type ID.'),
    name: z.string(),
    unit: z.string().describe('Measurement unit, for example kWh or m3.').nullable(),
    currentUsage: z.number().describe('Usage in the latest recorded month for this meter.'),
    previousUsage: z.number().describe('Usage in the preceding recorded month, which need not be the previous calendar month.').nullable(),
    usageDelta: z.number().describe('Current usage minus previous usage, in the meter unit. Null without a previous reading.').nullable(),
    usageChangePercent: z.number().describe('Percentage change from previous usage, rounded to two decimal places. Null if previous usage is missing or zero.').nullable(),
    history: z.array(z.object({
      year: z.number(),
      month: z.number().describe('Calendar month number, 1 through 12.'),
      usage: z.number()
    })).describe('Up to 12 recorded months, oldest first.')
  }))
})

export function presentMeterHistory(data: ReturnType<typeof getMeterHistory>) {
  return {
    meters: data.map(meter => ({
      id: meter.id,
      name: meter.name,
      unit: meter.unit,
      currentUsage: meter.currentUsage,
      previousUsage: meter.previousUsage,
      usageDelta: meter.previousUsage === null ? null : meter.currentUsage - meter.previousUsage,
      usageChangePercent: meter.previousUsage === null || meter.previousUsage === 0
        ? null
        : Number(((meter.currentUsage - meter.previousUsage) / meter.previousUsage * 100).toFixed(2)),
      history: meter.history.map(entry => ({ year: entry.year, month: entry.month, usage: entry.usage }))
    }))
  }
}
