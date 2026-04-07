#!/bin/bash
# Azure App Service startup script for FinTrack ML API
cd /home/site/wwwroot
gunicorn -w 2 -k uvicorn.workers.UvicornWorker api:app --bind 0.0.0.0:8000
