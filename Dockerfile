FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m nltk.downloader stopwords


COPY main.py module.py ./
COPY archive/CEAS_08.csv archive/CEAS_08.csv

ENV PORT=8080
# Optional: documents only; Cloud Run ignores EXPOSE
EXPOSE 8080

# Start a production WSGI server that binds to 0.0.0.0:$PORT
# ...

# Cloud Run will overwrite PORT; shell expands it at runtime
CMD exec gunicorn -b 0.0.0.0:$PORT main:app

