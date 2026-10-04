@echo off
chcp 65001 >nul
title Go bo Tu khoi dong cung Windows
echo ========================================================
echo   GO BO TAC VU TU DONG KHOI DONG CUNG WINDOWS          
echo ========================================================
echo.

set TASK_NAME=PackingVideoProofAutoStart

schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

echo [OK] Da go bo thanh cong tac vu tu khoi dong.
echo.
pause
