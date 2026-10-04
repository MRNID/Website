@echo off
chcp 65001 >nul
title PACKING VIDEO PROOF - Khoi dong he thong
echo ========================================================
echo       PACKING VIDEO PROOF - STANDALONE LAN SYSTEM       
echo                 HỆ THỐNG ĐÓNG GÓI VIDEO                 
echo ========================================================
echo.

cd /d "%~dp0\.."

echo [1/4] Dang khoi dong Backend API (Port 4000)...
start "PACKING_BACKEND_API" /min cmd /c "node apps\backend-api\dist\main.js"
timeout /t 3 /nobreak >nul

echo [2/4] Dang khoi dong Video Worker Dahua Camera...
start "PACKING_VIDEO_WORKER" /min cmd /c "node apps\video-worker\dist\index.js"
timeout /t 2 /nobreak >nul

echo [3/4] Dang khoi dong User Web - Ban Dong Hang (Port 3000)...
start "PACKING_USER_WEB" /min cmd /c "npx pnpm --filter @packing-proof/user-web preview --port 3000 --host 0.0.0.0"

echo [4/4] Dang khoi dong Admin Web - Quan Tri Kho (Port 3001)...
start "PACKING_ADMIN_WEB" /min cmd /c "npx pnpm --filter @packing-proof/admin-web preview --port 3001 --host 0.0.0.0"

timeout /t 4 /nobreak >nul
echo.
echo ========================================================
echo   HE THONG DA KHOI DONG THANH CONG!                     
echo   - Ban dong hang (User):  http://localhost:3000        
echo   - Quan tri kho (Admin):  http://localhost:3001        
echo   - REST API & WebSocket:  http://localhost:4000        
echo ========================================================
echo.
pause
