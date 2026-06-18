<#
  Local static-file server for the IVA site (preview only).
  Serves ./public, honors public/_redirects, sends no-cache headers for dev.
  NOTE: /api/* Pages Functions do NOT run here — use `npm run dev` for those.

  Run:  pwsh -ExecutionPolicy Bypass -File .\.server.ps1
        pwsh -ExecutionPolicy Bypass -File .\.server.ps1 -Port 9000 -NoBrowser
  (no pwsh? swap `pwsh` for `powershell`)
#>

[CmdletBinding()]
param(
    [int]    $Port = 8080,
    [string] $Root = "public",
    [switch] $NoBrowser
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootPath  = Join-Path $scriptDir $Root
if (-not (Test-Path -LiteralPath $rootPath)) { Write-Error "Root folder not found: $rootPath"; exit 1 }
$rootPath = (Resolve-Path -LiteralPath $rootPath).Path

$mime = @{
    ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8"
    ".css"="text/css; charset=utf-8"; ".js"="text/javascript; charset=utf-8"; ".mjs"="text/javascript; charset=utf-8"
    ".json"="application/json; charset=utf-8"; ".xml"="application/xml; charset=utf-8"
    ".txt"="text/plain; charset=utf-8"; ".csv"="text/csv; charset=utf-8"
    ".svg"="image/svg+xml"; ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"
    ".gif"="image/gif"; ".webp"="image/webp"; ".ico"="image/x-icon"; ".avif"="image/avif"
    ".woff"="font/woff"; ".woff2"="font/woff2"; ".ttf"="font/ttf"; ".otf"="font/otf"
    ".map"="application/json; charset=utf-8"; ".webmanifest"="application/manifest+json"; ".pdf"="application/pdf"
}
function Get-Mime([string]$ext) {
    $e = $ext.ToLowerInvariant()
    if ($mime.ContainsKey($e)) { return $mime[$e] }
    return "application/octet-stream"
}

# Parse public/_redirects (skips comments, blanks, and splat/placeholder rules)
$redirects = [System.Collections.Generic.List[object]]::new()
$redirFile = Join-Path $rootPath "_redirects"
if (Test-Path -LiteralPath $redirFile) {
    foreach ($line in (Get-Content -LiteralPath $redirFile)) {
        $t = $line.Trim()
        if ($t -eq "" -or $t.StartsWith("#")) { continue }
        $parts = $t -split "\s+"
        if ($parts.Count -lt 2) { continue }
        $from = $parts[0]; $to = $parts[1]
        $code = if ($parts.Count -ge 3) { [int]$parts[2] } else { 302 }
        if ($from.Contains("*") -or $from.Contains(":")) { continue }
        $redirects.Add([pscustomobject]@{ From=$from; To=$to; Code=$code })
    }
}

$securityHeaders = @{
    "X-Frame-Options"="DENY"; "X-Content-Type-Options"="nosniff"
    "Referrer-Policy"="strict-origin-when-cross-origin"
    "Permissions-Policy"="geolocation=(), microphone=(), camera=(), payment=()"
    "Content-Security-Policy"="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://formspree.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://formspree.io"
}

function Resolve-File([string]$urlPath) {
    $rel = [System.Uri]::UnescapeDataString($urlPath).TrimStart("/")
    if ($rel -eq "") { $rel = "index.html" }
    $candidate = Join-Path $rootPath $rel
    if ((Test-Path -LiteralPath $candidate -PathType Container) -or $rel.EndsWith("/")) {
        $candidate = Join-Path $candidate "index.html"
    }
    $full = [System.IO.Path]::GetFullPath($candidate)
    if (-not $full.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) { return $null }
    if (Test-Path -LiteralPath $full -PathType Leaf) { return $full }
    return $null
}

$prefix   = "http://localhost:$Port/"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
try { $listener.Start() }
catch {
    Write-Host "Could not bind to $prefix" -ForegroundColor Red
    Write-Host "Port $Port in use? Try: -Port 9000" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "  IVA local preview (static only)" -ForegroundColor Cyan
Write-Host "  Serving : $rootPath"
Write-Host "  URL     : $prefix" -ForegroundColor Green
Write-Host "  Redirect rules: $($redirects.Count)  |  /api/* will 404 (use 'npm run dev')" -ForegroundColor DarkGray
Write-Host "  Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

if (-not $NoBrowser) { Start-Process $prefix | Out-Null }

try {
    while ($listener.IsListening) {
        $task = $listener.GetContextAsync()
        while (-not $task.Wait(300)) { }
        $ctx = $task.Result
        $req = $ctx.Request; $res = $ctx.Response
        $path = $req.Url.AbsolutePath

        foreach ($k in $securityHeaders.Keys) { try { $res.Headers[$k] = $securityHeaders[$k] } catch {} }
        # dev: never cache, so plain refresh shows latest edits
        $res.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        $res.Headers["Pragma"]        = "no-cache"

        $hit = $redirects | Where-Object { $_.From -ceq $path } | Select-Object -First 1
        if ($hit) {
            $res.StatusCode = $hit.Code; $res.RedirectLocation = $hit.To
            Write-Host ("{0,-4} {1,-28} -> {2}" -f $hit.Code, $path, $hit.To) -ForegroundColor Yellow
            $res.Close(); continue
        }

        $file = Resolve-File $path
        if ($file) {
            $bytes = [System.IO.File]::ReadAllBytes($file)
            $res.ContentType = Get-Mime ([System.IO.Path]::GetExtension($file))
            $res.ContentLength64 = $bytes.Length
            $res.StatusCode = 200
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host ("200  {0}" -f $path) -ForegroundColor DarkGray
            $res.Close(); continue
        }

        $res.StatusCode = 404
        $notFound = Join-Path $rootPath "404.html"
        if (Test-Path -LiteralPath $notFound -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($notFound)
            $res.ContentType = "text/html; charset=utf-8"
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
            $res.ContentLength64 = $msg.Length
            $res.OutputStream.Write($msg, 0, $msg.Length)
        }
        Write-Host ("404  {0}" -f $path) -ForegroundColor Red
        $res.Close()
    }
}
finally {
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
    Write-Host "`nServer stopped." -ForegroundColor Cyan
}
