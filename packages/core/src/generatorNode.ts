import { writeFileSync } from "node:fs";
import type { PopulationRecord } from "./generator";
import { populationToCsv } from "./generator";

export function writePopulationCsv(records: PopulationRecord[], outputFields: string[], outputPath: string): void {
  const csv = populationToCsv(records, outputFields);
  writeFileSync(outputPath, csv, "utf8");
}
