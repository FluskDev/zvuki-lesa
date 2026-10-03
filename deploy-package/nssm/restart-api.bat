@echo off
setlocal

REM ============================================================
REM Рестарт сервиса ZvukiLesaAPI (NSSM)
REM ============================================================

if "%NSSM%"=="" set NSSM=C:\nssm\win64\nssm.exe
set SERVICE_NAME=ZvukiLesaAPI

if not exist "%NSSM%" (
  echo ERROR: NSSM not found at "%NSSM%"
  exit /b 1
)

echo === Restarting %SERVICE_NAME% ===
%NSSM% restart %SERVICE_NAME%
if errorlevel 1 (
  echo ERROR: restart failed.
  exit /b 1
)
echo === Done ===
endlocal
