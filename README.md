# Kreo Meet

Custom no-package browser meeting MVP.

## Features

- Custom Node.js HTTP server
- Custom WebSocket signaling
- Browser WebRTC video/audio rooms
- Host/speaker and attendee/watch-only roles
- Chat
- Screen share
- Raise hand
- Attendance JSON + CSV export
- HTTPS-ready behind Caddy/reverse proxy

## Run locally

```bash
npm start
```

Then open:

```text
http://127.0.0.1:8080
```

## Production notes

Camera/mic requires HTTPS in browsers. Use a domain with HTTPS, for example:

```text
https://meet.believeinunity.org
```

Recommended deployment: run this app on `127.0.0.1:8080` and proxy HTTPS traffic through Caddy or Nginx.

For 1,000-user events, use webinar mode: hosts/speakers publish media, attendees watch and interact via chat/raise-hand. A true production 1,000-user platform needs a custom SFU/HLS pipeline as the next phase.
