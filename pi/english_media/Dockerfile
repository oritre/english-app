# build.yaml names the base per architecture; the default covers a Supervisor that passes none.
ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
FROM $BUILD_FROM
# yt-dlp needs a JavaScript runtime for YouTube (node, with yt-dlp-ejs from the [default] extra).
RUN apk add --no-cache python3 py3-pip ffmpeg nodejs tailscale \
 && pip install --no-cache-dir --break-system-packages "yt-dlp[default]"
COPY server.py run.sh /
RUN chmod a+x /run.sh
CMD ["/run.sh"]
