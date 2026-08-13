@echo off
rem Starts the pokepack hub and opens it in a browser.  Double-click this file.
rem
rem Nothing to install first except Node.js -- pokepack has no dependencies of
rem its own, so there is no "npm install" step to forget.
rem
rem The cd is not decoration.  The hub looks for the packs folder relative to
rem wherever it was started from, so this has to run in the folder it lives in
rem and not in whatever folder a shortcut happened to point at.
setlocal
cd /d "%~dp0"
title pokepack hub

where node >nul 2>nul
if errorlevel 1 goto :no_node

for /f "tokens=1 delims=." %%v in ('node -e "process.stdout.write(process.versions.node)" 2^>nul') do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR goto :broken_node
if %NODE_MAJOR% LSS 18 goto :old_node

node bin\pokepack.js ui %*
set "STOPPED=%ERRORLEVEL%"

rem 0 is a clean exit.  The large negative number is what ctrl-c looks like from
rem out here, and ctrl-c is how you are meant to stop the hub -- neither one is
rem worth stopping to read a message about.
if "%STOPPED%"=="0" exit /b 0
if "%STOPPED%"=="-1073741510" exit /b 0
echo.
echo The hub stopped with an error -- the message above says why.
echo.
pause
exit /b %STOPPED%

:no_node
echo.
echo pokepack needs Node.js, and this account does not have it.
echo.
echo   1. Install it from https://nodejs.org  -- take the LTS download
echo   2. Close this window
echo   3. Double-click this file again
echo.
echo Step 2 matters: a window opened before the install will not see it.
echo.
pause
exit /b 1

:broken_node
echo.
echo Node.js is on this account but would not run.  Reinstalling it from
echo https://nodejs.org usually sorts it.
echo.
pause
exit /b 1

:old_node
echo.
echo pokepack needs Node.js 18 or newer, and this account has version %NODE_MAJOR%.
echo Update it from https://nodejs.org and double-click this file again.
echo.
pause
exit /b 1
