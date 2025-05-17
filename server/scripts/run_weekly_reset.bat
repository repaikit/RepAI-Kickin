@echo off
cd /d %~dp0\..
echo [%date% %time%] Starting weekly reset check >> logs/weekly_reset.log
python scripts/weekly_reset.py >> logs/weekly_reset.log 2>&1
echo [%date% %time%] Completed weekly reset check >> logs/weekly_reset.log 