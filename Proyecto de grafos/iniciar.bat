@echo off
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" app.py
) else if exist ".venv\bin\python.exe" (
    ".venv\bin\python.exe" app.py
) else (
    echo Primero crea el entorno virtual e instala requirements.txt. Consulta README.md.
    pause
    exit /b 1
)
