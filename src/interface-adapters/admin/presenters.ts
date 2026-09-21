// What the admin controllers share at the boundary (ADR-031): the admin log entry and the
// anchor diagnostic as the contract publishes them — instants as text, optional fields only
// when present, never the merchant of a diagnostic (the path names it).
import type { AdminEntry, AdminResult, AnchorDiagnostic } from "../../domain/admin/index.js";
import type { components } from "../http/typed.js";

type AdminEntryDto = components["schemas"]["AdminEntry"];
type AdminResultDto = components["schemas"]["AdminResult"];
type AnchorDiagnosticDto = components["schemas"]["AnchorDiagnostic"];

/** Only the fields the action produced. */
function resultDto(result: AdminResult): AdminResultDto {
  return {
    ...(result.configurationVersion === undefined
      ? {}
      : { configurationVersion: result.configurationVersion }),
    ...(result.experimentId === undefined ? {} : { experimentId: result.experimentId }),
    ...(result.windowRestarted === undefined ? {} : { windowRestarted: result.windowRestarted }),
  };
}

/** The entry as the contract publishes it: instants as text, optional fields only when present. */
export function adminEntryDto(entry: AdminEntry): AdminEntryDto {
  return {
    at: entry.at.toISOString(),
    operatorId: entry.operatorId,
    operation: entry.operation,
    outcome: entry.outcome,
    ...(entry.merchantId === undefined ? {} : { merchantId: entry.merchantId }),
    ...(entry.code === undefined ? {} : { code: entry.code }),
    ...(entry.result === undefined ? {} : { result: resultDto(entry.result) }),
    ...(entry.reason === undefined ? {} : { reason: entry.reason }),
  };
}

/** The diagnostic as the contract publishes it: never the merchant (the path names it). */
export function anchorDiagnosticDto(diagnostic: AnchorDiagnostic): AnchorDiagnosticDto {
  return {
    anchor: diagnostic.anchor,
    pageType: diagnostic.pageType as AnchorDiagnosticDto["pageType"],
    ...(diagnostic.configurationVersion === undefined
      ? {}
      : { configurationVersion: diagnostic.configurationVersion }),
    lastSeenAt: diagnostic.lastSeenAt.toISOString(),
    count: diagnostic.count,
  };
}
