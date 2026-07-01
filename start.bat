@echo off
title PC Remote Lock Server
echo Detecting Python installation...

for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "Get-ItemProperty -Path HKCU:\Software\Python\PythonCore\*\InstallPath, HKLM:\Software\Python\PythonCore\*\InstallPath -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ExecutablePath -First 1"`) do set "PYTHON_EXE=%%i"

if "%PYTHON_EXE%"=="" (
    set "PYTHON_EXE=python"
)

echo Using Python: %PYTHON_EXE%
echo Starting server...
"%PYTHON_EXE%" "%~dp0web\app.py"
pause
