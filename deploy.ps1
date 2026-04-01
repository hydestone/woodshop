# JDH Woodworks - Auto Deploy Script
# Double-click to run, or right-click -> Run with PowerShell

$projectRoot = "C:\Users\John Hyde\Documents\woodshop-app"
$outputsUrl  = "https://woodshop-pdd2.vercel.app"  # not used - files come from Downloads

Write-Host "JDH Woodworks Deploy Script" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

# Step 1 - find latest downloaded files in Downloads folder
$downloads = "$env:USERPROFILE\Downloads"

$fileMap = @{
    "App.jsx"              = "src"
    "main.jsx"             = "src"
    "db.js"                = "src"
    "styles.css"           = "src"
    "Shared.jsx"           = "src\components"
    "Toast.jsx"            = "src\components"
    "Search.jsx"           = "src\components"
    "Dashboard.jsx"        = "src\pages"
    "Projects.jsx"         = "src\pages"
    "Stock.jsx"            = "src\pages"
    "Shopping.jsx"         = "src\pages"
    "Maintenance.jsx"      = "src\pages"
    "Finishes.jsx"         = "src\pages"
    "Resources.jsx"        = "src\pages"
    "ShopImprovements.jsx" = "src\pages"
    "Photos.jsx"           = "src\pages"
    "FinishedProducts.jsx" = "src\pages"
    "Inspiration.jsx"      = "src\pages"
    "Brainstorm.jsx"       = "src\pages"
    "Home.jsx"             = "src\pages"
    "Portfolio.jsx"        = "src\pages"
    "YearReview.jsx"       = "src\pages"
    "Settings.jsx"         = "src\pages"
    "BulkImport.jsx"       = "src\pages"
}

$copied = 0
$skipped = 0

foreach ($file in $fileMap.Keys) {
    # Find most recently downloaded version of this file
    $found = Get-ChildItem -Path $downloads -Filter $file -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending |
             Select-Object -First 1

    if ($found) {
        $dest = Join-Path $projectRoot $fileMap[$file]
        $destFile = Join-Path $dest $file
        
        # Only copy if download is newer than existing file
        $existing = Get-Item $destFile -ErrorAction SilentlyContinue
        if (-not $existing -or $found.LastWriteTime -gt $existing.LastWriteTime) {
            Copy-Item $found.FullName $destFile -Force
            Write-Host "  Copied: $file" -ForegroundColor Green
            $copied++
        } else {
            $skipped++
        }
    }
}

Write-Host ""
Write-Host "Copied $copied file(s), skipped $skipped unchanged." -ForegroundColor Cyan

if ($copied -eq 0) {
    Write-Host "Nothing new to deploy. Exiting." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit
}

# Step 2 - git commit and push
Write-Host ""
Write-Host "Deploying to Vercel..." -ForegroundColor Cyan

Set-Location $projectRoot

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
git add .
git commit -m "deploy $timestamp"
git push

Write-Host ""
Write-Host "Done! Vercel will deploy in ~60 seconds." -ForegroundColor Green
Write-Host "URL: woodshop-pdd2.vercel.app" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close"
