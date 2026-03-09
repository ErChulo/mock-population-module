import { GENERATOR_VERSION } from "./version";
import type { DirtyInjectionMetadata, GeneratorConfig, PopulationRecord } from "./generator";

export interface ReportBuildArgs {
  config: GeneratorConfig;
  cleanRecords: PopulationRecord[];
  dirtyRecords: PopulationRecord[];
  dirtyMetadata: DirtyInjectionMetadata;
}

export function buildTextReport(args: ReportBuildArgs): string {
  const scenarioCounts = deriveScenarioCounts(args.cleanRecords);
  const issueSummaries = [...args.dirtyMetadata.summaries].sort((a, b) => a.issueType.localeCompare(b.issueType));

  const lines: string[] = [];
  lines.push("CaseWorkbench Mock Population Summary");
  lines.push(`Generator Version: ${GENERATOR_VERSION}`);
  lines.push(`Seed: ${args.config.seed}`);
  lines.push(`Row Count (Clean): ${args.cleanRecords.length}`);
  lines.push(`Row Count (Dirty): ${args.dirtyRecords.length}`);
  lines.push("");
  lines.push("Scenario Counts:");
  for (const key of Object.keys(scenarioCounts).sort((a, b) => a.localeCompare(b))) {
    lines.push(`- ${key}: ${scenarioCounts[key]}`);
  }
  lines.push("");
  lines.push("Injected Issue Counts:");
  if (issueSummaries.length === 0) {
    lines.push("- none: 0");
  } else {
    for (const summary of issueSummaries) {
      lines.push(`- ${summary.issueType}: ${summary.actualCount}`);
      lines.push(`  Cust_ID: ${summary.affectedCustIds.slice().sort((a, b) => a.localeCompare(b)).join(", ") || "none"}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function deriveScenarioCounts(records: PopulationRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    const scenario = inferScenario(record);
    counts[scenario] = (counts[scenario] ?? 0) + 1;
  }
  return counts;
}

function inferScenario(record: PopulationRecord): string {
  if (record.RETSTAT === "5") return "excluded";
  if (record.ID === "2") return "beneficiary_in_pay";
  if (record.ID === "4") return "alternate_payee_in_pay";
  if (record.ID === "1" && record.LS_EST_AMT && Number(record.LS_EST_AMT) > 0) return "de_minimis_lump_sum";
  if (record.ID === "1" && record.RETSTAT === "1") return "participant_in_pay";
  if (record.ID === "1" && record.RETSTAT === "2") return "participant_deferred_vested";
  if (record.ID === "1" && record.RETSTAT === "3") return "participant_active_vested";
  if (record.ID === "1" && record.RETSTAT === "4") return "participant_not_vested";
  return "unknown";
}
