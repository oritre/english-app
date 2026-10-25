#!/bin/sh
# Starts Tailscale (when there is an auth key) with Funnel on the video port,
# so the videos have a public https address, then the video server.
set -e
KEY=$(python3 -c "import json;print(json.load(open('/data/options.json')).get('tailscale_authkey') or '')")
NAME=$(python3 -c "import json;print(json.load(open('/data/options.json')).get('tailscale_hostname') or 'english-media')")
if [ -n "$KEY" ]; then
  mkdir -p /data/tailscale
  tailscaled --tun=userspace-networking --statedir=/data/tailscale --socket=/tmp/tailscaled.sock &
  # In the background, so the video server starts even while Tailscale waits:
  # `funnel` waits until Funnel is allowed in the tailnet and prints the link that allows it.
  (
    sleep 3
    timeout 120 tailscale --socket=/tmp/tailscaled.sock up --authkey="$KEY" --hostname="$NAME" || echo "tailscale up failed"
    tailscale --socket=/tmp/tailscaled.sock funnel --bg 8811 || echo "tailscale funnel failed"
    tailscale --socket=/tmp/tailscaled.sock funnel status || true
  ) &
else
  echo "No tailscale_authkey: the videos are only on the home network (port 8811)."
fi
exec python3 /server.py
