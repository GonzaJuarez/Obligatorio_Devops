# ===== STAGE 1: build =====
FROM python:3.11-slim AS builder

COPY . /app

WORKDIR /app

RUN pip install --no-cache-dir --upgrade -r requirements.txt && cp $(which uvicorn) /app

RUN chown -R 65532:65532 /app

# ===== STAGE 2: backend =====
FROM gcr.io/distroless/python3-debian12:nonroot

COPY --from=builder /app /app
COPY --from=builder /usr/local/lib/python3.*/site-packages /usr/local/lib/python3.*/site-packages
ENV PYTHONPATH=/usr/local/lib/python3.*/site-packages
    
 
WORKDIR /app
USER nonroot

EXPOSE 8000

CMD ["./uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]