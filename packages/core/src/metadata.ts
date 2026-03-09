import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { GENERATOR_VERSION } from "./version";
import type { DirtyInjectionMetadata, GeneratorConfig, PopulationRecord } from "./generator";

export interface MetadataIssueSummary {
  issueType: string;
  count: number;
  affectedCustIds: string[];
}

export interface GeneratorMetadata {
  GENERATOR_VERSION: string;
  generatorVersion: string;
  seed: number;
  inputFileHashes: Record<string, string>;
  outputFileHashes: Record<string, string>;
  rowCounts: {
    clean: number;
    dirty: number;
  };
  scenarioCounts: Record<string, number>;
  injectedIssueCounts: Record<string, number>;
  injectedIssues: MetadataIssueSummary[];
}

export interface MetadataBuildArgs {
  config: GeneratorConfig;
  cleanRecords: PopulationRecord[];
  dirtyRecords: PopulationRecord[];
  dirtyMetadata: DirtyInjectionMetadata;
  inputArtifacts: Record<string, string | Uint8Array>;
  outputArtifacts: Record<string, string | Uint8Array>;
}

export function buildMetadata(args: MetadataBuildArgs): GeneratorMetadata {
  const issueSummaries = args.dirtyMetadata.summaries.map((summary) => ({
    issueType: summary.issueType,
    count: summary.actualCount,
    affectedCustIds: [...summary.affectedCustIds].sort()
  }));

  return {
    GENERATOR_VERSION,
    generatorVersion: GENERATOR_VERSION,
    seed: args.config.seed,
    inputFileHashes: hashArtifactMap(args.inputArtifacts),
    outputFileHashes: hashArtifactMap(args.outputArtifacts),
    rowCounts: {
      clean: args.cleanRecords.length,
      dirty: args.dirtyRecords.length
    },
    scenarioCounts: deriveScenarioCounts(args.cleanRecords),
    injectedIssueCounts: normalizeCounts(args.dirtyMetadata.issueCounts),
    injectedIssues: issueSummaries.sort((a, b) => a.issueType.localeCompare(b.issueType))
  };
}

export function metadataToJson(metadata: GeneratorMetadata): string {
  return `${stableStringify(metadata)}\n`;
}

export function writeMetadataJson(metadata: GeneratorMetadata, outputPath: string): void {
  writeFileSync(outputPath, metadataToJson(metadata), "utf8");
}

export function hashFile(path: string): string {
  return sha256(readFileSync(path));
}

export function hashContent(content: string | Uint8Array): string {
  if (typeof content === "string") {
    return sha256(content);
  }
  return sha256(content);
}

function hashArtifactMap(artifacts: Record<string, string | Uint8Array>): Record<string, string> {
  const sorted = Object.keys(artifacts).sort((a, b) => a.localeCompare(b));
  const hashes: Record<string, string> = {};
  for (const name of sorted) {
    hashes[name] = hashContent(artifacts[name]);
  }
  return hashes;
}

function normalizeCounts(counts: Partial<Record<string, number>>): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const key of Object.keys(counts).sort((a, b) => a.localeCompare(b))) {
    normalized[key] = counts[key] ?? 0;
  }
  return normalized;
}

function deriveScenarioCounts(records: PopulationRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    const scenario = inferScenario(record);
    counts[scenario] = (counts[scenario] ?? 0) + 1;
  }
  return Object.keys(counts)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, number>>((acc, key) => {
      acc[key] = counts[key];
      return acc;
    }, {});
}

function inferScenario(record: PopulationRecord): string {
  if (record.RETSTAT === "5") {
    return "excluded";
  }
  if (record.ID === "2") {
    return "beneficiary_in_pay";
  }
  if (record.ID === "4") {
    return "alternate_payee_in_pay";
  }
  if (record.ID === "1" && record.LS_EST_AMT && Number(record.LS_EST_AMT) > 0) {
    return "de_minimis_lump_sum";
  }
  if (record.ID === "1" && record.RETSTAT === "1") {
    return "participant_in_pay";
  }
  if (record.ID === "1" && record.RETSTAT === "2") {
    return "participant_deferred_vested";
  }
  if (record.ID === "1" && record.RETSTAT === "3") {
    return "participant_active_vested";
  }
  if (record.ID === "1" && record.RETSTAT === "4") {
    return "participant_not_vested";
  }
  return "unknown";
}

function sha256(content: string | Uint8Array): string {
  const hash = createHash("sha256");
  if (typeof content === "string") {
    hash.update(content, "utf8");
  } else {
    hash.update(content);
  }
  return hash.digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue).sort((a, b) => a.localeCompare(b));
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`);
  return `{${entries.join(",")}}`;
}
