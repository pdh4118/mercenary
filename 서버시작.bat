@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 머서너리 서버를 켭니다. 새 버전이 올라오면 스스로 업데이트합니다. 끄려면 이 창을 닫거나 Ctrl+C.
node scripts/auto-update.mjs
pause
