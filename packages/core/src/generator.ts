import { Faker, en } from "@faker-js/faker";
import type { FieldCatalog } from "./ddCsv";
import type { NonEmptyFields } from "./nonEmptyFields";

export type ScenarioName =
  | "participant_in_pay"
  | "participant_deferred_vested"
  | "participant_active_vested"
  | "participant_not_vested"
  | "beneficiary_in_pay"
  | "alternate_payee_in_pay"
  | "de_minimis_lump_sum"
  | "excluded";

export interface GeneratorConfig {
  seed: number;
  rowCount: number;
  scenarioMix: Partial<Record<ScenarioName, number>>;
  planTerminationDate: string;
  requiredBeginningAge: number;
  normalRetirementAge: number;
  planYearStartMonthDay: string;
  benefitFreezeDate?: string;
  dirtyInjection?: DirtyInjectionConfig;
  missingnessModel?: MissingnessModel;
}

export type PopulationRecord = Record<string, string>;
export type DirtyIssueType =
  | "married_missing_sdob"
  | "dor_earlier_than_dote"
  | "beneficiary_has_dor"
  | "payable_missing_form_code_ard";

export interface DirtyInjectionConfig {
  enabledIssueTypes?: DirtyIssueType[];
  rates: Partial<Record<DirtyIssueType, number>>;
  tolerance?: number;
}

export interface DirtyIssueSummary {
  issueType: DirtyIssueType;
  requestedRate: number;
  candidateCount: number;
  targetCount: number;
  actualCount: number;
  affectedCustIds: string[];
}

export interface DirtyInjectionMetadata {
  issueCounts: Partial<Record<DirtyIssueType, number>>;
  summaries: DirtyIssueSummary[];
}

export interface MissingnessModel {
  defaultRate?: number;
  fieldRates?: Record<string, number>;
  requiredFields?: string[];
}

const SCENARIOS: ScenarioName[] = [
  "participant_in_pay",
  "participant_deferred_vested",
  "participant_active_vested",
  "participant_not_vested",
  "beneficiary_in_pay",
  "alternate_payee_in_pay",
  "de_minimis_lump_sum",
  "excluded"
];
const DIRTY_ISSUES: DirtyIssueType[] = [
  "married_missing_sdob",
  "dor_earlier_than_dote",
  "beneficiary_has_dor",
  "payable_missing_form_code_ard"
];

export function generateCleanPopulation(
  fieldCatalog: FieldCatalog,
  nonEmptyFields: NonEmptyFields,
  config: GeneratorConfig
): PopulationRecord[] {
  const outputFields = nonEmptyFields.fields;
  const knownFields = new Set(fieldCatalog.fields.map((field) => field.name));
  const unknown = outputFields.filter((field) => !knownFields.has(field));
  if (unknown.length > 0) {
    throw new Error(`Unknown output fields: ${unknown.join(", ")}`);
  }

  const faker = new Faker({ locale: [en] });
  faker.seed(config.seed);
  const scenarioPlan = buildScenarioPlan(config.rowCount, config.scenarioMix);

  return scenarioPlan.map((scenario, index) => {
    const record = initializeRecord(outputFields);
    applyBaseFields(record, index, faker);
    applyTimeline(record, faker);
    applyScenario(record, scenario, faker);
    enforceCleanInvariants(record, outputFields, faker);
    applyMissingness(record, outputFields, config.missingnessModel, faker);
    enforceCleanInvariants(record, outputFields, faker);
    return projectRecord(record, outputFields);
  });
}

export function populationToCsv(records: PopulationRecord[], outputFields: string[]): string {
  const header = outputFields.map(escapeCsv).join(",");
  const rows = records.map((record) => outputFields.map((field) => escapeCsv(record[field] ?? "")).join(","));
  return [header, ...rows].join("\n");
}

export function generateDirtyPopulation(
  cleanRecords: PopulationRecord[],
  nonEmptyFields: NonEmptyFields,
  config: GeneratorConfig
): { records: PopulationRecord[]; metadata: DirtyInjectionMetadata } {
  const dirtyConfig = config.dirtyInjection;
  if (!dirtyConfig) {
    return { records: cleanRecords.map((record) => ({ ...record })), metadata: { issueCounts: {}, summaries: [] } };
  }

  const enabled = dirtyConfig.enabledIssueTypes?.length ? dirtyConfig.enabledIssueTypes : DIRTY_ISSUES;
  const records = cleanRecords.map((record) => ({ ...record }));
  const metadata: DirtyInjectionMetadata = { issueCounts: {}, summaries: [] };
  const fields = new Set(nonEmptyFields.fields);

  for (const issueType of enabled) {
    const requestedRate = clampRate(dirtyConfig.rates[issueType] ?? 0);
    const candidates = findCandidates(records, issueType, fields);
    const targetCount = Math.round(candidates.length * requestedRate);
    const chosen = pickDeterministicIndices(candidates, targetCount, config.seed, issueType);
    const affectedCustIds: string[] = [];

    for (const index of chosen) {
      applyIssue(records[index], issueType);
      if (records[index].Cust_ID) {
        affectedCustIds.push(records[index].Cust_ID);
      }
    }

    metadata.issueCounts[issueType] = chosen.length;
    metadata.summaries.push({
      issueType,
      requestedRate,
      candidateCount: candidates.length,
      targetCount,
      actualCount: chosen.length,
      affectedCustIds
    });
  }

  return { records, metadata };
}

function buildScenarioPlan(rowCount: number, scenarioMix: Partial<Record<ScenarioName, number>>): ScenarioName[] {
  const effectiveMix: ScenarioName[] = SCENARIOS.filter((scenario) => (scenarioMix[scenario] ?? 0) > 0);
  const scenarios: ScenarioName[] =
    effectiveMix.length > 0 ? effectiveMix : (["participant_in_pay"] as ScenarioName[]);
  const totalWeight = scenarios.reduce((sum, scenario) => sum + (scenarioMix[scenario] ?? 0), 0);
  if (rowCount <= 0) {
    return [];
  }

  if (totalWeight <= 0) {
    return Array.from({ length: rowCount }, () => "participant_in_pay");
  }

  const counts: Array<{ scenario: ScenarioName; count: number; fraction: number }> = scenarios.map((scenario) => {
    const raw = ((scenarioMix[scenario] ?? 0) / totalWeight) * rowCount;
    return { scenario, count: Math.floor(raw), fraction: raw - Math.floor(raw) };
  });

  let assigned = counts.reduce((sum, item) => sum + item.count, 0);
  counts
    .slice()
    .sort((a, b) => b.fraction - a.fraction || a.scenario.localeCompare(b.scenario))
    .forEach((item) => {
      if (assigned < rowCount) {
        const target = counts.find((entry) => entry.scenario === item.scenario);
        if (target) {
          target.count += 1;
          assigned += 1;
        }
      }
    });

  const plan: ScenarioName[] = [];
  for (const item of counts.sort((a, b) => a.scenario.localeCompare(b.scenario))) {
    for (let i = 0; i < item.count; i += 1) {
      plan.push(item.scenario);
    }
  }
  return plan;
}

function initializeRecord(fields: string[]): PopulationRecord {
  const record: PopulationRecord = {};
  for (const field of fields) {
    record[field] = "";
  }
  return record;
}

function applyBaseFields(record: PopulationRecord, index: number, faker: Faker): void {
  setIfPresent(record, "Cust_ID", `CUST_${String(index + 1).padStart(7, "0")}`);
  setIfPresent(record, "BCV_REC_ID", `BCV_${String(index + 1).padStart(7, "0")}`);
  setIfPresent(record, "FNAME", token(faker, "FN"));
  setIfPresent(record, "LNAME", token(faker, "LN"));
  const married = faker.number.int({ min: 0, max: 1 }) === 1;
  setIfPresent(record, "MSTAT", married ? "M" : "S");
}

function applyTimeline(record: PopulationRecord, faker: Faker): void {
  const dob = makeDate(1940 + faker.number.int({ min: 0, max: 25 }), faker.number.int({ min: 1, max: 12 }), faker.number.int({ min: 1, max: 28 }));
  const doh = addYears(dob, faker.number.int({ min: 18, max: 30 }));
  const dop = addYears(doh, faker.number.int({ min: 0, max: 20 }));
  const dote = addYears(dop, faker.number.int({ min: 0, max: 10 }));
  const dor = addYears(dop, faker.number.int({ min: 1, max: 10 }));
  const dod = addYears(dor, faker.number.int({ min: 1, max: 25 }));

  setIfPresent(record, "DOB", formatDate(dob));
  setIfPresent(record, "DOH", formatDate(doh));
  setIfPresent(record, "DOP", formatDate(dop));
  setIfPresent(record, "DOTE", formatDate(dote));
  setIfPresent(record, "DOR", formatDate(dor));
  setIfPresent(record, "DOD", formatDate(dod));
  setIfPresent(record, "LS_EST_DATE", formatDate(addYears(dop, 1)));
}

function applyScenario(record: PopulationRecord, scenario: ScenarioName, faker: Faker): void {
  switch (scenario) {
    case "participant_in_pay":
      setIfPresent(record, "ID", "1");
      setIfPresent(record, "RETSTAT", "1");
      setIfPresent(record, "LEV_MB_ARD", money(faker));
      setIfPresent(record, "FORM_CODE_ARD", "FORM_STD");
      break;
    case "participant_deferred_vested":
      setIfPresent(record, "ID", "1");
      setIfPresent(record, "RETSTAT", "2");
      setIfPresent(record, "PA_AMB", money(faker));
      break;
    case "participant_active_vested":
      setIfPresent(record, "ID", "1");
      setIfPresent(record, "RETSTAT", "3");
      setIfPresent(record, "PA_AMB", money(faker));
      break;
    case "participant_not_vested":
      setIfPresent(record, "ID", "1");
      setIfPresent(record, "RETSTAT", "4");
      break;
    case "beneficiary_in_pay":
      setIfPresent(record, "ID", "2");
      setIfPresent(record, "RETSTAT", "1");
      setIfPresent(record, "SBCD", "SBCD_BEN");
      setIfPresent(record, "LEV_MB_ARD", money(faker));
      setIfPresent(record, "FORM_CODE_ARD", "FORM_STD");
      break;
    case "alternate_payee_in_pay":
      setIfPresent(record, "ID", "4");
      setIfPresent(record, "RETSTAT", "1");
      setIfPresent(record, "LEV_MB_ARD", money(faker));
      setIfPresent(record, "FORM_CODE_ARD", "FORM_STD");
      break;
    case "de_minimis_lump_sum":
      setIfPresent(record, "ID", "1");
      setIfPresent(record, "RETSTAT", "1");
      setIfPresent(record, "LS_EST_AMT", money(faker, 500, 3000));
      setIfPresent(record, "FORM_CODE_ARD", "FORM_STD");
      break;
    case "excluded":
      setIfPresent(record, "ID", "1");
      setIfPresent(record, "RETSTAT", "5");
      break;
    default:
      break;
  }
}

function enforceCleanInvariants(record: PopulationRecord, fields: string[], faker: Faker): void {
  if (hasField(fields, "DOB") && hasField(fields, "DOH")) {
    ensureDateOrder(record, "DOB", "DOH", false);
  }
  if (hasField(fields, "DOH") && hasField(fields, "DOP")) {
    ensureDateOrder(record, "DOH", "DOP", true);
  }
  if (hasField(fields, "DOP") && hasField(fields, "DOTE")) {
    ensureDateOrder(record, "DOP", "DOTE", true);
  }
  if (record.ID === "1" && record.RETSTAT === "1" && hasField(fields, "DOR") && !record.DOR) {
    record.DOR = formatDate(addYears(parseDate(record.DOP || record.DOH || record.DOB), 1));
  }
  if (record.ID === "2") {
    if (hasField(fields, "SBCD") && !record.SBCD) {
      record.SBCD = "SBCD_BEN";
    }
    if (hasField(fields, "DOR")) {
      record.DOR = "";
    }
  }
  if (hasField(fields, "DOR") && hasField(fields, "DOD") && record.DOR && record.DOD) {
    ensureDateOrder(record, "DOR", "DOD", false);
  }

  if (record.MSTAT === "M") {
    if (hasField(fields, "SFNAME") && !record.SFNAME) {
      record.SFNAME = token(faker, "SFN");
    }
    if (hasField(fields, "SLNAME") && !record.SLNAME) {
      record.SLNAME = token(faker, "SLN");
    }
    if (hasField(fields, "SDOB") && !record.SDOB) {
      const memberDob = record.DOB ? parseDate(record.DOB) : makeDate(1960, 1, 1);
      record.SDOB = formatDate(addYears(memberDob, faker.number.int({ min: -3, max: 3 })));
    }
  }
}

function projectRecord(record: PopulationRecord, fields: string[]): PopulationRecord {
  const projected: PopulationRecord = {};
  for (const field of fields) {
    projected[field] = record[field] ?? "";
  }
  return projected;
}

function setIfPresent(record: PopulationRecord, fieldName: string, value: string): void {
  if (Object.prototype.hasOwnProperty.call(record, fieldName)) {
    record[fieldName] = value;
  }
}

function hasField(fields: string[], fieldName: string): boolean {
  return fields.includes(fieldName);
}

function ensureDateOrder(record: PopulationRecord, firstField: string, secondField: string, allowEqual: boolean): void {
  if (!record[firstField] || !record[secondField]) {
    return;
  }
  let firstDate = parseDate(record[firstField]);
  let secondDate = parseDate(record[secondField]);
  if (firstDate.getTime() > secondDate.getTime() || (!allowEqual && firstDate.getTime() === secondDate.getTime())) {
    secondDate = addYears(firstDate, 1);
    record[secondField] = formatDate(secondDate);
  }
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return makeDate(year, month, day);
}

function makeDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addYears(date: Date, years: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function money(faker: Faker, min = 1000, max = 200000): string {
  return faker.number.float({ min, max, multipleOf: 0.01 }).toFixed(2);
}

function token(faker: Faker, prefix: string): string {
  return `${prefix}_${faker.string.alphanumeric({ length: 8, casing: "upper" })}`;
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) {
    return 0;
  }
  if (rate < 0) {
    return 0;
  }
  if (rate > 1) {
    return 1;
  }
  return rate;
}

function findCandidates(records: PopulationRecord[], issueType: DirtyIssueType, fields: Set<string>): number[] {
  const has = (field: string): boolean => fields.has(field);
  if (issueType === "married_missing_sdob" && has("MSTAT") && has("SDOB")) {
    return records.flatMap((record, index) => (record.MSTAT === "M" && record.SDOB ? [index] : []));
  }
  if (issueType === "dor_earlier_than_dote" && has("DOR") && has("DOTE")) {
    return records.flatMap((record, index) => (record.DOR && record.DOTE ? [index] : []));
  }
  if (issueType === "beneficiary_has_dor" && has("ID") && has("DOR")) {
    return records.flatMap((record, index) => (record.ID === "2" ? [index] : []));
  }
  if (issueType === "payable_missing_form_code_ard" && has("FORM_CODE_ARD") && has("RETSTAT")) {
    return records.flatMap((record, index) => (record.RETSTAT === "1" && record.FORM_CODE_ARD ? [index] : []));
  }
  return [];
}

function pickDeterministicIndices(
  candidates: number[],
  targetCount: number,
  seed: number,
  issueType: DirtyIssueType
): number[] {
  if (targetCount <= 0 || candidates.length === 0) {
    return [];
  }
  const stateful = candidates.map((index) => ({ index, score: seededScore(seed, issueType, index) }));
  stateful.sort((a, b) => a.score - b.score || a.index - b.index);
  return stateful.slice(0, Math.min(targetCount, stateful.length)).map((entry) => entry.index);
}

function seededScore(seed: number, issueType: string, index: number): number {
  let value = seed ^ hashString(issueType) ^ index;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = value ^ (value >>> 16);
  return Math.abs(value);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash;
}

function applyIssue(record: PopulationRecord, issueType: DirtyIssueType): void {
  if (issueType === "married_missing_sdob") {
    record.SDOB = "";
    return;
  }
  if (issueType === "dor_earlier_than_dote") {
    if (record.DOTE) {
      record.DOR = formatDate(addYears(parseDate(record.DOTE), -1));
    }
    return;
  }
  if (issueType === "beneficiary_has_dor") {
    if (!record.DOR) {
      record.DOR = record.DOTE || "2000-01-01";
    }
    return;
  }
  if (issueType === "payable_missing_form_code_ard") {
    record.FORM_CODE_ARD = "";
  }
}

function applyMissingness(
  record: PopulationRecord,
  fields: string[],
  missingnessModel: MissingnessModel | undefined,
  faker: Faker
): void {
  if (!missingnessModel) {
    return;
  }

  const requiredByConfig = new Set(missingnessModel.requiredFields ?? []);
  const alwaysRequired = new Set(["Cust_ID", "ID", "RETSTAT"]);
  for (const field of fields) {
    if (alwaysRequired.has(field) || requiredByConfig.has(field)) {
      continue;
    }
    if (!record[field]) {
      continue;
    }
    const rate = clampRate(missingnessModel.fieldRates?.[field] ?? missingnessModel.defaultRate ?? 0);
    if (rate <= 0) {
      continue;
    }
    if (faker.number.float({ min: 0, max: 1 }) < rate) {
      record[field] = "";
    }
  }
}
