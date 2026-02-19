import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ifsGet, type ODataResponse } from "../ifs-client.js"
import { IFS_PROJECTIONS } from "../mappings.js"

export function registerSiteTools(server: McpServer): void {
  server.tool(
    "list_sites",
    "List all sites (contracts) in IFS Cloud. Use this to discover valid site codes before creating work orders or filtering equipment.",
    {
      limit: z.number().default(100).describe("Maximum number of sites to return"),
    },
    async ({ limit }) => {
      const response = await ifsGet<ODataResponse>(IFS_PROJECTIONS.sites, {
        $select: "Contract,Description,Company",
        $top: limit,
      })

      const sites = (response.value ?? []).map((r) => ({
        contract: r.Contract,
        name: r.Description ?? r.Contract,
        company: r.Company,
      }))

      return {
        content: [{
          type: "text",
          text: `Found ${sites.length} sites.\n\n${JSON.stringify(sites, null, 2)}`,
        }],
      }
    },
  )
}
