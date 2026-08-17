param(
  [int]$Port = 8000
)

$prefix = "http://localhost:$Port/"
$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add($prefix)
$Listener.Start()
Write-Output "Listening on $prefix (serving $((Get-Location).Path))"
try {
  while ($Listener.IsListening) {
    $ctx = $Listener.GetContext()
    try {
      $req = $ctx.Request
      $path = $req.Url.AbsolutePath.TrimStart('/')
      if ([string]::IsNullOrWhiteSpace($path)) { $path = 'index.html' }
      $file = Join-Path (Get-Location) $path
      if (Test-Path $file) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      }
      else {
        $ctx.Response.StatusCode = 404
        $resp = [System.Text.Encoding]::UTF8.GetBytes('Not found')
        $ctx.Response.OutputStream.Write($resp, 0, $resp.Length)
      }
    }
    finally {
      $ctx.Response.OutputStream.Close()
    }
  }
}
finally {
  if ($Listener.IsListening) { $Listener.Stop() }
  $Listener.Close()
}
