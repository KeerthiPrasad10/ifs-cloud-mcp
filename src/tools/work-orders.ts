import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ifsGet, ifsPost, ifsAction, getConfig, type ODataResponse } from "../ifs-client.js"
import {
  IFS_PROJECTIONS,
  STATUS_FROM_IFS,
  PRIORITY_FROM_IFS,
  PRIORITY_TO_IFS,
  WORK_TYPE_FROM_IFS,
  WORK_TYPE_TO_IFS,
  WO_SELECT_FIELDS,
} from "../mappings.js"

export function registerWorkOrderTools(server: McpServer): void {
  server.tool(
    "create_work_order",
    "Create a new work order in IFS Cloud. Returns the WO number on success.",
    {
      site: z.string().describe("Site contract code (e.g. '2501') or use list_sites to discover valid codes"),
      title: z.string().describe("Short description / directive for the work order"),
      description: z.string().describe("Detailed fault or work description"),
      priority: z.enum(["critical", "high", "medium", "low"]).default("medium").describe("Work order priority"),
      work_type: z.enum(["emergency", "corrective", "preventive", "inspection", "calibration"]).default("corrective").describe("Type of maintenance work"),
      equipment: z.string().optional().describe("Equipment object code (MchCode). Use list_equipment to discover valid codes"),
      scheduled_start: z.string().optional().describe("Scheduled start date in ISO 8601 format"),
      release: z.boolean().default(false).describe("Immediately release the work order after creation (makes it available for execution)"),
      company: z.string().optional().describe("Company ID. Falls back to IFS_DEFAULT_COMPANY env var"),
      org_code: z.string().optional().describe("Organization code. Defaults to the site contract"),
    },
    async ({ site, title, description, priority, work_type, equipment, scheduled_start, release, company, org_code }) => {
      const cfg = getConfig()
      const companyId = company ?? cfg.defaultCompany
      const scheduledDate = scheduled_start ?? new Date().toISOString()

      const payload: Record<string, any> = {
        Contract: site,
        Objsite: site,
        OrgCode: org_code ?? site,
        RegDate: new Date().toISOString(),
        ErrDescr: title,
        ErrDescrLo: description,
        PriorityId: PRIORITY_TO_IFS[priority] ?? "3",
        EarliestStartDate: scheduledDate,
        AuthorizeCode: "*",
        CustOrderType: "SEO",
        ExcludeFromScheduling: false,
        PmGroupMerge: false,
        FinishWithTask: false,
        SchedMaintWin: true,
        ActivityConnection: false,
        PmGroupMergeDb: false,
        SchedMaintWinDb: true,
      }

      if (companyId) payload.Company = companyId
      if (equipment) {
        payload.MchCode = equipment
        payload.MchCodeContract = site
        payload.ConnectionType = "Equipment"
      }
      if (work_type) payload.WorkTypeId = WORK_TYPE_TO_IFS[work_type] ?? work_type

      const result = await ifsPost(IFS_PROJECTIONS.workOrdersPrepare, payload)
      const woNo = result.WoNo

      let releaseResult = ""
      if (release && woNo) {
        try {
          const record = await ifsGet(`${IFS_PROJECTIONS.workOrdersPrepare}(WoNo=${woNo})`, { $select: "WoNo" })
          const etag = record._etag ?? record["@odata.etag"]
          await ifsAction(
            `${IFS_PROJECTIONS.workOrdersPrepare}(WoNo=${woNo})/IfsApp.PrepareWorkOrderHandling.ActiveSeparate_Release`,
            etag,
          )
          releaseResult = " (Released)"
        } catch (err: any) {
          releaseResult = ` (Release failed: ${err.message?.slice(0, 100)})`
        }
      }

      return {
        content: [{ type: "text", text: `Work order WO#${woNo} created successfully${releaseResult}.\n\nWO Number: ${woNo}\nSite: ${site}\nPriority: ${priority}\nTitle: ${title}` }],
      }
    },
  )

  server.tool(
    "release_work_order",
    "Release a work order in IFS Cloud, making it available for execution. Requires fetching an etag first.",
    {
      wo_no: z.number().describe("The work order number (WoNo) to release"),
    },
    async ({ wo_no }) => {
      const record = await ifsGet(`${IFS_PROJECTIONS.workOrdersPrepare}(WoNo=${wo_no})`, { $select: "WoNo,Objstate" })
      const etag = record._etag ?? record["@odata.etag"]
      const currentState = record.Objstate

      if (currentState === "Released" || currentState === "RELEASED") {
        return { content: [{ type: "text", text: `WO#${wo_no} is already released.` }] }
      }

      await ifsAction(
        `${IFS_PROJECTIONS.workOrdersPrepare}(WoNo=${wo_no})/IfsApp.PrepareWorkOrderHandling.ActiveSeparate_Release`,
        etag,
      )

      return { content: [{ type: "text", text: `WO#${wo_no} released successfully. It is now available for execution.` }] }
    },
  )

  server.tool(
    "list_work_orders",
    "List work orders from IFS Cloud with optional filtering by site, status, priority, or date range.",
    {
      site: z.string().optional().describe("Filter by site contract code"),
      status: z.enum(["pending", "assigned", "in_progress", "on_hold", "completed", "cancelled"]).optional().describe("Filter by status"),
      priority: z.enum(["critical", "high", "medium", "low"]).optional().describe("Filter by priority"),
      since: z.string().optional().describe("Only return WOs modified after this ISO 8601 date"),
      limit: z.number().default(50).describe("Maximum number of results to return"),
    },
    async ({ site, status, priority, since, limit }) => {
      const filters: string[] = []
      if (site) filters.push(`Contract eq '${site}'`)
      if (priority) filters.push(`PriorityId eq '${PRIORITY_TO_IFS[priority]}'`)
      if (since) filters.push(`LastActivityDate gt ${since}`)

      const params: Record<string, string | number | undefined> = {
        $select: WO_SELECT_FIELDS,
        $orderby: "EarliestStartDate asc",
        $top: limit,
      }
      if (filters.length) params.$filter = filters.join(" and ")

      const response = await ifsGet<ODataResponse>(IFS_PROJECTIONS.workOrders, params)
      let records = response.value ?? []

      if (status) {
        records = records.filter(
          (r) => (STATUS_FROM_IFS[r.Objstate] ?? "pending") === status,
        )
      }

      const mapped = records.map((r) => ({
        wo_no: r.WoNo,
        title: r.ErrDescr,
        description: r.ErrDescrLo,
        status: STATUS_FROM_IFS[r.Objstate] ?? r.Objstate,
        priority: PRIORITY_FROM_IFS[String(r.PriorityId)] ?? "medium",
        work_type: WORK_TYPE_FROM_IFS[String(r.WorkTypeId)] ?? "corrective",
        equipment: r.MchCode ?? null,
        equipment_name: r.MchCodeDescription ?? null,
        site: r.Contract,
        site_name: r.WOSiteDesc ?? r.Contract,
        scheduled_start: r.EarliestStartDate ?? r.PlanSDate,
        scheduled_end: r.PlanFDate,
        actual_start: r.RealSDate,
        actual_end: r.RealFDate,
        reported_by: r.ReportedBy,
        created: r.RegDate,
      }))

      return {
        content: [{
          type: "text",
          text: `Found ${mapped.length} work orders.\n\n${JSON.stringify(mapped, null, 2)}`,
        }],
      }
    },
  )

  server.tool(
    "get_work_order",
    "Get details of a specific work order by WO number, including its tasks.",
    {
      wo_no: z.number().describe("The work order number"),
    },
    async ({ wo_no }) => {
      const record = await ifsGet(`${IFS_PROJECTIONS.workOrders}(WoNo=${wo_no})`, { $select: WO_SELECT_FIELDS })

      let tasks: any[] = []
      try {
        const taskResp = await ifsGet<ODataResponse>(IFS_PROJECTIONS.workTasks, {
          $filter: `WoNo eq '${wo_no}'`,
        })
        tasks = (taskResp.value ?? []).map((t) => ({
          task_seq: t.TaskSeq,
          description: t.Description,
          status: STATUS_FROM_IFS[t.ObjState] ?? t.ObjState,
          site: t.Contract,
        }))
      } catch { /* tasks may not exist */ }

      let steps: any[] = []
      try {
        const stepResp = await ifsGet<ODataResponse>(IFS_PROJECTIONS.workTaskSteps, {
          $filter: `WoNo eq ${wo_no}`,
          $select: "WoNo,TaskSeq,TaskStepSeq,Description,Objstate",
          $orderby: "TaskStepSeq asc",
        })
        steps = (stepResp.value ?? []).map((s) => ({
          step_seq: s.TaskStepSeq,
          description: s.Description,
          status: s.Objstate === "DONE" ? "completed" : s.Objstate === "NOTAPPLICABLE" ? "skipped" : "pending",
        }))
      } catch { /* steps may not exist */ }

      const wo = {
        wo_no: record.WoNo,
        title: record.ErrDescr,
        description: record.ErrDescrLo,
        status: STATUS_FROM_IFS[record.Objstate] ?? record.Objstate,
        priority: PRIORITY_FROM_IFS[String(record.PriorityId)] ?? "medium",
        work_type: WORK_TYPE_FROM_IFS[String(record.WorkTypeId)] ?? "corrective",
        equipment: record.MchCode,
        equipment_name: record.MchCodeDescription,
        site: record.Contract,
        site_name: record.WOSiteDesc,
        scheduled_start: record.EarliestStartDate,
        scheduled_end: record.PlanFDate,
        actual_start: record.RealSDate,
        actual_end: record.RealFDate,
        reported_by: record.ReportedBy,
        created: record.RegDate,
        tasks,
        steps,
      }

      return { content: [{ type: "text", text: JSON.stringify(wo, null, 2) }] }
    },
  )
}
