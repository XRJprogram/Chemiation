@echo off
chcp 65001 > nul
title Chemiation Chemistry Studio - Server Host

echo =====================================================================
echo          CHEMIATION · 化学反应原理机理推演工坊 (全栈服务主机)
echo =====================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js 环境，请先安装 Node.js (https://nodejs.org)
    echo.
    pause
    exit /b 1
)

echo [1/3] 正在启动 Chemiation 本地专有化学推演服务端...
echo [2/3] 客户端主站地址:   http://localhost:3000
echo [3/3] 服务器监控管理台: http://localhost:3000/admin.html
echo.
echo =====================================================================
echo   默认管理员账号: admin / admin123
echo   按 Ctrl + C 可终止服务
echo =====================================================================
echo.
echo 正在启动服务并在就绪后自动打开浏览器...
echo.

node "%~dp0server\server.js" --open

pause
