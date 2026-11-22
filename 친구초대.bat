@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 머서너리 - 친구 초대

where cloudflared >nul 2>nul
if errorlevel 1 (
  echo.
  echo [!] cloudflared가 설치되어 있지 않습니다. 인터넷으로 친구를 초대하려면 필요합니다.
  echo     명령 프롬프트에서 아래를 한 번 실행한 뒤 이 파일을 다시 켜세요:
  echo         winget install --id Cloudflare.cloudflared
  echo.
  pause
  exit /b 1
)

echo 1) 게임 서버를 켭니다 (새 창, 새 버전이 올라오면 스스로 업데이트)
start "머서너리 서버" cmd /k node scripts/auto-update.mjs

echo 2) 인터넷 터널을 엽니다 (새 창)
set "LOG=%TEMP%\mercenary-tunnel.log"
if exist "%LOG%" del "%LOG%"
start "머서너리 터널" cmd /c "cloudflared tunnel --url http://localhost:8080 2> "%LOG%""

echo 3) 친구들에게 알려 줄 주소를 기다립니다...
set /a tries=0
set "URL="
:wait
set /a tries+=1
for /f "delims=" %%u in ('powershell -NoProfile -Command "$m = Select-String -Path '%LOG%' -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($m) { $m.Matches[0].Value }"') do set "URL=%%u"
if defined URL goto found
if %tries% GEQ 30 goto fail
timeout /t 2 >nul
goto wait

:found
echo.
echo ============================================================
echo   친구들에게 이 주소를 알려 주세요 (복사해 두었습니다):
echo.
echo       %URL%
echo.
echo   - 서버 창이 "서버를 켭니다" 뒤로 준비될 때까지 1~2분쯤 걸릴 수 있습니다.
echo   - 이 주소는 터널을 켤 때마다 바뀝니다. 끄려면 서버·터널 창을 닫으세요.
echo ============================================================
echo.
powershell -NoProfile -Command "Set-Clipboard -Value '%URL%'" >nul 2>nul
pause
exit /b 0

:fail
echo.
echo [!] 터널 주소를 찾지 못했습니다. "머서너리 터널" 창의 메시지를 확인해 주세요.
echo     (인터넷 연결, 방화벽, cloudflared 설치를 확인하세요)
pause
exit /b 1
