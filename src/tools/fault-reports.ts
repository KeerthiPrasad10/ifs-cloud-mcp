import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ifsGet, ifsPost, getConfig, type ODataResponse } from "../ifs-client.js"
import { IFS_PROJECTIONS, PRIORITY_TO_IFS, PRIORITY_FROM_IFS, STATUS_FROM_IFS } from "../mappings.js"

export function registerFaultReportTools(server: McpServer): void {
  server.tool(
    "create_fault_report",
    "Create a fault report in IFS Cloud. Fault reports can be linked to equipment and may generate work orders.",
    {
      site: z.string().describe("Site contract code"),
      title: z.string().describe("Short description of the fault"),
      description: z.string().describe("Detailed fault description"),
      equipment: z.string().optional().describe("Equipment code (MchCode) where the fault was observed"),
      severity: z.enum(["critical", "high", "medium", "low"]).default("medium").describe("Fault severity"),
      reported_by: z.string().optional().describe("Person ID of the reporter"),
    },
    async ({ site, title, description, equipment, severity, reported_by }) => {
      const cfg = getConfig()
      const payload: Record<string, any> = {
        Contract: site,
        ErrDescr: title,
        ErrDescrLo: description,
        PriorityId: PRIORITY_TO_IFS[severity] ?? "3",
        ReportedBy: reported_by ?? "MCP",
      }
      if (equipment) {
        payload.MchCode = equipment
        payload.MchCodeContract = site
      }

      const result = await ifsPost(IFS_PROJECTIONS.faultReports, payload)
      const id = result.ActivitySeq ?? result.WoNo

      return {
        content: [{ type: "text", text: `Fault report created (ID: ${id}).\n\nSite: ${site}\nSeverity: ${severity}\nTitle: ${title}` }],
      }
    },
  )

  server.tool(
    "list_fault_reports",
    "List fault reports from IFS Cloud.",
    {
      site: z.string().optional().describe("Filter by site contract code"),
      since: z.string().optional().describe("Only return reports modified after this ISO 8601 date"),
      limit: z.number().default(50).describe("Maximum number of results"),
    },
    async ({ site, since, limit }) => {
      const filters: string[] = []
      if (site) filters.push(`Contract eq '${site}'`)
      if (since) filters.push(`Objversion gt datetime'${since}'`)

      const params: Record<string, string | number | undefined> = { $top: limit }
      if (filters.length) params.$filter = filters.join(" and ")

      const response = await ifsGet<ODataResponse>(IFS_PROJECTIONS.faultReports, params)
      const reports = (response.value ?? []).map((r) => ({
        id: r.ActivitySeq ?? r.WoNo,
        title: r.ErrDescr,
        description: r.ErrDescrLo,
        equipment: r.MchCode,
        severity: PRIORITY_FROM_IFS[String(r.PriorityId)] ?? "medium",
        status: STATUS_FROM_IFS[r.ObjState] ?? r.ObjState ?? "new",
        reported_by: r.ReportedBy,
        work_order: r.WoNo,
        site: r.Contract,
      }))

      return {
        content: [{
          type: "text",
          text: `Found ${reports.length} fault reports.\n\n${JSON.stringify(reports, null, 2)}`,
        }],
      }
    },
  )
}
