$files = @('data\map.geojson','data\map_points.csv','data\map_summary.json')
$latin = [System.Text.Encoding]::GetEncoding(1252)
foreach ($f in $files) {
  if (Test-Path $f) {
    $s = Get-Content $f -Raw -Encoding UTF8
    $bytes = $latin.GetBytes($s)
    $fixed = [System.Text.Encoding]::UTF8.GetString($bytes)
    Set-Content -Path $f -Value $fixed -Encoding UTF8
    Write-Output "Fixed mojibake: $f"
  } else { Write-Output "Not found: $f" }
}
