@echo off
chcp 65001 >nul
title Cai dat Tu khoi dong cung Windows
echo ========================================================
echo   CAI DAT HE THONG TU DONG KHOI DONG CUNG WINDOWS      
echo ========================================================
echo.

set TASK_NAME=PackingVideoProofAutoStart
set SCRIPT_PATH=%~dp0start-all.bat

echo Dang tao tac vu Scheduled Task trong Windows...
schtasks /create /tn "%TASK_NAME%" /tr "\"%SCRIPT_PATH%\"" /sc onlogon /rl highest /f

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Cai dat thanh cong!
    echo Moi khi mo may tinh hoac dang nhap Windows, he thong se tu dong khoi dong.
) else (
    echo.
    echo [!] Vui long chay file nay voi quyen Run as Administrator de cai dat Task Scheduler.
)
echo.
pause
