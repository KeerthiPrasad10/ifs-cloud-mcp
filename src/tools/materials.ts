import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ifsGet, ifsPost, getConfig, type ODataResponse } from "../ifs-client.js"
import { IFS_PROJECTIONS } from "../mappings.js"

export function registerMaterialTools(server: McpServer): void {
  server.tool(
    "requisition_material",
    "Create a material requisition against a work order in IFS Cloud.",
    {
      wo_no: z.number().describe("Work order number"),
      part_no: z.string().describe("Inventory part number"),
      quantity: z.number().describe("Quantity required"),
      site: z.string().optional().describe("Site contract code. Falls back to IFS_DEFAULT_SITE"),
    },
    async ({ wo_no, part_no, quantity, site }) => {
      const cfg = getConfig()
      const contract = site ?? cfg.defaultSite

      if (!contract) {
        return { content: [{ type: "text", text: "Site contract is required. Provide it or set IFS_DEFAULT_SITE." }], isError: true }
      }

      await ifsPost(IFS_PROJECTIONS.materialRequisitions, {
        WoNo: wo_no,
        PartNo: part_no,
        QtyRequired: quantity,
        Contract: contract,
      })

      return {
        content: [{ type: "text", text: `Material requisition created: ${quantity}x ${part_no} for WO#${wo_no} at site ${contract}.` }],
      }
    },
  )

  server.tool(
    "list_materials",
    "List material requisitions for a work order.",
    {
      wo_no: z.number().describe("Work order number"),
    },
    async ({ wo_no }) => {
      const response = await ifsGet<ODataResponse>(IFS_PROJECTIONS.materialRequisitions, {
        $filter: `WoNo eq '${wo_no}'`,
      })

      const materials = (response.value ?? []).map((r) => ({
        wo_no: r.WoNo,
        part_no: r.PartNo,
        description: r.PartDescription,
        quantity_required: r.QtyRequired,
        quantity_used: r.QtyUsed,
        unit: r.UnitMeas,
        site: r.Contract,
      }))

      return {
        content: [{
          type: "text",
          text: `Found ${materials.length} material requisitions for WO#${wo_no}.\n\n${JSON.stringify(materials, null, 2)}`,
        }],
      }
    },
  )

  server.tool(
    "list_inventory_parts",
    "Search inventory parts in IFS Cloud. Use this to discover valid part numbers before creating material requisitions.",
    {
      site: z.string().optional().describe("Filter by site contract code"),
      search: z.string().optional().describe("Search term to filter by part number or description"),
      limit: z.number().default(50).describe("Maximum number of results"),
    },
    async ({ site, search, limit }) => {
      const filters: string[] = []
      if (site) filters.push(`Contract eq '${site}'`)
      if (search) filters.push(`(contains(PartNo,'${search}') or contains(Description,'${search}'))`)

      const params: Record<string, string | number | undefined> = {
        $select: "PartNo,Description,UnitMeas,Contract,TypeCode",
        $top: limit,
      }
      if (filters.length) params.$filter = filters.join(" and ")

      const response = await ifsGet<ODataResponse>(IFS_PROJECTIONS.inventoryParts, params)
      const parts = (response.value ?? []).map((r) => ({
        part_no: r.PartNo,
        description: r.Description,
        unit: r.UnitMeas,
        site: r.Contract,
        type: r.TypeCode,
      }))

      return {
        content: [{
          type: "text",
          text: `Found ${parts.length} inventory parts.\n\n${JSON.stringify(parts, null, 2)}`,
        }],
      }
    },
  )
}
