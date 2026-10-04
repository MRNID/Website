@echo off
chcp 65001 >nul
title PACKING VIDEO PROOF - Dung he thong
echo ========================================================
echo       DANG DUNG TOAN BO HE THONG PACKING PROOF         
echo ========================================================
echo.

echo Dang tat cac tien trinh node / vite / preview...
taskkill /fi "WINDOWTITLE eq PACKING_BACKEND_API*" /f /t >nul 2>&1
taskkill /fi "WINDOWTITLE eq PACKING_VIDEO_WORKER*" /f /t >nul 2>&1
taskkill /fi "WINDOWTITLE eq PACKING_USER_WEB*" /f /t >nul 2>&1
taskkill /fi "WINDOWTITLE eq PACKING_ADMIN_WEB*" /f /t >nul 2>&1

echo Hoan tat! He thong da dung an toan.
timeout /t 2 /nobreak >nul
