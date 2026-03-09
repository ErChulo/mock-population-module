# Import and Conversion Guide (Optional)

Direct RData/RDA and ACCDB exports are optional and intentionally not part of the core generation runtime.

Use this guide to convert generated SQL/CSV artifacts.

## Inputs

Use either:

- `population.clean.sql` / `population.dirty.sql`
- `population.clean.csv` / `population.dirty.csv`
- `population.clean.db` / `population.dirty.db`

## RData / RDA

Recommended: convert from CSV or SQLite in R.

### Option A: CSV to RData

```r
clean <- read.csv("out/population.clean.csv", stringsAsFactors = FALSE)
dirty <- read.csv("out/population.dirty.csv", stringsAsFactors = FALSE)
save(clean, dirty, file = "out/population.RData")
```

### Option B: SQLite to RData

```r
library(DBI)
library(RSQLite)
con <- dbConnect(SQLite(), "out/population.clean.db")
clean <- dbReadTable(con, "population_clean")
dbDisconnect(con)
save(clean, file = "out/population_clean.RData")
```

Automation script:

- `scripts/export_sql_to_rdata.R`

## ACCDB

Recommended: convert from SQL/CSV using Access OLE DB on Windows with installed Access Database Engine.

Automation script:

- `scripts/export_sql_to_accdb.ps1`

Notes:

- Requires Access OLE DB provider (`Microsoft.ACE.OLEDB.12.0` or newer).
- Script creates table columns as `LONGTEXT` to preserve compatibility.
- For strict column typing in Access, post-process table design after import.
