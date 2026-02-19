export const PROJECTION_BASE = "/main/ifsapplications/projection/v1"

export const IFS_PROJECTIONS = {
  workOrders: `${PROJECTION_BASE}/ActiveWorkOrdersHandling.svc/ActiveSeparateSet`,
  workOrdersPrepare: `${PROJECTION_BASE}/PrepareWorkOrderHandling.svc/ActiveSeparateSet`,
  workTasks: `${PROJECTION_BASE}/WorkTaskHandling.svc/JtTaskSet`,
  workTaskSteps: `${PROJECTION_BASE}/WorkTaskStepsHandling.svc/JtTaskStepSet`,
  taskCostLines: `${PROJECTION_BASE}/WorkTaskHandling.svc/JtTaskCostLineSet`,
  materialRequisitions: `${PROJECTION_BASE}/WorkTaskHandling.svc/MaintMaterialRequisitionSet`,
  faultReports: `${PROJECTION_BASE}/FaultReportHandling.svc/ActiveSeparateSet`,
  assets: `${PROJECTION_BASE}/EquipmentAllObjectsHandling.svc/EquipmentObjectListSet`,
  functionalObjects: `${PROJECTION_BASE}/FunctionalObjectHandling.svc/EquipmentFunctionalSet`,
  persons: `${PROJECTION_BASE}/PersonHandling.svc/PersonInfoSet`,
  inventoryParts: `${PROJECTION_BASE}/InventoryPartHandling.svc/InventoryPartSet`,
  sites: `${PROJECTION_BASE}/CompanySiteHandling.svc/SiteSet`,
  customers: `${PROJECTION_BASE}/CustomerHandling.svc/CustomerInfoSet`,
  serviceContracts: `${PROJECTION_BASE}/ServiceContractHandling.svc/ScServiceContractSet`,
  meterReadings: `${PROJECTION_BASE}/ObjectMeasurementService.svc`,
  documents: `${PROJECTION_BASE}/CreateAndImportDocument.svc`,
} as const

export const STATUS_TO_IFS: Record<string, string> = {
  pending: "Released",
  assigned: "Released",
  in_progress: "Started",
  on_hold: "Parked",
  completed: "Work Done",
  cancelled: "Cancelled",
}

export const STATUS_FROM_IFS: Record<string, string> = {
  PREPARED: "pending",
  Prepared: "pending",
  WORKREQUEST: "pending",
  UNDERPREPARATION: "pending",
  FAULTREPORT: "pending",
  RELEASED: "assigned",
  Released: "assigned",
  STARTED: "in_progress",
  Started: "in_progress",
  PARKED: "on_hold",
  Parked: "on_hold",
  WORKDONE: "completed",
  "Work Done": "completed",
  REPORTED: "completed",
  Reported: "completed",
  FINISHED: "completed",
  Finished: "completed",
  CANCELLED: "cancelled",
  Cancelled: "cancelled",
}

export const PRIORITY_TO_IFS: Record<string, string> = {
  critical: "1",
  high: "2",
  medium: "3",
  low: "4",
}

export const PRIORITY_FROM_IFS: Record<string, string> = {
  "1": "critical",
  "2": "high",
  "3": "medium",
  "4": "low",
}

export const WORK_TYPE_FROM_IFS: Record<string, string> = {
  "10": "emergency",
  "20": "corrective",
  "40": "preventive",
  "45": "inspection",
  "50": "preventive",
  "70": "calibration",
  "80": "inspection",
}

export const WORK_TYPE_TO_IFS: Record<string, string> = {
  emergency: "10",
  corrective: "20",
  preventive: "40",
  inspection: "45",
  calibration: "70",
}

export const ASSET_STATUS_FROM_IFS: Record<string, string> = {
  InOperation: "operational",
  IN_OPERATION: "operational",
  OutOfOperation: "offline",
  OUT_OF_OPERATION: "offline",
  Scrapped: "decommissioned",
  SCRAPPED: "decommissioned",
  UnderRepair: "maintenance",
  UNDER_REPAIR: "maintenance",
  Planned: "offline",
  PLANNED: "offline",
}

export const WO_SELECT_FIELDS = [
  "WoNo",
  "ErrDescr",
  "ErrDescrLo",
  "WorkTypeId",
  "Objstate",
  "PriorityId",
  "MchCode",
  "MchCodeDescription",
  "Contract",
  "Company",
  "OrgCode",
  "PlanSDate",
  "PlanFDate",
  "RealSDate",
  "RealFDate",
  "EarliestStartDate",
  "ReportedBy",
  "RegDate",
  "WOSiteDesc",
  "Criticality",
].join(",")
