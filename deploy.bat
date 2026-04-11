@echo off
setlocal enabledelayedexpansion

set PROJECT=C:\Users\John Hyde\Documents\woodshop-app
set DOWNLOADS=%USERPROFILE%\Downloads

echo.
echo  JDH Woodworks — Deploy
echo  =======================
echo.

cd /d "%PROJECT%"

:: ── Restore point: tag current state before any changes ──────────────
for /f "delims=" %%D in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HHmm'"') do set TIMESTAMP=%%D
git tag "pre-deploy_%TIMESTAMP%" 2>nul
if %errorlevel% equ 0 (
    echo  Restore point: pre-deploy_%TIMESTAMP%
) else (
    echo  Restore point: tag already exists, skipping.
)
echo.

:: ── Find and extract latest R*.zip from Downloads ────────────────────
set ZIP=
for /f "delims=" %%F in ('powershell -NoProfile -Command "Get-ChildItem '%DOWNLOADS%\R*.zip' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName"') do set ZIP=%%F

if "%ZIP%"=="" (
    echo  No R*.zip found in Downloads. Nothing to extract.
    echo  Building current source...
    echo.
    goto BUILD
)

echo  Found: %ZIP%
echo  Extracting to %PROJECT% ...
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%PROJECT%' -Force"

if %errorlevel% neq 0 (
    echo.
    echo  EXTRACT FAILED.
    goto DONE
)

:: Move zip to deployed subfolder so it's not picked up again
if not exist "%DOWNLOADS%\deployed" mkdir "%DOWNLOADS%\deployed"
move "%ZIP%" "%DOWNLOADS%\deployed\" >nul 2>&1
echo  Extracted and archived zip.
echo.

:: ── Build ────────────────────────────────────────────────────────────
:BUILD
echo  Building...
echo.
call npm run build

if %errorlevel% neq 0 (
    echo.
    echo  BUILD FAILED — fix errors above before deploying.
    echo  To restore: git checkout pre-deploy_%TIMESTAMP% -- src/
    goto DONE
)

echo.
echo  Build succeeded.
echo.

:: ── Commit and push ──────────────────────────────────────────────────
set /p MSG="Commit message (or press Enter for default): "
if "%MSG%"=="" set MSG=deploy %date% %time:~0,5%

git add .
git commit -m "%MSG%"
git push

echo.
echo  Done. Vercel will deploy in ~60 seconds.
echo  https://woodshop-pdd2.vercel.app
echo.
echo  Restore point: git checkout pre-deploy_%TIMESTAMP% -- src/
echo.

:DONE
echo.
echo  Press any key to close...
pause >nul
