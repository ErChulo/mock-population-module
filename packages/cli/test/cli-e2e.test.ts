import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCli } from "../src/index";

describe("CLI generate", () => {
  it("runs end-to-end and produces outputs matching metadata hashes", async () => {
    const root = path.resolve(__dirname, "../../..");
    const outdir = mkdtempSync(path.join(tmpdir(), "mockgen-cli-"));

    const code = await runCli([
      "generate",
      "--dd",
      path.join(root, "packages/examples/dd-subset.csv"),
      "--nonempty",
      path.join(root, "packages/examples/nonempty.valid.json"),
      "--config",
      path.join(root, "packages/examples/config.json"),
      "--outdir",
      outdir,
      "--seed",
      "555"
    ]);

    expect(code).toBe(0);

    const cleanPath = path.join(outdir, "population.clean.csv");
    const dirtyPath = path.join(outdir, "population.dirty.csv");
    const metadataPath = path.join(outdir, "metadata.json");

    const clean = readFileSync(cleanPath, "utf8");
    const dirty = readFileSync(dirtyPath, "utf8");
    const cleanTsvPath = path.join(outdir, "population.clean.tsv");
    const dirtyTsvPath = path.join(outdir, "population.dirty.tsv");
    const cleanSqlPath = path.join(outdir, "population.clean.sql");
    const dirtySqlPath = path.join(outdir, "population.dirty.sql");
    const cleanXlsxPath = path.join(outdir, "population.clean.xlsx");
    const dirtyXlsxPath = path.join(outdir, "population.dirty.xlsx");
    const cleanDbPath = path.join(outdir, "population.clean.db");
    const dirtyDbPath = path.join(outdir, "population.dirty.db");
    const summaryPath = path.join(outdir, "summary.txt");

    const cleanTsv = readFileSync(cleanTsvPath, "utf8");
    const dirtyTsv = readFileSync(dirtyTsvPath, "utf8");
    const cleanSql = readFileSync(cleanSqlPath, "utf8");
    const dirtySql = readFileSync(dirtySqlPath, "utf8");
    const cleanXlsx = readFileSync(cleanXlsxPath);
    const dirtyXlsx = readFileSync(dirtyXlsxPath);
    const cleanDb = readFileSync(cleanDbPath);
    const dirtyDb = readFileSync(dirtyDbPath);
    const summaryTxt = readFileSync(summaryPath, "utf8");
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as {
      seed: number;
      outputFileHashes: Record<string, string>;
    };

    expect(clean.length).toBeGreaterThan(0);
    expect(dirty.length).toBeGreaterThan(0);
    expect(metadata.seed).toBe(555);
    expect(metadata.outputFileHashes["population.clean.csv"]).toBe(sha256(clean));
    expect(metadata.outputFileHashes["population.dirty.csv"]).toBe(sha256(dirty));
    expect(metadata.outputFileHashes["population.clean.tsv"]).toBe(sha256(cleanTsv));
    expect(metadata.outputFileHashes["population.dirty.tsv"]).toBe(sha256(dirtyTsv));
    expect(metadata.outputFileHashes["population.clean.sql"]).toBe(sha256(cleanSql));
    expect(metadata.outputFileHashes["population.dirty.sql"]).toBe(sha256(dirtySql));
    expect(metadata.outputFileHashes["population.clean.xlsx"]).toBe(sha256(cleanXlsx));
    expect(metadata.outputFileHashes["population.dirty.xlsx"]).toBe(sha256(dirtyXlsx));
    expect(metadata.outputFileHashes["population.clean.db"]).toBe(sha256(cleanDb));
    expect(metadata.outputFileHashes["population.dirty.db"]).toBe(sha256(dirtyDb));
    expect(metadata.outputFileHashes["summary.txt"]).toBe(sha256(summaryTxt));
  });
});

function sha256(value: string | Buffer): string {
  const hash = createHash("sha256");
  if (typeof value === "string") {
    hash.update(value, "utf8");
  } else {
    hash.update(value);
  }
  return hash.digest("hex");
}
