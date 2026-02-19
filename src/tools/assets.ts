import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ifsGet, type ODataResponse } from "../ifs-client.js"
import { IFS_PROJECTIONS, ASSET_STATUS_FROM_IFS } from "../mappings.js"

export function registerAssetTools(server: McpServer): void {
  server.tool(
    "list_equipment",
    "List equipment/asset objects from IFS Cloud. Use this to discover valid MchCode values for creating work orders.",
    {
      site: z.string().optional().describe("Filter by site contract code"),
      search: z.string().optional().describe("Search term to filter by equipment name or code"),
      in_operation_only: z.boolean().default(true).describe("Only return equipment that is currently in operation"),
      limit: z.number().default(50).describe("Maximum number of results"),
    },
    async ({ site, search, in_operation_only, limit }) => {
      const filters: string[] = []
      if (site) filters.push(`Contract eq '${site}'`)
      if (in_operation_only) filters.push("InOperation eq 'In Operation'")
      if (search) filters.push(`(contains(MchCode,'${search}') or contains(MchName,'${search}'))`)

      const params: Record<string, string | number | undefined> = {
        $select: "EquipmentObjectSeq,MchCode,MchName,ItemDescription,GroupId,ManufacturerNo,PartNo,SerialNo,LocationId,OperationalStatus,Contract",
        $top: limit,
      }
      if (filters.length) params.$filter = filters.join(" and ")

      const response = await ifsGet<ODataResponse>(IFS_PROJECTIONS.assets, params)
      const equipment = (response.value ?? []).map((r) => ({
        mch_code: r.MchCode,
        name: r.MchName,
        description: r.ItemDescription,
        group: r.GroupId,
        manufacturer: r.ManufacturerNo,
        part_no: r.PartNo,
        serial_no: r.SerialNo,
        location: r.LocationId,
        status: ASSET_STATUS_FROM_IFS[r.OperationalStatus] ?? "operational",
        site: r.Contract,
      }))

      return {
        content: [{
          type: "text",
          text: `Found ${equipment.length} equipment objects.\n\n${JSON.stringify(equipment, null, 2)}`,
        }],
      }
    },
  )

  server.tool(
    "get_equipment",
    "Get details of a specific equipment object by MchCode.",
    {
      mch_code: z.string().describe("The equipment object code"),
      site: z.string().optional().describe("Site contract code (required if MchCode is not globally unique)"),
    },
    async ({ mch_code, site }) => {
      const filters = [`MchCode eq '${mch_code}'`]
      if (site) filters.push(`Contract eq '${site}'`)

      const response = await ifsGet<ODataResponse>(IFS_PROJECTIONS.assets, {
        $filter: filters.join(" and "),
        $select: "EquipmentObjectSeq,MchCode,MchName,ItemDescription,GroupId,ManufacturerNo,PartNo,SerialNo,LocationId,OperationalStatus,Contract",
        $top: 1,
      })

      const records = response.value ?? []
      if (records.length === 0) {
        return { content: [{ type: "text", text: `Equipment '${mch_code}' not found.` }], isError: true }
      }

      const r = records[0]
      const equipment = {
        mch_code: r.MchCode,
        name: r.MchName,
        description: r.ItemDescription,
        group: r.GroupId,
        manufacturer: r.ManufacturerNo,
        part_no: r.PartNo,
        serial_no: r.SerialNo,
        location: r.LocationId,
        status: ASSET_STATUS_FROM_IFS[r.OperationalStatus] ?? "operational",
        site: r.Contract,
      }

      return { content: [{ type: "text", text: JSON.stringify(equipment, null, 2) }] }
    },
  )
}
