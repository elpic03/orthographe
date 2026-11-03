@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
echo Mise a jour des listes du quiz...
echo.
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "app\outils\generer_donnees.py"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo ERREUR : Python est introuvable sur cet ordinateur.
    echo Installe Python depuis https://www.python.org puis relance ce fichier.
  ) else (
    python "app\outils\generer_donnees.py"
  )
)
echo.
pause
