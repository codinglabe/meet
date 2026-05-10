'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const rooms = new Map(); // roomId -> Map(socketId -> client)
const attendance = new Map(); // roomId -> Map(socketId -> record)

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function safeRoom(room) {
  return String(room || 'lobby').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'lobby';
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, time: new Date().toISOString() }));
    return;
  }
  if (url.pathname.startsWith('/api/attendance/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const roomId = safeRoom(parts[2]);
    const format = parts[3] || 'json';
    const records = [...(attendance.get(roomId) || new Map()).values()].map(r => ({
      ...r,
      leftAt: r.leftAt || null,
      durationSeconds: Math.round(((r.leftAt ? Date.parse(r.leftAt) : Date.now()) - Date.parse(r.joinedAt)) / 1000)
    }));
    if (format === 'csv') {
      const esc = v => '"' + String(v ?? '').replaceAll('\"', '\"\"') + '"';
      const head = ['id','name','role','joinedAt','leftAt','durationSeconds','userAgent'];
      const csv = [head.join(','), ...records.map(r => head.map(k => esc(r[k])).join(','))].join('\n');
      res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename=attendance-${roomId}.csv` });
      res.end(csv);
    } else {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ roomId, count: records.length, records }, null, 2));
    }
    return;
  }

  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  if (file === '/room') file = '/index.html';
  const full = path.normalize(path.join(PUBLIC_DIR, file));
  if (!full.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'content-type': contentType(full) });
    res.end(data);
  });
});

server.on('upgrade', (req, socket) => {
  if (req.headers.upgrade?.toLowerCase() !== 'websocket') return socket.destroy();
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  const accept = crypto.createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '', ''
  ].join('\r\n'));

  const id = crypto.randomBytes(8).toString('hex');
  const client = { id, socket, roomId: null, name: 'Guest', role: 'attendee', alive: true, buffer: Buffer.alloc(0) };

  socket.on('data', chunk => {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    let frame;
    while ((frame = readFrame(client)) !== null) {
      if (frame.opcode === 8) return socket.end();
      if (frame.opcode === 9) sendFrame(socket, frame.payload, 10);
      if (frame.opcode === 1) handleMessage(client, frame.payload.toString('utf8'));
    }
  });
  socket.on('close', () => leave(client));
  socket.on('error', () => leave(client));
});

function readFrame(client) {
  const b = client.buffer;
  if (b.length < 2) return null;
  const opcode = b[0] & 0x0f;
  const masked = (b[1] & 0x80) !== 0;
  let len = b[1] & 0x7f;
  let offset = 2;
  if (len === 126) { if (b.length < 4) return null; len = b.readUInt16BE(2); offset = 4; }
  else if (len === 127) { if (b.length < 10) return null; const big = b.readBigUInt64BE(2); if (big > BigInt(10 * 1024 * 1024)) throw new Error('Frame too large'); len = Number(big); offset = 10; }
  const maskOffset = offset;
  if (masked) offset += 4;
  if (b.length < offset + len) return null;
  let payload = b.subarray(offset, offset + len);
  if (masked) {
    const mask = b.subarray(maskOffset, maskOffset + 4);
    payload = Buffer.from(payload.map((byte, i) => byte ^ mask[i % 4]));
  }
  client.buffer = b.subarray(offset + len);
  return { opcode, payload };
}

function sendFrame(socket, payload, opcode = 1) {
  if (socket.destroyed) return;
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  let header;
  if (data.length < 126) header = Buffer.from([0x80 | opcode, data.length]);
  else if (data.length < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(data.length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(data.length), 2); }
  socket.write(Buffer.concat([header, data]));
}

function send(client, obj) { sendFrame(client.socket, JSON.stringify(obj)); }
function broadcast(roomId, obj, exceptId = null) {
  const room = rooms.get(roomId); if (!room) return;
  for (const [id, c] of room) if (id !== exceptId) send(c, obj);
}
function peers(roomId) {
  return [...(rooms.get(roomId) || new Map()).values()].map(c => ({ id: c.id, name: c.name, role: c.role }));
}
function handleMessage(client, raw) {
  let msg; try { msg = JSON.parse(raw); } catch { return; }
  if (msg.type === 'join') {
    client.roomId = safeRoom(msg.roomId);
    client.name = String(msg.name || 'Guest').slice(0, 60);
    client.role = msg.role === 'host' ? 'host' : 'attendee';
    if (!rooms.has(client.roomId)) rooms.set(client.roomId, new Map());
    rooms.get(client.roomId).set(client.id, client);
    if (!attendance.has(client.roomId)) attendance.set(client.roomId, new Map());
    attendance.get(client.roomId).set(client.id, {
      id: client.id, name: client.name, role: client.role,
      joinedAt: new Date().toISOString(), leftAt: null,
      userAgent: String(msg.userAgent || '').slice(0, 180)
    });
    send(client, { type: 'welcome', id: client.id, peers: peers(client.roomId) });
    broadcast(client.roomId, { type: 'peer-joined', peer: { id: client.id, name: client.name, role: client.role }, peers: peers(client.roomId) }, client.id);
    return;
  }
  if (!client.roomId) return;
  if (['offer', 'answer', 'ice', 'media-state'].includes(msg.type) && msg.to) {
    const target = rooms.get(client.roomId)?.get(msg.to);
    if (target) send(target, { ...msg, from: client.id, name: client.name });
    return;
  }
  if (msg.type === 'chat') {
    broadcast(client.roomId, { type: 'chat', from: client.id, name: client.name, text: String(msg.text || '').slice(0, 1000), at: new Date().toISOString() });
    return;
  }
  if (msg.type === 'raise-hand') {
    broadcast(client.roomId, { type: 'raise-hand', from: client.id, name: client.name, at: new Date().toISOString() });
    return;
  }
}
function leave(client) {
  if (!client.roomId) return;
  const roomId = client.roomId;
  rooms.get(roomId)?.delete(client.id);
  const rec = attendance.get(roomId)?.get(client.id); if (rec && !rec.leftAt) rec.leftAt = new Date().toISOString();
  broadcast(roomId, { type: 'peer-left', id: client.id, peers: peers(roomId) });
  if (rooms.get(roomId)?.size === 0) rooms.delete(roomId);
  client.roomId = null;
}

server.listen(PORT, HOST, () => console.log(`Kreo Meet running on http://${HOST}:${PORT}`));
