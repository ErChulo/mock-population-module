# Mock Population Module (`caseworkbench-mockgen`)

Deterministic mock data generation for pension case workbench workflows.

This repository generates synthetic participant populations from:

- a data dictionary CSV (`DD.csv`)
- a non-empty field list (`nonempty.json`)
- a generator configuration (`config.json`)

It produces clean and dirty datasets across multiple export formats, plus a deterministic metadata manifest with SHA256 hashes.

## Features

- TypeScript strict monorepo (pnpm workspace)
- Deterministic generation by seed
- No real PII generation (synthetic tokens only)
- Field dictionary parsing + type inference
- Schema validation for key inputs
- Clean dataset invariants
- Dirty issue injection with metadata
- Export formats:
  - CSV
  - TSV
  - SQL
  - XLSX
  - SQLite `.db`
  - TXT summary report
- Browser demo (`packages/web`) with ZIP download

## Current Version

- `GENERATOR_VERSION`: `1.0.0`
- Root package version: `1.0.0`

## Repository Structure

```text
packages/
  core/      generation engine, validation, export logic
  cli/       command-line entrypoint
  schemas/   JSON Schema artifacts
  examples/  sample DD/nonempty/config inputs
  web/       browser demo (Vite)
docs/
  IMPORT_GUIDE.md
scripts/
  export_sql_to_rdata.R
  export_sql_to_accdb.ps1
```

## Requirements

- Node.js 20+
- pnpm 9+
- Windows/macOS/Linux (examples shown in PowerShell)

## Install

```powershell
pnpm install
```

If PowerShell blocks `pnpm` script execution, use:

```powershell
pnpm.cmd install
```

## Validate Build

```powershell
pnpm test
```

## CLI Usage

### Build CLI

```powershell
pnpm -r build
```

### Run CLI

```powershell
node packages/cli/dist/index.js generate `
  --dd packages/examples/dd-subset.csv `
  --nonempty packages/examples/nonempty.valid.json `
  --config packages/examples/config.json `
  --outdir out `
  --seed 12345
```

Command shape:

```text
generate --dd <DD.csv> --nonempty <nonempty.json> --config <config.json> --outdir <output-dir> [--seed <int>]
```

## Inputs

### 1) `DD.csv`

Expected columns are detected by candidate names:

- field name: `field`, `fieldname`, `field_name`, `name`, `column`, `columnname`
- type (optional): `type`, `datatype`, `data_type`
- description (optional): `description`, `desc`, `definition`

If type is missing, inference heuristics are applied deterministically.

### 2) `nonempty.json`

Shape:

```json
{
  "fields": ["Cust_ID", "DOB", "PA_AMB"],
  "orderingRules": {
    "preserveInputOrder": true
  }
}
```

Rules:

- `fields` must be unique
- every field must exist in `DD.csv` field catalog

### 3) `config.json`

Key fields:

- `seed` (integer)
- `rowCount` (integer > 0)
- `scenarioMix` (weights by scenario)
- retirement date/age fields
- optional:
  - `dirtyInjection`
  - `missingnessModel`

Example: `packages/examples/config.json`.

## Scenario Keys

Supported `scenarioMix` keys:

- `participant_in_pay`
- `participant_deferred_vested`
- `participant_active_vested`
- `participant_not_vested`
- `beneficiary_in_pay`
- `alternate_payee_in_pay`
- `de_minimis_lump_sum`
- `excluded`

## Clean Invariants Enforced

When relevant fields are present:

- `DOB < DOH`
- `DOH <= DOP`
- `DOP <= DOTE`
- if `ID=1` and `RETSTAT=1`, `DOR` present
- if `ID=2`, `SBCD` present and `DOR` blank
- if both present: `DOR < DOD`
- if `MSTAT=M`, spouse fields populated (`SFNAME`, `SLNAME`, `SDOB`)

## Dirty Injection

Supported issue types:

- `married_missing_sdob`
- `dor_earlier_than_dote`
- `beneficiary_has_dor`
- `payable_missing_form_code_ard`

Configuration supports:

- enabled issue list
- per-issue rates
- optional tolerance (checked in tests)

## Missingness Model

`missingnessModel` supports:

- `defaultRate`
- `fieldRates`
- `requiredFields`

Protected fields are preserved (for example: `Cust_ID`, `ID`, `RETSTAT`, plus configured `requiredFields`).

## Outputs

For a typical run, CLI writes:

- `population.clean.csv`
- `population.dirty.csv`
- `population.clean.tsv`
- `population.dirty.tsv`
- `population.clean.sql`
- `population.dirty.sql`
- `population.clean.xlsx`
- `population.dirty.xlsx`
- `population.clean.db`
- `population.dirty.db`
- `summary.txt`
- `metadata.json`

## `metadata.json`

Includes:

- `GENERATOR_VERSION`
- `generatorVersion`
- `seed`
- `inputFileHashes` (SHA256 by file)
- `outputFileHashes` (SHA256 by artifact)
- `rowCounts`
- `scenarioCounts`
- `injectedIssueCounts`
- `injectedIssues` with affected `Cust_ID` values

## Determinism

Given the same input bytes and seed:

- record content is deterministic
- export content is deterministic
- metadata hashes are deterministic

Test suite includes determinism checks for:

- clean generation
- dirty generation
- metadata
- TSV/SQL/XLSX formats
- SQLite and summary report
- CLI end-to-end output hashes
- web/CLI parity

## Web Demo

Run:

```powershell
pnpm --filter @caseworkbench/web dev
```

Open local Vite URL, upload:

- `DD.csv`
- `nonempty.json`
- `config.json`

Optionally override seed, then download ZIP containing:

- `population.clean.csv`
- `population.dirty.csv`
- `metadata.json`

## Single-File Offline Page (No Install, No Server)

If you cannot install Node or run a local server, use:

- `single-page-generator.html`

Open it directly in your browser, upload:

- `DD.csv`
- `nonempty.json`
- `config.json`

It generates direct downloads for:

- `population.clean.csv`
- `population.dirty.csv`
- `population.clean.tsv`
- `population.dirty.tsv`
- `population.clean.sql`
- `population.dirty.sql`
- `summary.txt`
- `metadata.json`

## Optional RData / ACCDB Conversion

Direct export is intentionally optional and non-blocking.

See:

- `docs/IMPORT_GUIDE.md`
- `scripts/export_sql_to_rdata.R`
- `scripts/export_sql_to_accdb.ps1`

## Development

Run all tests:

```powershell
pnpm test
```

Build workspace:

```powershell
pnpm -r build
```

## Troubleshooting

- `pnpm` not recognized in PowerShell:
  - use `pnpm.cmd`
- stale install issues:
  - `pnpm install --force`
- BOM/encoding issues in JSON:
  - ensure UTF-8 without BOM

## Notes

- All names/IDs are synthetic tokens.
- Do not use generated data as real participant information.
