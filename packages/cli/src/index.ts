import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildMetadata,
  buildTextReport,
  generateCleanPopulation,
  generateDirtyPopulation,
  metadataToJson,
  parseDDCsv,
  populationToCsv,
  populationToSqliteBuffer,
  populationToSql,
  populationToTsv,
  populationToXlsxBuffer,
  validateNonEmptyFields,
  writeBufferFile,
  type GeneratorConfig,
  type NonEmptyFields
} from "@caseworkbench/core";

interface GenerateCommandArgs {
  dd: string;
  nonempty: string;
  config: string;
  outdir: string;
  seed?: number;
}

export async function runCli(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command !== "generate") {
    printUsage();
    return 1;
  }

  const args = parseGenerateArgs(rest);
  const config = loadConfig(args.config, args.seed);
  const nonEmptyJson = readFileSync(args.nonempty);
  const nonEmpty = validateNonEmptyFields(nonEmptyJson, parseDDCsv(args.dd));

  const cleanRecords = generateCleanPopulation(parseDDCsv(args.dd), nonEmpty, config);
  const dirty = generateDirtyPopulation(cleanRecords, nonEmpty, config);

  const cleanCsv = populationToCsv(cleanRecords, nonEmpty.fields);
  const dirtyCsv = populationToCsv(dirty.records, nonEmpty.fields);
  const cleanTsv = populationToTsv(cleanRecords, nonEmpty.fields);
  const dirtyTsv = populationToTsv(dirty.records, nonEmpty.fields);
  const cleanSql = populationToSql(cleanRecords, nonEmpty.fields, "population_clean");
  const dirtySql = populationToSql(dirty.records, nonEmpty.fields, "population_dirty");
  const cleanXlsx = populationToXlsxBuffer(cleanRecords, nonEmpty.fields);
  const dirtyXlsx = populationToXlsxBuffer(dirty.records, nonEmpty.fields);
  const cleanDb = await populationToSqliteBuffer(cleanRecords, nonEmpty.fields, "population_clean");
  const dirtyDb = await populationToSqliteBuffer(dirty.records, nonEmpty.fields, "population_dirty");
  const summaryTxt = buildTextReport({
    config,
    cleanRecords,
    dirtyRecords: dirty.records,
    dirtyMetadata: dirty.metadata
  });
  const metadata = buildMetadata({
    config,
    cleanRecords,
    dirtyRecords: dirty.records,
    dirtyMetadata: dirty.metadata,
    inputArtifacts: {
      "DD.csv": readFileSync(args.dd),
      "nonempty.json": nonEmptyJson,
      "config.json": readFileSync(args.config)
    },
    outputArtifacts: {
      "population.clean.csv": cleanCsv,
      "population.dirty.csv": dirtyCsv,
      "population.clean.tsv": cleanTsv,
      "population.dirty.tsv": dirtyTsv,
      "population.clean.sql": cleanSql,
      "population.dirty.sql": dirtySql,
      "population.clean.xlsx": cleanXlsx,
      "population.dirty.xlsx": dirtyXlsx,
      "population.clean.db": cleanDb,
      "population.dirty.db": dirtyDb,
      "summary.txt": summaryTxt
    }
  });

  mkdirSync(args.outdir, { recursive: true });
  writeFileSync(path.join(args.outdir, "population.clean.csv"), cleanCsv, "utf8");
  writeFileSync(path.join(args.outdir, "population.dirty.csv"), dirtyCsv, "utf8");
  writeFileSync(path.join(args.outdir, "population.clean.tsv"), cleanTsv, "utf8");
  writeFileSync(path.join(args.outdir, "population.dirty.tsv"), dirtyTsv, "utf8");
  writeFileSync(path.join(args.outdir, "population.clean.sql"), cleanSql, "utf8");
  writeFileSync(path.join(args.outdir, "population.dirty.sql"), dirtySql, "utf8");
  writeBufferFile(path.join(args.outdir, "population.clean.xlsx"), cleanXlsx);
  writeBufferFile(path.join(args.outdir, "population.dirty.xlsx"), dirtyXlsx);
  writeBufferFile(path.join(args.outdir, "population.clean.db"), cleanDb);
  writeBufferFile(path.join(args.outdir, "population.dirty.db"), dirtyDb);
  writeFileSync(path.join(args.outdir, "summary.txt"), summaryTxt, "utf8");
  writeFileSync(path.join(args.outdir, "metadata.json"), metadataToJson(metadata), "utf8");
  return 0;
}

function parseGenerateArgs(tokens: string[]): GenerateCommandArgs {
  const options: Record<string, string> = {};
  for (let i = 0; i < tokens.length; i += 2) {
    const key = tokens[i];
    const value = tokens[i + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("Invalid arguments.");
    }
    options[key.slice(2)] = value;
  }

  if (!options.dd || !options.nonempty || !options.config || !options.outdir) {
    throw new Error("Missing required arguments: --dd --nonempty --config --outdir");
  }

  return {
    dd: options.dd,
    nonempty: options.nonempty,
    config: options.config,
    outdir: options.outdir,
    ...(options.seed ? { seed: Number(options.seed) } : {})
  };
}

function loadConfig(configPath: string, overrideSeed?: number): GeneratorConfig {
  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as GeneratorConfig;
  return overrideSeed === undefined ? parsed : { ...parsed, seed: overrideSeed };
}

function printUsage(): void {
  // eslint-disable-next-line no-console
  console.error(
    "Usage: caseworkbench-mockgen generate --dd DD.csv --nonempty nonempty.json --config config.json --outdir out --seed 123"
  );
}

if (require.main === module) {
  runCli(process.argv.slice(2))
    .then((code) => {
      process.exit(code);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
