FROM python:3.11-slim

# ODA File Converter requires these runtime libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglu1-mesa libx11-6 libxext6 libxrender1 libfontconfig1 \
    libfreetype6 libxi6 libsm6 libice6 libxcursor1 libxfixes3 \
    libxrandr2 libxcomposite1 libxdamage1 libxtst6 libxss1 \
    && rm -rf /var/lib/apt/lists/*

# ODA File Converter — place the Linux .deb in deploy/ before building
# Download from https://www.opendesign.com/guestfiles/oda_file_converter
COPY deploy/ODAFileConverter_*.deb /tmp/oda.deb
RUN dpkg -i /tmp/oda.deb || apt-get install -f -y && rm /tmp/oda.deb

WORKDIR /app
COPY web/ /app/web/
COPY assets/cad/oda_out/ /app/assets/cad/oda_out/
COPY deploy/server.py /app/deploy/server.py

ENV ODA_CONVERTER=/usr/bin/ODAFileConverter
ENV PORT=10000
EXPOSE 10000

CMD ["python3", "/app/deploy/server.py"]
