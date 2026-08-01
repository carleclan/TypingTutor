# Serves this folder at http://localhost:8123 so the app runs on a real origin.
# Optional -- index.html also opens directly in a browser. Ctrl+C to stop.

param([int]$Port = 8123)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://localhost:$Port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not listen on $prefix - is something already using port $Port?" -ForegroundColor Red
  exit 1
}
Write-Host "TType is running at $prefix  (Ctrl+C to stop)" -ForegroundColor Green

$types = @{
  '.html' = 'text/html'; '.css' = 'text/css'; '.js' = 'application/javascript';
  '.json' = 'application/json'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.LocalPath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }

    $file = Join-Path $root $rel
    $full = [System.IO.Path]::GetFullPath($file)

    # keep requests inside the app folder
    if (-not $full.StartsWith([System.IO.Path]::GetFullPath($root), [StringComparison]::OrdinalIgnoreCase)) {
      $ctx.Response.StatusCode = 403
      $ctx.Response.Close()
      continue
    }

    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ct = $types[$ext]
      if (-not $ct) { $ct = 'application/octet-stream' }
      $ctx.Response.ContentType = "$ct; charset=utf-8"
      $ctx.Response.Headers.Add('Cache-Control', 'no-store')
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  } catch {
    Write-Host "request error: $_" -ForegroundColor DarkYellow
  }
}
