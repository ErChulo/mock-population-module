# Changelog

## 1.0.0 - 2026-03-08
- Added SQLite export support for clean and dirty populations (`.db`)
- Added deterministic plain-text summary report export (`summary.txt`)
- Extended CLI output artifacts and metadata hashes to include `.db` and `.txt`
- Added core tests for SQLite and text report determinism
- Added optional RData/ACCDB conversion guidance and scripts
- Incremented `GENERATOR_VERSION` to `1.0.0`

## 0.9.0 - 2026-03-08
- Added TSV export support for clean and dirty populations
- Added XLSX export support for clean and dirty populations
- Added SQL export support (`CREATE TABLE` + `INSERT`) for clean and dirty populations
- Extended CLI output set and metadata hashes to include CSV, TSV, XLSX, and SQL artifacts
- Added export format determinism tests and updated CLI integration coverage
- Incremented `GENERATOR_VERSION` to `0.9.0`

## 0.8.0 - 2026-03-08
- Added `missingnessModel` support in clean population generation
- Implemented deterministic field-level and default missingness rates with protected required fields
- Expanded `GeneratorConfig.schema.json` with scenario key enum restrictions and date formats
- Added tests covering missingness behavior and required-field preservation
- Incremented `GENERATOR_VERSION` to `0.8.0`

## 0.7.8 - 2026-03-08
- Added optional `packages/web` browser demo (Vite + TypeScript) for client-side generation
- Implemented file upload flow for `DD.csv`, `nonempty.json`, and `config.json`
- Added ZIP download containing `population.clean.csv`, `population.dirty.csv`, and `metadata.json`
- Added parity test asserting web outputs match CLI-equivalent outputs byte-for-byte for same inputs and seed
- Incremented `GENERATOR_VERSION` to `0.7.8`

## 0.7.7 - 2026-03-08
- Added CLI `generate` command in `packages/cli` for end-to-end dataset production
- CLI now writes `population.clean.csv`, `population.dirty.csv`, and `metadata.json`
- Added CLI integration test validating generated outputs and metadata hashes
- Added example `config.json` in `packages/examples`
- Incremented `GENERATOR_VERSION` to `0.7.7`

## 0.7.6 - 2026-03-08
- Added deterministic metadata builder with stable JSON serialization
- Added SHA256 hashing for input and output artifacts used by `metadata.json`
- Added metadata fields for `GENERATOR_VERSION`, seed, row counts, scenario counts, and dirty issue summaries
- Added metadata test to verify deterministic output bytes and hash correctness
- Incremented `GENERATOR_VERSION` to `0.7.6`

## 0.7.5 - 2026-03-08
- Added `generateDirtyPopulation(...)` that starts from clean records and injects controlled issues
- Added configurable dirty injection model with per-issue rates and enabled issue types
- Implemented issue metadata output in memory with counts and affected `Cust_ID` values
- Added dirty injection tests validating count targets within tolerance and issue presence
- Incremented `GENERATOR_VERSION` to `0.7.5`

## 0.7.4 - 2026-03-08
- Added seeded clean population generator in core with scenario mix support
- Added deterministic CSV serialization for clean population output
- Enforced required clean-data invariants in generation flow
- Added clean generation tests for determinism and invariant compliance
- Incremented `GENERATOR_VERSION` to `0.7.4`

## 0.7.3 - 2026-03-08
- Added `validateNonEmptyFields(nonempty, fieldCatalog)` in core
- Enforced business rule that every non-empty field must exist in `FieldCatalog`
- Added non-empty validation tests for valid input, unknown fields, and duplicates
- Added non-empty example fixtures in `packages/examples`
- Incremented `GENERATOR_VERSION` to `0.7.3`

## 0.7.2 - 2026-03-08
- Added `parseDDCsv(pathOrBytes)` in core with deterministic CSV parsing
- Added type inference heuristics when DD.csv does not include explicit types
- Added AJV-backed `FieldCatalog` validation against `FieldCatalog.schema.json`
- Added example DD subset at `packages/examples/dd-subset.csv`
- Added unit tests for deterministic parsing, inference behavior, and schema validation pass-through
- Incremented `GENERATOR_VERSION` to `0.7.2`

## 0.7.1 - 2026-03-07
- Added initial JSON Schema (2020-12) files in `packages/schemas`
- Added AJV schema compilation test covering all schema artifacts
- Incremented `GENERATOR_VERSION` to `0.7.1`

## 0.7.0 - 2026-03-07
- Initial repository scaffold with pnpm workspace
- TypeScript strict configuration, ESLint, and Jest setup
- Core version constant for generator
