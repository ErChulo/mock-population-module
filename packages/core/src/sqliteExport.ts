import initSqlJs from "sql.js";
import type { PopulationRecord } from "./generator";

export async function populationToSqliteBuffer(
  records: PopulationRecord[],
  outputFields: string[],
  tableName = "population"
): Promise<Uint8Array> {
  const SQL = await initSqlJs({
    locateFile: (file) => {
      if (file === "sql-wasm.wasm") {
        return require.resolve("sql.js/dist/sql-wasm.wasm");
      }
      return file;
    }
  });

  const db = new SQL.Database();
  const createSql = `CREATE TABLE "${tableName}" (${outputFields.map((field) => `"${field}" TEXT`).join(", ")});`;
  db.run(createSql);

  const placeholders = outputFields.map(() => "?").join(", ");
  const insertSql = `INSERT INTO "${tableName}" (${outputFields.map((field) => `"${field}"`).join(", ")}) VALUES (${placeholders});`;
  const stmt = db.prepare(insertSql);
  for (const record of records) {
    stmt.run(outputFields.map((field) => record[field] ?? ""));
  }
  stmt.free();

  const bytes = db.export();
  db.close();
  return bytes;
}
