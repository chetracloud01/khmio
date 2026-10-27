@echo off
rem Local photo storage for Windows without Docker: SeaweedFS, a free S3-compatible server that
rem stands in for Cloudflare R2 while developing (same code, only the settings change). "pnpm s3:up".
rem The first run downloads weed.exe (version 4.48, about 47 MB) into infra\bin; data stays in .s3-data.
rem Who may do what is in infra\local-s3.json: the API's local login (localdev / localdev-secret,
rem used nowhere else), and anyone may read the khmio-photos bucket - like R2's public access.

set ROOT=%~dp0..
set WEED=%~dp0bin\weed.exe
if not exist "%WEED%" (
  echo Downloading SeaweedFS 4.48 for Windows...
  if not exist "%~dp0bin" mkdir "%~dp0bin"
  curl -L --fail -o "%~dp0bin\seaweedfs.zip" https://github.com/seaweedfs/seaweedfs/releases/download/4.48/windows_amd64.zip
  if errorlevel 1 (
    echo Download failed - check the internet connection and run "pnpm s3:up" again.
    exit /b 1
  )
  rem Windows' own tar (Git's tar reads "D:" as a network host).
  "%SystemRoot%\System32\tar.exe" -xf "%~dp0bin\seaweedfs.zip" -C "%~dp0bin"
  if not exist "%WEED%" (
    echo Unpacking failed - delete infra\bin and run "pnpm s3:up" again.
    exit /b 1
  )
  del "%~dp0bin\seaweedfs.zip"
)

rem Only this PC can reach it, unless S3_LAN=1 (phones testing on your Wi-Fi need the photos):
rem   set S3_LAN=1 ^&^& pnpm s3:up      then FILES_PUBLIC_URL=http://<this PC's Wi-Fi address>:9000/khmio-photos
set BIND=127.0.0.1
if "%S3_LAN%"=="1" set BIND=0.0.0.0

if not exist "%ROOT%\.s3-data" mkdir "%ROOT%\.s3-data"
echo.
echo  Local S3: http://localhost:9000 (bucket khmio-photos). First time, in another window: pnpm files:setup
echo  Ctrl+C stops it.
echo.
"%WEED%" server -dir="%ROOT%\.s3-data" -ip=127.0.0.1 -ip.bind=%BIND% -master.volumeSizeLimitMB=64 -volume.max=0 -s3 -s3.port=9000 -s3.config="%~dp0local-s3.json"
