import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ifsGet, ifsPost, getConfig, type ODataResponse } from "../ifs-client.js"
import { IFS_PROJECTIONS } from "../mappings.js"

export function registerTimeEntryTools(server: McpServer): void {
  server.tool(
    "log_time",
    "Log a time entry against a work order task in IFS Cloud.",
    {
      wo_no: z.number().describe("Work order number"),
      task_seq: z.number().optional().describe("Task sequence number. If omitted, uses the first task on the WO"),
      employee_id: z.string().describe("Employee/person ID"),
      hours: z.number().describe("Number of work hours"),
      start_time: z.string().optional().describe("Start time in ISO 8601 format"),
      end_time: z.string().optional().describe("End time in ISO 8601 format"),
    },
    async ({ wo_no, task_seq, employee_id, hours, start_time, end_time }) => {
      const cfg = getConfig()

      let resolvedTaskSeq = task_seq
      if (!resolvedTaskSeq) {
        const taskResp = await ifsGet<ODataResponse>(IFS_PROJECTIONS.workTasks, {
          $filter: `WoNo eq '${wo_no}'`,
          $select: "TaskSeq",
          $top: 1,
        })
        const tasks = taskResp.value ?? []
        if (tasks.length === 0) {
          return { content: [{ type: "text", text: `No task found for WO#${wo_no}.` }], isError: true }
        }
        resolvedTaskSeq = tasks[0].TaskSeq
      }

      const payload: Record<string, any> = {
        WoNo: wo_no,
        TaskSeq: resolvedTaskSeq,
        EmployeeId: employee_id,
        WorkHours: hours,
      }
      if (cfg.defaultCompany) payload.Company = cfg.defaultCompany
      if (start_time) payload.StartDateTime = start_time
      if (end_time) payload.StopDateTime = end_time

      await ifsPost(IFS_PROJECTIONS.taskCostLines, payload)

      return {
        content: [{ type: "text", text: `Time entry logged: ${hours}h for employee ${employee_id} on WO#${wo_no} (TaskSeq ${resolvedTaskSeq}).` }],
      }
    },
  )

  server.tool(
    "list_time_entries",
    "List time entries for a work order.",
    {
      wo_no: z.number().describe("Work order number"),
    },
    async ({ wo_no }) => {
      const response = await ifsGet<ODataResponse>(IFS_PROJECTIONS.taskCostLines, {
        $filter: `WoNo eq '${wo_no}'`,
      })

      const entries = (response.value ?? []).map((r) => ({
        wo_no: r.WoNo,
        task_seq: r.TaskSeq,
        employee: r.EmployeeId,
        hours: r.WorkHours,
        start: r.StartDateTime,
        end: r.StopDateTime,
        type: r.EntryType,
      }))

      return {
        content: [{
          type: "text",
          text: `Found ${entries.length} time entries for WO#${wo_no}.\n\n${JSON.stringify(entries, null, 2)}`,
        }],
      }
    },
  )
}
