$files = @('data\map.geojson','data\map_points.csv','data\map_summary.json')
$repl = @{
  'Ã£'='ã'; 'Ã¡'='á'; 'Ã©'='é'; 'Ãª'='ê'; 'Ã­'='í'; 'Ã³'='ó'; 'Ãº'='ú'; 'Ãµ'='õ'; 'Ã§'='ç'; 'Ã´'='ô';
  'Â '=' '; 'Â'=''; 'Ã‰'='É'; 'Ãš'='Ú'; 'â'='–'; 'â'="'"; 'â'='"'; 'â'='"'
}
foreach ($f in $files) {
  if (Test-Path $f) {
    $s = Get-Content $f -Raw -Encoding UTF8
    foreach ($k in $repl.Keys) { $s = $s -replace [regex]::Escape($k), $repl[$k] }
    Set-Content -Path $f -Value $s -Encoding UTF8
    Write-Output "Processed: $f"
  } else {
    Write-Output "Not found: $f"
  }
}
