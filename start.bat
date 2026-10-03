@echo off
REM Zvuki Lesa - launcher. Dvumya processami: backend + frontend.

echo Starting backend on :3001 and frontend on :5173 ...
echo.

REM Backend (port 3001)
start "BACKEND 3001" cmd /k "npm run backend:dev"

REM Wait a bit so backend is up before Vite starts proxying
ping 127.0.0.1 -n 4 >nul

REM Frontend (port 5173)
start "FRONTEND 5173" cmd /k "npm run dev"

REM Wait for Vite to bind 5173
ping 127.0.0.1 -n 6 >nul

REM Open browser
start http://localhost:5173

echo Done. Close this window any time - servers keep running in their own consoles.
echo Backend  : http://localhost:3001
echo Frontend : http://localhost:5173
echo To stop  : close the BACKEND / FRONTEND console windows (or Ctrl+C there).
pause