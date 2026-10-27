@echo off
rem Local development database for Windows without Docker (PostgreSQL 16 installed directly).
rem Creates the user and database from .env.example. Asks for the "postgres" password once;
rem it is typed into this window only and never saved.

set PSQL="C:\Program Files\PostgreSQL\16\bin\psql.exe"
if not exist %PSQL% (
  echo PostgreSQL 16 was not found in "C:\Program Files\PostgreSQL\16".
  pause
  exit /b 1
)

echo.
echo  Khmio - local database setup
echo  ----------------------------------------
echo  Type the password you chose for the "postgres" user when you installed PostgreSQL,
echo  then press Enter. Nothing shows while you type - that is normal.
echo.

%PSQL% -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -f "%~dp0setup-local-db.sql"
if errorlevel 1 (
  echo.
  echo  Something went wrong - see the message above. If it says "password authentication failed",
  echo  the postgres password was mistyped: run this file again.
) else (
  echo.
  echo  All done. You can close this window.
)
echo.
pause
