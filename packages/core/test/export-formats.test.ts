import { createHash } from "node:crypto";
import {
  generateCleanPopulation,
  populationToSql,
  populationToTsv,
  populationToXlsxBuffer,
  type FieldCatalog,
  type GeneratorConfig,
  type NonEmptyFields
} from "../src";

const fields = ["Cust_ID", "ID", "RETSTAT", "DOB", "DOH", "DOP", "DOTE", "DOR"];
const fieldCatalog: FieldCatalog = { fields: fields.map((name) => ({ name })) };
const nonEmptyFields: NonEmptyFields = { fields: [...fields] };
const config: GeneratorConfig = {
  seed: 1111,
  rowCount: 15,
  scenarioMix: { participant_in_pay: 1 },
  planTerminationDate: "2026-12-31",
  requiredBeginningAge: 73,
  normalRetirementAge: 65,
  planYearStartMonthDay: "01-01"
};

describe("export formats", () => {
  it("creates deterministic TSV, SQL, and XLSX bytes", () => {
    const records = generateCleanPopulation(fieldCatalog, nonEmptyFields, config);

    const tsv1 = populationToTsv(records, fields);
    const tsv2 = populationToTsv(records, fields);
    expect(tsv1).toBe(tsv2);
    expect(sha256(tsv1)).toBe(sha256(tsv2));

    const sql1 = populationToSql(records, fields, "population_clean");
    const sql2 = populationToSql(records, fields, "population_clean");
    expect(sql1).toBe(sql2);
    expect(sql1.startsWith('CREATE TABLE "population_clean"')).toBe(true);
    expect(sha256(sql1)).toBe(sha256(sql2));

    const xlsx1 = populationToXlsxBuffer(records, fields);
    const xlsx2 = populationToXlsxBuffer(records, fields);
    expect(Buffer.compare(xlsx1, xlsx2)).toBe(0);
    expect(sha256(xlsx1)).toBe(sha256(xlsx2));
  });
});

function sha256(value: string | Uint8Array): string {
  const hash = createHash("sha256");
  if (typeof value === "string") {
    hash.update(value, "utf8");
  } else {
    hash.update(value);
  }
  return hash.digest("hex");
}
