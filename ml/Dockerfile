FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Start the application
CMD ["gunicorn", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "api:app", "--bind", "0.0.0.0:8080"]
