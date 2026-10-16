@echo off
cd /d "%~dp0"
chcp 65001 >nul
title Chemiation Server Host

echo =====================================================================
echo          CHEMIATION - Chemical Reaction Principle Studio
echo          化学反应原理机理推演工坊 (全栈服务主机)
echo =====================================================================
echo.

node -v >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not found on your system!
    echo [错误] 未检测到 Node.js 环境，请先安装 Node.js: https://nodejs.org
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
echo   服务启动就绪后将自动打开浏览器，按 Ctrl + C 可终止服务
echo =====================================================================
echo.

node "server\server.js" --open

if errorlevel 1 (
    echo.
    echo [服务异常退出，请查看上方错误信息]
)

pause