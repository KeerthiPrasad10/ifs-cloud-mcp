import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ifsPost } from "../ifs-client.js"
import { IFS_PROJECTIONS } from "../mappings.js"

export function registerDocumentTools(server: McpServer): void {
  server.tool(
    "attach_document",
    "Attach a document reference to an entity in IFS Cloud (e.g. a work order). Note: for binary file uploads, use the IFS document management UI.",
    {
      doc_class: z.enum(["WORK_ORDER", "EQUIPMENT", "FAULT_REPORT"]).default("WORK_ORDER").describe("Document class / entity type"),
      doc_no: z.string().describe("Document number or reference"),
      title: z.string().describe("Document title"),
      entity_type: z.string().default("ActiveSeparate").describe("IFS logical unit name (e.g. ActiveSeparate for work orders)"),
      key_ref: z.string().describe("Key reference to the parent entity (e.g. 'WO_NO=750^' for a work order)"),
      file_name: z.string().optional().describe("File name if attaching a file reference"),
    },
    async ({ doc_class, doc_no, title, entity_type, key_ref, file_name }) => {
      const payload: Record<string, any> = {
        DocClass: doc_class,
        DocNo: doc_no,
        Title: title,
        LuName: entity_type,
        KeyRef: key_ref,
      }
      if (file_name) payload.FileName = file_name

      await ifsPost(IFS_PROJECTIONS.documents, payload)

      return {
        content: [{ type: "text", text: `Document attached: "${title}" (${doc_class}) to ${entity_type} [${key_ref}].` }],
      }
    },
  )
}
