import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";

export type InferredType = "string" | "number" | "integer" | "boolean" | "date";

export interface FieldDefinition {
  name: string;
  inferredType?: InferredType;
  description?: string;
}

export interface FieldCatalog {
  fields: FieldDefinition[];
}

export type PathOrBytes = string | Uint8Array;

const FIELD_NAME_CANDIDATES = ["field", "fieldname", "field_name", "name", "column", "columnname"];
const TYPE_CANDIDATES = ["type", "datatype", "data_type"];
const DESCRIPTION_CANDIDATES = ["description", "desc", "definition"];

export function parseDDCsv(pathOrBytes: PathOrBytes): FieldCatalog {
  const csvText = loadCsvText(pathOrBytes);
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    throw new Error("DD.csv must include a header row and at least one field row.");
  }

  const header = rows[0].map((value) => value.trim().toLowerCase());
  const fieldNameIndex = resolveHeaderIndex(header, FIELD_NAME_CANDIDATES);
  if (fieldNameIndex === -1) {
    throw new Error("DD.csv is missing a field name column.");
  }

  const typeIndex = resolveHeaderIndex(header, TYPE_CANDIDATES);
  const descriptionIndex = resolveHeaderIndex(header, DESCRIPTION_CANDIDATES);

  const fields: FieldDefinition[] = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const name = (row[fieldNameIndex] ?? "").trim();
    if (!name) {
      continue;
    }

    const explicitType = typeIndex === -1 ? "" : (row[typeIndex] ?? "").trim();
    const description = descriptionIndex === -1 ? "" : (row[descriptionIndex] ?? "").trim();
    const inferredType = inferType(name, explicitType, description);

    fields.push({
      name,
      ...(inferredType ? { inferredType } : {}),
      ...(description ? { description } : {})
    });
  }

  const fieldCatalog: FieldCatalog = { fields };
  validateFieldCatalog(fieldCatalog);
  return fieldCatalog;
}

export function validateFieldCatalog(
  fieldCatalog: FieldCatalog,
  schemaPath: string = resolveFieldCatalogSchemaPath()
): void {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const validate = ajv.compile<FieldCatalog>(schema);
  const valid = validate(fieldCatalog);
  if (!valid) {
    throw new Error(formatAjvErrors(validate.errors ?? []));
  }
}

export function inferType(name: string, explicitType = "", description = ""): InferredType | undefined {
  const explicit = normalizeType(explicitType);
  if (explicit) {
    return explicit;
  }

  const haystack = `${name} ${description}`.toLowerCase();
  if (/(^|[_\s])(dob|doh|dor|dote|dod)([_\s]|$)/.test(haystack) || /\bdate\b/.test(haystack)) {
    return "date";
  }
  if (/\bflag\b/.test(haystack) || /(^|[_\s])(is|has)_/.test(haystack)) {
    return "boolean";
  }
  if (/\b(age|count|num|number|years?)\b/.test(haystack)) {
    return "integer";
  }
  if (/\b(amt|amount|balance|pay|benefit|rate)\b/.test(haystack)) {
    return "number";
  }
  return "string";
}

function normalizeType(value: string): InferredType | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (["string", "text", "char", "varchar", "nvarchar"].includes(normalized)) {
    return "string";
  }
  if (["integer", "int", "bigint", "smallint"].includes(normalized)) {
    return "integer";
  }
  if (["number", "numeric", "decimal", "float", "double", "money"].includes(normalized)) {
    return "number";
  }
  if (["boolean", "bool", "bit", "yn"].includes(normalized)) {
    return "boolean";
  }
  if (["date", "datetime", "timestamp"].includes(normalized)) {
    return "date";
  }
  return undefined;
}

function loadCsvText(pathOrBytes: PathOrBytes): string {
  if (typeof pathOrBytes === "string") {
    return readFileSync(pathOrBytes, "utf8");
  }
  return new TextDecoder("utf-8").decode(pathOrBytes);
}

function resolveHeaderIndex(header: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const index = header.indexOf(candidate);
    if (index !== -1) {
      return index;
    }
  }
  return -1;
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

function resolveFieldCatalogSchemaPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "packages/schemas/FieldCatalog.schema.json"),
    path.resolve(__dirname, "../../schemas/FieldCatalog.schema.json"),
    path.resolve(__dirname, "../../../schemas/FieldCatalog.schema.json")
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("Unable to locate FieldCatalog.schema.json");
}

function formatAjvErrors(errors: ErrorObject[]): string {
  const details = errors.map((error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`);
  return `FieldCatalog validation failed: ${details.join("; ")}`;
}
