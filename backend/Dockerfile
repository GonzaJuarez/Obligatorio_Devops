# ===== STAGE 1: build =====
FROM python:3.11-slim AS builder

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade \
-r requirements.txt \
--target /app/deps

COPY . /app

RUN chown -R 65532:65532 /app

# ===== STAGE 2: backend =====
FROM gcr.io/distroless/python3-debian12:nonroot

WORKDIR /app

COPY --from=builder /app/deps /app/deps
COPY --from=builder /app /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/deps

USER nonroot

EXPOSE 8000

CMD ["-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
