$files = @('data\map.geojson','data\map_points.csv','data\map_summary.json')
$enc = [System.Text.Encoding]::GetEncoding(1252) # windows-1252
foreach ($f in $files) {
  if (Test-Path $f) {
    $bytes = [System.IO.File]::ReadAllBytes($f)
    $s = $enc.GetString($bytes)
    [System.IO.File]::WriteAllText($f, $s, [System.Text.Encoding]::UTF8)
    Write-Output "Re-encoded: $f"
  } else {
    Write-Output "Not found: $f"
  }
}
