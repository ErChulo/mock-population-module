#!/usr/bin/env Rscript

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  stop("Usage: Rscript scripts/export_sql_to_rdata.R <clean_csv> <dirty_csv> [out_rdata]")
}

clean_csv <- args[[1]]
dirty_csv <- args[[2]]
out_rdata <- if (length(args) >= 3) args[[3]] else "population.RData"

clean <- read.csv(clean_csv, stringsAsFactors = FALSE, check.names = FALSE)
dirty <- read.csv(dirty_csv, stringsAsFactors = FALSE, check.names = FALSE)

save(clean, dirty, file = out_rdata)
cat(sprintf("Wrote %s\n", out_rdata))
