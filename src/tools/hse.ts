import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ifsPost, getConfig } from "../ifs-client.js"
import { PROJECTION_BASE } from "../mappings.js"

const HSE_ENDPOINT = `${PROJECTION_BASE}/HSETransferService.svc`

export function registerHSETools(server: McpServer): void {
  server.tool(
    "report_hse_incident",
    "Report a Health, Safety & Environment incident in IFS Cloud. Use for injuries, near-misses, spills, or other safety events.",
    {
      incident_type: z.string().describe("Type of incident (e.g. 'Near Miss', 'Injury', 'Environmental Spill', 'Property Damage')"),
      description: z.string().describe("Detailed description of the incident"),
      severity: z.enum(["low", "medium", "high", "critical"]).describe("Severity level"),
      location: z.string().describe("Location where the incident occurred"),
      incident_date: z.string().optional().describe("Date of incident in ISO 8601 format. Defaults to now"),
      reported_by: z.string().optional().describe("Person ID of the reporter"),
      work_order: z.number().optional().describe("Related work order number, if applicable"),
    },
    async ({ incident_type, description, severity, location, incident_date, reported_by, work_order }) => {
      const cfg = getConfig()

      const payload: Record<string, any> = {
        Company: cfg.defaultCompany,
        IncidentType: incident_type,
        Description: description,
        SeverityLevel: severity.charAt(0).toUpperCase() + severity.slice(1),
        Location: location,
        ReportedBy: reported_by ?? "MCP",
        IncidentDate: incident_date ?? new Date().toISOString(),
      }
      if (work_order) payload.WoNo = work_order

      await ifsPost(HSE_ENDPOINT, payload)

      return {
        content: [{
          type: "text",
          text: `HSE incident reported.\n\nType: ${incident_type}\nSeverity: ${severity}\nLocation: ${location}\nDescription: ${description}`,
        }],
      }
    },
  )
}
