import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ifsGet, type ODataResponse } from "../ifs-client.js"
import { IFS_PROJECTIONS } from "../mappings.js"

export function registerServiceContractTools(server: McpServer): void {
  server.tool(
    "list_service_contracts",
    "List service contracts from IFS Cloud. Useful for understanding SLA commitments and customer agreements.",
    {
      customer_id: z.string().optional().describe("Filter by customer ID"),
      since: z.string().optional().describe("Only return contracts modified after this ISO 8601 date"),
      limit: z.number().default(50).describe("Maximum number of results"),
    },
    async ({ customer_id, since, limit }) => {
      const filters: string[] = []
      if (customer_id) filters.push(`CustomerId eq '${customer_id}'`)
      if (since) filters.push(`Objversion gt datetime'${since}'`)

      const params: Record<string, string | number | undefined> = { $top: limit }
      if (filters.length) params.$filter = filters.join(" and ")

      const response = await ifsGet<ODataResponse>(IFS_PROJECTIONS.serviceContracts, params)
      const contracts = (response.value ?? []).map((r) => ({
        contract_id: r.ContractId,
        name: r.ContractName,
        customer_id: r.CustomerId,
        status: r.ObjState?.toLowerCase(),
        start_date: r.DateFrom,
        end_date: r.DateTo,
      }))

      return {
        content: [{
          type: "text",
          text: `Found ${contracts.length} service contracts.\n\n${JSON.stringify(contracts, null, 2)}`,
        }],
      }
    },
  )

  server.tool(
    "list_customers",
    "List customers from IFS Cloud.",
    {
      since: z.string().optional().describe("Only return customers modified after this ISO 8601 date"),
      limit: z.number().default(50).describe("Maximum number of results"),
    },
    async ({ since, limit }) => {
      const params: Record<string, string | number | undefined> = {
        $top: limit,
      }
      if (since) params.$filter = `Objversion gt datetime'${since}'`

      const response = await ifsGet<ODataResponse>(IFS_PROJECTIONS.customers, params)
      const customers = (response.value ?? []).map((r) => ({
        id: r.CustomerId,
        name: r.Name,
        association_no: r.AssociationNo,
        country: r.Country,
      }))

      return {
        content: [{
          type: "text",
          text: `Found ${customers.length} customers.\n\n${JSON.stringify(customers, null, 2)}`,
        }],
      }
    },
  )
}
