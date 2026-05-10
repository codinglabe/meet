# Kreo Meet

A modern Next.js meeting application with custom WebRTC signaling.

## Features

- Next.js App Router UI
- Custom Node.js HTTP + WebSocket signaling server
- Browser WebRTC video/audio rooms
- Host/speaker and attendee/watch-only roles
- Chat
- Screen share
- Raise hand
- Attendance JSON + CSV export
- GitHub Actions auto-deploy to EC2

## Run locally

```bash
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:8080
```

or:

```text
http://localhost:8080
```

## Production

Build and start:

```bash
npm ci
npm run build
npm start
```

Camera/mic requires HTTPS in browsers. Use a domain with HTTPS, for example:

```text
https://meet.believeinunity.org
```

Recommended deployment: run this app on `127.0.0.1:8080` and proxy HTTPS traffic through Caddy or Nginx.

For 1,000-user events, use webinar mode: hosts/speakers publish media, attendees watch and interact via chat/raise-hand. A true production 1,000-user platform needs a custom SFU/HLS pipeline as the next phase.
