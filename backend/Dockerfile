FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required by OpenCV and image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source files
COPY . .

# Ensure yolov8n.pt model exists in models/ or download if needed
RUN if [ ! -f yolov8n.pt ] && [ ! -f models/yolov8n.pt ]; then \
      curl -L -o yolov8n.pt https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt ; \
    fi

EXPOSE 8000

ENV PORT=8000
ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
