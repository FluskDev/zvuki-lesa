@echo off
setlocal

REM ============================================================
REM Удаление сервиса ZvukiLesaAPI (NSSM)
REM ============================================================

if "%NSSM%"=="" set NSSM=C:\nssm\win64\nssm.exe
set SERVICE_NAME=ZvukiLesaAPI

if not exist "%NSSM%" (
  echo ERROR: NSSM not found at "%NSSM%"
  exit /b 1
)

echo.
echo === Removing %SERVICE_NAME% ===

%NSSM% stop %SERVICE_NAME% >nul 2>&1
%NSSM% remove %SERVICE_NAME% confirm
if errorlevel 1 (
  echo ERROR: nssm remove failed.
  exit /b 1
)

echo === Done ===
endlocal
