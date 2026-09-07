import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { getDashboard, getMeterHistory, getMonth, listMonths } from '../services/ledger'

import { meterHistorySchema, presentMeterHistory, monthDetailsSchema, monthsSchema, presentMonthDetails, presentMonths, presentSummary, summarySchema } from './responses'

const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

function result(data: Record<string, unknown>) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }], structuredContent: data }
}

function createHandler() {
  return createMcpHandler(() => {
    const server = new McpServer({ name: 'flat-ledger', version: '1.0.0' })

    server.registerTool('get_latest_month_summary', {
      description: 'Get the latest recorded month, its charge total before rounding, roundedTransferAmount and charge items. Always use roundedTransferAmount for the single transfer to the landlord, rounded to whole PLN. transferSent records the user marking the transfer as sent.',
      inputSchema: z.object({}).strict(),
      outputSchema: summarySchema,
      annotations
    }, async () => result(presentSummary(getDashboard())))

    server.registerTool('list_months', {
      description: 'List recorded months, newest first, with the user-declared transferSent status. Use a returned month ID with get_month_details.',
      inputSchema: z.object({
        page: z.number().int().min(1).max(1000000).default(1),
        itemsPerPage: z.number().int().min(1).max(100).default(20)
      }).strict(),
      outputSchema: monthsSchema,
      annotations
    }, async ({ page, itemsPerPage }) => result(presentMonths(listMonths(page, itemsPerPage))))

    server.registerTool('get_month_details', {
      description: 'Get one recorded month, its charge items, charge categories and meter readings. Charges are components of a single monthly transfer. Always send roundedTransferAmount to the landlord; transferAmount is the sum before rounding to whole PLN. transferSent is the user-declared sending status. Obtain monthId from list_months or get_latest_month_summary.',
      inputSchema: z.object({ monthId: z.number().int().positive().describe('Month ID returned by list_months or get_latest_month_summary.') }).strict(),
      outputSchema: monthDetailsSchema,
      annotations
    }, async ({ monthId }) => {
      try {
        return result(presentMonthDetails(getMonth(monthId)))
      } catch (error) {
        if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
          return { isError: true, content: [{ type: 'text' as const, text: 'Month not found. Use list_months to find an existing month ID.' }] }
        }
        throw error
      }
    })

    server.registerTool('get_meter_history', {
      description: 'Get up to 12 recorded months of usage for each meter type, units and the change compared with the previous recorded month.',
      inputSchema: z.object({}).strict(),
      outputSchema: meterHistorySchema,
      annotations
    }, async () => result(presentMeterHistory(getMeterHistory())))

    return server
  }, { responseMode: 'json' })
}

let handler: ReturnType<typeof createHandler> | undefined

export function getMcpHandler() {
  return handler ??= createHandler()
}

export async function closeMcpHandler() {
  await handler?.close()
}
