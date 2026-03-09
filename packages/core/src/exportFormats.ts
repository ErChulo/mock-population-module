import { writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import type { PopulationRecord } from "./generator";

export function populationToTsv(records: PopulationRecord[], outputFields: string[]): string {
  return populationToDelimited(records, outputFields, "\t");
}

export function populationToSql(records: PopulationRecord[], outputFields: string[], tableName = "population"): string {
  const quotedColumns = outputFields.map((column) => `"${column}"`).join(", ");
  const create = `CREATE TABLE "${tableName}" (${outputFields.map((column) => `"${column}" TEXT`).join(", ")});`;
  const inserts = records.map((record) => {
    const values = outputFields.map((field) => sqlString(record[field] ?? "")).join(", ");
    return `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${values});`;
  });
  return [create, ...inserts].join("\n");
}

export function populationToXlsxBuffer(records: PopulationRecord[], outputFields: string[]): Buffer {
  const rows = records.map((record) =>
    outputFields.reduce<Record<string, string>>((acc, field) => {
      acc[field] = record[field] ?? "";
      return acc;
    }, {})
  );
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Author: "caseworkbench-mockgen",
    CreatedDate: new Date(Date.UTC(2000, 0, 1)),
    ModifiedDate: new Date(Date.UTC(2000, 0, 1))
  };
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: outputFields, skipHeader: false });
  XLSX.utils.book_append_sheet(workbook, worksheet, "Population");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
}

export function writeBufferFile(outputPath: string, bytes: Uint8Array): void {
  writeFileSync(outputPath, bytes);
}

function populationToDelimited(records: PopulationRecord[], outputFields: string[], delimiter: "," | "\t"): string {
  const escape = delimiter === "," ? escapeCsv : escapeTsv;
  const header = outputFields.map(escape).join(delimiter);
  const rows = records.map((record) => outputFields.map((field) => escape(record[field] ?? "")).join(delimiter));
  return [header, ...rows].join("\n");
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function escapeTsv(value: string): string {
  if (value.includes("\t") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
