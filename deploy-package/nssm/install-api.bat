@echo off
setlocal

REM ============================================================
REM Установка ZvukiLesa-API как Windows-сервис через NSSM
REM ============================================================

REM --- Настройки (можно переопределить через переменные среды) ---
if "%NSSM%"=="" set NSSM=C:\nssm\win64\nssm.exe
if "%API_DIR%"=="" set API_DIR=E:\ZvukiLesa\api
if "%NODE_EXE%"=="" set NODE_EXE=C:\Program Files\nodejs\node.exe
set SERVICE_NAME=ZvukiLesaAPI
set DISPLAY_NAME=Zvuki Lesa Backend API
set DESCRIPTION=Express API for zvukilesa.ru (Astro SSG + admin SPA)

echo.
echo === Installing %SERVICE_NAME% ===
echo   NSSM:      %NSSM%
echo   API dir:   %API_DIR%
echo   Node:      %NODE_EXE%
echo.

REM --- Проверки ---
if not exist "%NSSM%" (
  echo ERROR: NSSM not found at "%NSSM%"
  echo   Скачать: https://nssm.cc/download ^(распаковать в C:\nssm^)
  exit /b 1
)
if not exist "%NODE_EXE%" (
  echo ERROR: Node.exe not found at "%NODE_EXE%"
  exit /b 1
)
if not exist "%API_DIR%\dist\server.js" (
  echo ERROR: %API_DIR%\dist\server.js not found.
  echo   Сначала выполните install.bat, который копирует backend.
  exit /b 1
)
if not exist "%API_DIR%\.env" (
  echo ERROR: %API_DIR%\.env not found.
  echo   Скопируйте api.env.example в .env и заполните секреты.
  exit /b 1
)

REM --- Удалить существующий сервис (если есть) ---
%NSSM% stop %SERVICE_NAME% >nul 2>&1
%NSSM% remove %SERVICE_NAME% confirm >nul 2>&1

REM --- Установка ---
%NSSM% install %SERVICE_NAME% "%NODE_EXE%" "--env-file=.env dist\server.js"
if errorlevel 1 (
  echo ERROR: nssm install failed.
  exit /b 1
)

%NSSM% set %SERVICE_NAME% AppDirectory "%API_DIR%"
%NSSM% set %SERVICE_NAME% DisplayName "%DISPLAY_NAME%"
%NSSM% set %SERVICE_NAME% Description "%DESCRIPTION%"
%NSSM% set %SERVICE_NAME% Start SERVICE_AUTO_START
%NSSM% set %SERVICE_NAME% AppPriority NORMAL_PRIORITY_CLASS
%NSSM% set %SERVICE_NAME% AppStdout "%API_DIR%\logs\api-stdout.log"
%NSSM% set %SERVICE_NAME% AppStderr "%API_DIR%\logs\api-stderr.log"
%NSSM% set %SERVICE_NAME% AppRotateFiles 1
%NSSM% set %SERVICE_NAME% AppRotateBytes 10485760

REM --- Ротация и восстановление после сбоев ---
%NSSM% set %SERVICE_NAME% AppRestartDelay 5000
%NSSM% set %SERVICE_NAME% AppExitAction Restart

REM --- Создать logs/ если нет ---
if not exist "%API_DIR%\logs" mkdir "%API_DIR%\logs"

REM --- Старт ---
%NSSM% start %SERVICE_NAME%
if errorlevel 1 (
  echo ERROR: nssm start failed. Проверьте логи в %API_DIR%\logs\
  exit /b 1
)

echo.
echo === %SERVICE_NAME% installed and started ===
echo   Логи:   %API_DIR%\logs\
echo   Стоп:   nssm stop %SERVICE_NAME%
echo   Старт:  nssm start %SERVICE_NAME%
echo   Удалить: nssm\uninstall-api.bat
echo.
endlocal
