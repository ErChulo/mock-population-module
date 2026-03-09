import {
  generateCleanPopulation,
  generateDirtyPopulation,
  populationToCsv,
  type GeneratorConfig
} from "../../core/src/generator";
import type { FieldCatalog } from "../../core/src/ddCsv";
import type { NonEmptyFields } from "../../core/src/nonEmptyFields";
import { GENERATOR_VERSION } from "../../core/src/version";

export interface BrowserArtifacts {
  cleanCsv: string;
  dirtyCsv: string;
  metadataJson: string;
}

export async function generateArtifactsBrowser(
  ddCsvText: string,
  nonEmptyText: string,
  configText: string,
  seedOverride?: number
): Promise<BrowserArtifacts> {
  const fieldCatalog = parseDdCsvText(ddCsvText);
  const config = parseConfig(configText, seedOverride);
  const nonEmpty = parseNonEmpty(nonEmptyText, fieldCatalog);

  const cleanRecords = generateCleanPopulation(fieldCatalog, nonEmpty, config);
  const dirty = generateDirtyPopulation(cleanRecords, nonEmpty, config);
  const cleanCsv = populationToCsv(cleanRecords, nonEmpty.fields);
  const dirtyCsv = populationToCsv(dirty.records, nonEmpty.fields);

  const metadata = {
    GENERATOR_VERSION,
    generatorVersion: GENERATOR_VERSION,
    seed: config.seed,
    inputFileHashes: sortRecord({
      "DD.csv": await sha256Hex(ddCsvText),
      "config.json": await sha256Hex(configText),
      "nonempty.json": await sha256Hex(nonEmptyText)
    }),
    outputFileHashes: {
      "population.clean.csv": await sha256Hex(cleanCsv),
      "population.dirty.csv": await sha256Hex(dirtyCsv)
    },
    rowCounts: {
      clean: cleanRecords.length,
      dirty: dirty.records.length
    },
    scenarioCounts: deriveScenarioCounts(cleanRecords),
    injectedIssueCounts: Object.keys(dirty.metadata.issueCounts)
      .sort((a, b) => a.localeCompare(b))
      .reduce<Record<string, number>>((acc, key) => {
        acc[key] = dirty.metadata.issueCounts[key as keyof typeof dirty.metadata.issueCounts] ?? 0;
        return acc;
      }, {}),
    injectedIssues: dirty.metadata.summaries
      .map((summary) => ({
        issueType: summary.issueType,
        count: summary.actualCount,
        affectedCustIds: [...summary.affectedCustIds].sort()
      }))
      .sort((a, b) => a.issueType.localeCompare(b.issueType))
  };

  return {
    cleanCsv,
    dirtyCsv,
    metadataJson: `${JSON.stringify(metadata, null, 2)}\n`
  };
}

function parseConfig(configText: string, seedOverride?: number): GeneratorConfig {
  const config = JSON.parse(configText) as GeneratorConfig;
  return seedOverride === undefined ? config : { ...config, seed: seedOverride };
}

function parseNonEmpty(nonEmptyText: string, fieldCatalog: FieldCatalog): NonEmptyFields {
  const parsed = JSON.parse(nonEmptyText) as NonEmptyFields;
  if (!Array.isArray(parsed.fields) || parsed.fields.length === 0) {
    throw new Error("nonempty.json must include a non-empty fields array.");
  }
  const seen = new Set<string>();
  for (const field of parsed.fields) {
    if (seen.has(field)) {
      throw new Error(`Duplicate field in nonempty.json: ${field}`);
    }
    seen.add(field);
  }
  const known = new Set(fieldCatalog.fields.map((field) => field.name));
  for (const field of parsed.fields) {
    if (!known.has(field)) {
      throw new Error(`Unknown nonempty field: ${field}`);
    }
  }
  return parsed;
}

function parseDdCsvText(csvText: string): FieldCatalog {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    throw new Error("DD.csv must have header and at least one data row.");
  }
  const header = rows[0].map((v) => v.trim().toLowerCase());
  const nameIdx = resolveHeaderIndex(header, ["field", "fieldname", "field_name", "name", "column", "columnname"]);
  if (nameIdx === -1) {
    throw new Error("DD.csv is missing field name column.");
  }
  const typeIdx = resolveHeaderIndex(header, ["type", "datatype", "data_type"]);
  const descIdx = resolveHeaderIndex(header, ["description", "desc", "definition"]);
  const fields = rows
    .slice(1)
    .map((row) => {
      const name = (row[nameIdx] ?? "").trim();
      if (!name) {
        return null;
      }
      const description = descIdx === -1 ? "" : (row[descIdx] ?? "").trim();
      return {
        name,
        inferredType: inferType(name, typeIdx === -1 ? "" : (row[typeIdx] ?? "").trim(), description),
        ...(description ? { description } : {})
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  return { fields };
}

function inferType(name: string, explicitType = "", description = ""): "string" | "number" | "integer" | "boolean" | "date" {
  const normalized = explicitType.trim().toLowerCase();
  if (["string", "text", "char", "varchar", "nvarchar"].includes(normalized)) return "string";
  if (["integer", "int", "bigint", "smallint"].includes(normalized)) return "integer";
  if (["number", "numeric", "decimal", "float", "double", "money"].includes(normalized)) return "number";
  if (["boolean", "bool", "bit", "yn"].includes(normalized)) return "boolean";
  if (["date", "datetime", "timestamp"].includes(normalized)) return "date";

  const haystack = `${name} ${description}`.toLowerCase();
  if (/(^|[_\s])(dob|doh|dor|dote|dod)([_\s]|$)/.test(haystack) || /\bdate\b/.test(haystack)) return "date";
  if (/\bflag\b/.test(haystack) || /(^|[_\s])(is|has)_/.test(haystack)) return "boolean";
  if (/\b(age|count|num|number|years?)\b/.test(haystack)) return "integer";
  if (/\b(amt|amount|balance|pay|benefit|rate)\b/.test(haystack)) return "number";
  return "string";
}

function parseCsvRows(csvText: string): string[][] {
  const normalized = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === "\"") {
        const next = normalized[i + 1];
        if (next === "\"") {
          cell += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === "\"") {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }
  return rows;
}

function resolveHeaderIndex(header: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = header.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

function deriveScenarioCounts(records: Array<Record<string, string>>): Record<string, number> {
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

function inferScenario(record: Record<string, string>): string {
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

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sortRecord(values: Record<string, string>): Record<string, string> {
  return Object.keys(values)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = values[key];
      return acc;
    }, {});
}
