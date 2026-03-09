param(
  [Parameter(Mandatory = $true)]
  [string]$CsvPath,
  [Parameter(Mandatory = $true)]
  [string]$AccdbPath,
  [string]$TableName = "population_import"
)

if (-not (Test-Path -LiteralPath $CsvPath)) {
  throw "CSV file not found: $CsvPath"
}

$csv = Import-Csv -LiteralPath $CsvPath
if ($csv.Count -eq 0) {
  throw "CSV has no rows: $CsvPath"
}

$provider = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$AccdbPath;"

if (-not (Test-Path -LiteralPath $AccdbPath)) {
  $catalog = New-Object -ComObject ADOX.Catalog
  $catalog.Create($provider)
}

$connection = New-Object System.Data.OleDb.OleDbConnection($provider)
$connection.Open()

try {
  $columns = $csv[0].PSObject.Properties.Name | ForEach-Object { "[$_] LONGTEXT" }
  $createSql = "CREATE TABLE [$TableName] (" + ($columns -join ",") + ")"
  $createCmd = $connection.CreateCommand()
  $createCmd.CommandText = $createSql
  try { $createCmd.ExecuteNonQuery() | Out-Null } catch {}

  foreach ($row in $csv) {
    $names = @()
    $values = @()
    foreach ($p in $row.PSObject.Properties) {
      $names += "[$($p.Name)]"
      $escaped = ($p.Value -replace "'", "''")
      $values += "'$escaped'"
    }
    $insertSql = "INSERT INTO [$TableName] (" + ($names -join ",") + ") VALUES (" + ($values -join ",") + ")"
    $insertCmd = $connection.CreateCommand()
    $insertCmd.CommandText = $insertSql
    $insertCmd.ExecuteNonQuery() | Out-Null
  }

  Write-Output "Imported CSV to $AccdbPath table $TableName"
}
finally {
  $connection.Close()
}
