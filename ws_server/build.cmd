@echo off
cd /d "%~dp0"
tar -a -c -f handler.zip handler.js node_modules package.json
echo Done: handler.zip