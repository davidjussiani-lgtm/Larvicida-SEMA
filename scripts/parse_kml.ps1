param(
  [string]$KmlPath = "data\kmz_extracted\doc.kml"
)
Set-StrictMode -Version Latest
if (-not (Test-Path $KmlPath)) { Write-Error "KML not found: $KmlPath"; exit 1 }
[xml]$kml = Get-Content -Path $KmlPath -Raw

$placemarks = $kml.SelectNodes("//*[local-name() = 'Placemark']")
$features = @()
$pointRows = @()
foreach ($pm in $placemarks) {
  $nameNode = $pm.SelectSingleNode("*[local-name()='name']")
  $descNode = $pm.SelectSingleNode("*[local-name()='description']")
  $name = if ($nameNode) { $nameNode.InnerText.Trim() } else { '' }
  $desc = if ($descNode) { $descNode.InnerText.Trim() } else { '' }
  $props = @{ name = $name; description = $desc }
  # ExtendedData (iterate children)
  $ed = $pm.SelectSingleNode("*[local-name()='ExtendedData']")
  if ($ed) {
    foreach ($child in $ed.ChildNodes) {
      if ($child.LocalName -eq 'Data') {
        $key = $child.GetAttribute('name')
        $valNode = $child.SelectSingleNode("*[local-name()='value']")
        $val = if ($valNode) { $valNode.InnerText.Trim() } else { '' }
        if ($key) { $props[$key] = $val }
      }
    }
  }
  # Geometry
  $geom = $null
  $pointNode = $pm.SelectSingleNode(".//*[local-name()='Point']")
  if ($pointNode) {
    $coordNode = $pointNode.SelectSingleNode("*[local-name()='coordinates']")
    if ($coordNode) {
      $c = $coordNode.InnerText.Trim() -replace '\s+',' '
      $parts = $c.Split(',')
      if ($parts.Count -ge 2) {
        $lon = [double]$parts[0]; $lat = [double]$parts[1]
        $geom = @{ type = 'Point'; coordinates = @($lon,$lat) }
        $inv = [System.Globalization.CultureInfo]::InvariantCulture
        $pointRows += [PSCustomObject]@{ name=$name; description=$desc; lon=$lon.ToString($inv); lat=$lat.ToString($inv) }
      }
    }
  }
  else {
    $lsNode = $pm.SelectSingleNode(".//*[local-name()='LineString']")
    if ($lsNode) {
      $coordNode = $lsNode.SelectSingleNode("*[local-name()='coordinates']")
      if ($coordNode) {
        $coords = @()
        $coordText = $coordNode.InnerText.Trim()
        foreach ($pt in ($coordText -split '\s+' | Where-Object { $_ -ne '' })) {
          $p = $pt -split ','
          if ($p.Count -ge 2) { $coords += ,@([double]$p[0], [double]$p[1]) }
        }
        if ($coords.Count -gt 0) { $geom = @{ type = 'LineString'; coordinates = $coords } }
      }
    }
    else {
      $polyNode = $pm.SelectSingleNode(".//*[local-name()='Polygon']")
      if ($polyNode) {
        $lrNode = $polyNode.SelectSingleNode(".//*[local-name()='outerBoundaryIs']//*[local-name()='coordinates']")
        if ($lrNode) {
          $coords = @()
          $coordText = $lrNode.InnerText.Trim()
          foreach ($pt in ($coordText -split '\s+' | Where-Object { $_ -ne '' })) {
            $p = $pt -split ','
            if ($p.Count -ge 2) { $coords += ,@([double]$p[0], [double]$p[1]) }
          }
          if ($coords.Count -gt 0) { $geom = @{ type='Polygon'; coordinates = @(,$coords) } }
        }
      }
    }
  }
  if ($geom) {
    $feature = @{ type='Feature'; geometry=$geom; properties=$props }
    $features += $feature
  }
}
$fc = @{ type='FeatureCollection'; features=$features }
if (-not (Test-Path 'data')) { New-Item -ItemType Directory -Path 'data' | Out-Null }
$geojsonPath = Join-Path 'data' 'map.geojson'
$csvPath = Join-Path 'data' 'map_points.csv'
$fc | ConvertTo-Json -Depth 10 | Out-File -FilePath $geojsonPath -Encoding utf8

if ($pointRows.Count -gt 0) {
  $pointRows | ConvertTo-Csv -NoTypeInformation | Out-File -FilePath $csvPath -Encoding utf8
}

Write-Output "Wrote $geojsonPath and $csvPath (features: $($features.Count), points: $($pointRows.Count))"
