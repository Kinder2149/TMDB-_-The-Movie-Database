@echo off
chcp 65001 >nul
title Suivi Films et Series - Lanceur
cd /d "%~dp0"

echo ============================================
echo   Suivi Films et Series - demarrage
echo ============================================
echo.
echo Ouverture de deux fenetres : Back (API) et Front (interface).
echo Le navigateur s'ouvrira automatiquement.
echo Pour tout arreter : fermez les deux fenetres qui s'ouvrent.
echo.

REM Les sous-dossiers "server" et "client" n'ont pas d'espace : le cd relatif suffit.
start "Suivi - Back (API)"  cmd /k "cd server & npm run dev"
start "Suivi - Front (UI)"  cmd /k "cd client & npm run dev"

REM Laisse le temps aux serveurs de demarrer avant d'ouvrir le navigateur.
timeout /t 5 /nobreak >nul
start "" http://localhost:5173

echo.
echo C'est parti. Cette fenetre peut etre fermee.
timeout /t 3 /nobreak >nul
