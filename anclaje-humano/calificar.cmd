@echo off
rem Doble clic: abre la hoja de calificacion con autoguardado en disco.
rem Deja esta ventana abierta mientras calificas. Para cerrar: Ctrl+C o cierra la ventana.
cd /d "%~dp0.."
node anclaje-humano\calificar.mjs
pause
