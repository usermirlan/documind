FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 FASTEMBED_CACHE_PATH=/models
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Bake the local embedding model into the image (skip with --build-arg PRELOAD_MODEL=0 when using Gemini)
ARG PRELOAD_MODEL=1
RUN if [ "$PRELOAD_MODEL" = "1" ]; then python -c "from fastembed import TextEmbedding; TextEmbedding('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', cache_dir='/models')"; fi
COPY . .
EXPOSE 8000
CMD ["sh", "entrypoint.sh"]
