@echo off
setlocal

set PROJECT=C:\Users\John Hyde\Documents\woodshop-app
set DOWNLOADS=%USERPROFILE%\Downloads

echo.
echo  JDH Woodworks — Deploy
echo  =======================
echo.

:: Find the newest zip in Downloads that starts with R (R1-drop-in, R1-hotfix, R2-drop-in, etc.)
for /f "delims=" %%F in ('powershell -NoProfile -Command "Get-ChildItem '%DOWNLOADS%\R*.zip' | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName"') do set ZIP=%%F

if "%ZIP%"=="" (
    echo  No R*.zip found in Downloads. Nothing to extract.
    echo  Skipping to build...
    echo.
    goto BUILD
)

echo  Found: %ZIP%
echo  Extracting to %PROJECT% ...
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%PROJECT%' -Force"

if %errorlevel% neq 0 (
    echo  EXTRACT FAILED.
    pause
    exit /b 1
)

:: Move zip to a "deployed" subfolder so it's not picked up again
if not exist "%DOWNLOADS%\deployed" mkdir "%DOWNLOADS%\deployed"
move "%ZIP%" "%DOWNLOADS%\deployed\" >nul 2>&1
echo  Extracted and archived zip.
echo.

:BUILD
cd /d "%PROJECT%"

npm run build
if %errorlevel% neq 0 (
    echo.
    echo  BUILD FAILED — fix errors above before deploying.
    pause
    exit /b 1
)

set /p MSG="Commit message (or press Enter for default): "
if "%MSG%"=="" set MSG=deploy %date% %time:~0,5%

git add .
git commit -m "%MSG%"
git push

echo.
echo  Done. Vercel will deploy in ~60 seconds.
echo  https://woodshop-pdd2.vercel.app
echo.
pause
