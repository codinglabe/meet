'use strict';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
$('#room').value = params.get('room') || 'main-room';
$('#name').value = localStorage.name || '';

let ws, myId, roomId, localStream, screenStream;
let micOn = true, camOn = true;
const pcs = new Map();
const peers = new Map();
const localVideoId = 'local';

const rtcConfig = { iceServers: [] };

$('#joinForm').onsubmit = e => { e.preventDefault(); join(); };
$('#leave').onclick = () => { location.href = '/'; };

$('#copyLink').onclick = async e => {
  e.stopPropagation();
  try {
    await navigator.clipboard.writeText(location.href);
    const t = $('#copyLink').textContent;
    $('#copyLink').textContent = 'Copied!';
    setTimeout(() => { $('#copyLink').textContent = t; }, 1400);
  } catch (_) {}
};

$('#mic').onclick = () => {
  micOn = !micOn;
  localStream?.getAudioTracks().forEach(t => { t.enabled = micOn; });
  syncMicLabel();
  syncLocalMicOverlay();
};
$('#cam').onclick = () => {
  camOn = !camOn;
  localStream?.getVideoTracks().forEach(t => { t.enabled = camOn; });
  syncCamLabel();
};
$('#screen').onclick = shareScreen;
$('#raiseHand').onclick = () => { send({ type: 'raise-hand' }); addChat('System', 'You raised your hand.'); };
$('#chatForm').onsubmit = e => {
  e.preventDefault();
  const text = $('#chatInput').value.trim();
  if (text) { send({ type: 'chat', text }); addChat('Me', text); $('#chatInput').value = ''; }
};

const appEl = () => $('#app');
function openDrawer(which) {
  const app = appEl();
  if (!app) return;
  app.classList.remove('drawer-chat-open', 'drawer-people-open');
  if (which === 'chat') {
    app.classList.add('drawer-chat-open');
    $('#drawerChat').setAttribute('aria-hidden', 'false');
    $('#drawerPeople').setAttribute('aria-hidden', 'true');
  } else if (which === 'people') {
    app.classList.add('drawer-people-open');
    $('#drawerPeople').setAttribute('aria-hidden', 'false');
    $('#drawerChat').setAttribute('aria-hidden', 'true');
  }
}
function closeDrawers() {
  const app = appEl();
  if (!app) return;
  app.classList.remove('drawer-chat-open', 'drawer-people-open');
  $('#drawerChat')?.setAttribute('aria-hidden', 'true');
  $('#drawerPeople')?.setAttribute('aria-hidden', 'true');
}

$('#btnChatHeader')?.addEventListener('click', () => openDrawer('chat'));
$('#btnChatFooter')?.addEventListener('click', () => openDrawer('chat'));
$('#btnPeopleHeader')?.addEventListener('click', () => openDrawer('people'));
$('#btnPeopleFooter')?.addEventListener('click', () => openDrawer('people'));
$('#closeChatDrawer')?.addEventListener('click', closeDrawers);
$('#closePeopleDrawer')?.addEventListener('click', closeDrawers);

const meetingMenuBtn = $('#meetingMenuBtn');
const meetingMenuPop = $('#meetingMenuPop');
meetingMenuBtn?.addEventListener('click', e => {
  e.stopPropagation();
  const open = meetingMenuPop.hidden;
  meetingMenuPop.hidden = !open;
  meetingMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
});
document.addEventListener('click', () => {
  if (meetingMenuPop && !meetingMenuPop.hidden) {
    meetingMenuPop.hidden = true;
    meetingMenuBtn?.setAttribute('aria-expanded', 'false');
  }
});
meetingMenuPop?.addEventListener('click', e => e.stopPropagation());

$('#btnInfo')?.addEventListener('click', () => {
  meetingMenuPop.hidden = false;
  meetingMenuBtn?.setAttribute('aria-expanded', 'true');
});
$('#btnGalleryView')?.addEventListener('click', () => {
  document.querySelector('.meet-videos')?.classList.toggle('meet-videos--compact');
});

if (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  $('#secureHint').textContent = 'Camera ready';
} else {
  $('#secureHint').textContent = 'Use HTTPS for camera/mic';
}

function formatMeetingTitle(room) {
  const r = String(room || 'Meeting').replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'Meeting';
  return r.split(/[-_\s]+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function syncMicLabel() {
  const lab = $('#mic')?.querySelector('.meet-ctrl__label');
  if (!lab) return;
  const on = lab.getAttribute('data-on') || 'Mute';
  const off = lab.getAttribute('data-off') || 'Unmute';
  lab.textContent = micOn ? on : off;
}
function syncCamLabel() {
  const lab = $('#cam')?.querySelector('.meet-ctrl__label');
  if (!lab) return;
  const on = lab.getAttribute('data-on') || 'Stop video';
  const off = lab.getAttribute('data-off') || 'Start video';
  lab.textContent = camOn ? on : off;
}
function syncLocalMicOverlay() {
  const icon = document.querySelector(`[data-id="${localVideoId}"] .meet-mic-icon`);
  if (icon) icon.classList.toggle('is-muted', !micOn);
}

async function join() {
  roomId = ($('#room').value || 'main-room').replace(/[^a-zA-Z0-9_-]/g, '') || 'main-room';
  const name = ($('#name').value || 'Guest').slice(0, 60);
  localStorage.name = name;
  history.replaceState(null, '', `/?room=${encodeURIComponent(roomId)}`);
  $('#join').classList.add('hidden');
  $('#app').classList.remove('hidden');

  const title = formatMeetingTitle(roomId);
  $('#meetingTitle').textContent = title;
  $('#roomLabelPop').textContent = `Room: ${roomId}`;
  $('#attendance').href = `/api/attendance/${roomId}`;
  $('#attendanceCsv').href = `/api/attendance/${roomId}/csv`;

  const role = $('#role').value;
  if (role === 'host') {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera/mic requires HTTPS or localhost. Open this app with https:// on a trusted domain, not plain http:// public IP.');
      }
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      alert('Camera/mic permission failed: ' + err.message);
      addChat('System', 'Camera/mic unavailable: ' + err.message);
      localStream = new MediaStream();
    }
    addVideo(localVideoId, localStream, 'You', true);
  } else {
    localStream = new MediaStream();
    $('#mic').disabled = true;
    $('#cam').disabled = true;
    $('#screen').disabled = true;
    addVideo(localVideoId, localStream, 'You', true);
    addChat('System', 'Joined as watch-only attendee. Use Raise hand to ask the host to promote you later.');
  }
  syncMicLabel();
  syncCamLabel();

  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => {
    setStatus('Live', 'live');
    send({ type: 'join', roomId, name, role, userAgent: navigator.userAgent });
    setTimeout(() => $('#meetStatus')?.classList.add('is-hidden'), 3200);
  };
  ws.onmessage = ev => handle(JSON.parse(ev.data));
  ws.onclose = () => {
    setStatus('Disconnected', 'offline');
    $('#meetStatus')?.classList.remove('is-hidden');
    addChat('System', 'Disconnected from signaling server.');
  };
}

function setStatus(text, mode = '') {
  const pill = $('#meetStatus');
  if (!pill) return;
  pill.textContent = text;
  pill.classList.remove('live', 'offline', 'is-hidden');
  if (mode === 'live') pill.classList.add('live');
  if (mode === 'offline') pill.classList.add('offline');
}

function send(obj) { ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(obj)); }

async function handle(msg) {
  if (msg.type === 'welcome') {
    myId = msg.id;
    updatePeers(msg.peers);
    for (const p of msg.peers) if (p.id !== myId) await callPeer(p.id, true);
  }
  if (msg.type === 'peer-joined') { updatePeers(msg.peers); await callPeer(msg.peer.id, false); addChat('System', `${msg.peer.name} joined.`); }
  if (msg.type === 'peer-left') { updatePeers(msg.peers); closePeer(msg.id); addChat('System', 'A participant left.'); }
  if (msg.type === 'offer') {
    const pc = makePc(msg.from);
    await pc.setRemoteDescription(msg.sdp);
    localStream?.getTracks().forEach(t => pc.addTrack(t, localStream));
    const ans = await pc.createAnswer();
    await pc.setLocalDescription(ans);
    send({ type: 'answer', to: msg.from, sdp: pc.localDescription });
  }
  if (msg.type === 'answer') { await pcs.get(msg.from)?.setRemoteDescription(msg.sdp); }
  if (msg.type === 'ice') { try { await pcs.get(msg.from)?.addIceCandidate(msg.candidate); } catch (_) {} }
  if (msg.type === 'chat') addChat(msg.name || 'Guest', msg.text);
  if (msg.type === 'raise-hand') addChat('System', `${msg.name || 'Guest'} raised their hand.`);
}

function updatePeers(list) {
  peers.clear();
  list.forEach(p => peers.set(p.id, p));
  const n = String(list.length);
  const c = $('#countHeader'); if (c) c.textContent = n;
  const f = $('#countFooter'); if (f) f.textContent = n;
  const d = $('#countDrawer'); if (d) d.textContent = n;
  $('#people').innerHTML = list.map(p => `<li>${escapeHtml(p.name)} <small>${escapeHtml(p.role)}</small></li>`).join('');
}

async function callPeer(id, polite) {
  if (id === myId || pcs.has(id)) return;
  const pc = makePc(id);
  localStream?.getTracks().forEach(t => pc.addTrack(t, localStream));
  if (polite) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: 'offer', to: id, sdp: pc.localDescription });
  }
}

function makePc(id) {
  if (pcs.has(id)) return pcs.get(id);
  const pc = new RTCPeerConnection(rtcConfig);
  pcs.set(id, pc);
  const remote = new MediaStream();
  addVideo(id, remote, () => peers.get(id)?.name || 'Guest', false);
  pc.ontrack = ev => ev.streams[0].getTracks().forEach(t => remote.addTrack(t));
  pc.onicecandidate = ev => ev.candidate && send({ type: 'ice', to: id, candidate: ev.candidate });
  pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) closePeer(id); };
  return pc;
}

function closePeer(id) {
  pcs.get(id)?.close();
  pcs.delete(id);
  document.querySelector(`[data-id="${id}"]`)?.remove();
}

const MIC_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v4M8 23h8"/></svg>';
const MENU_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';

function addVideo(id, stream, label, isLocal) {
  if (document.querySelector(`[data-id="${id}"]`)) return;
  const tile = document.createElement('div');
  tile.className = 'meet-tile' + (isLocal ? ' meet-tile--local' : '');
  tile.dataset.id = id;

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = isLocal;
  video.srcObject = stream;

  const placeholder = document.createElement('div');
  placeholder.className = 'meet-tile-placeholder';
  placeholder.textContent = 'Waiting for video';

  if (isLocal) {
    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'meet-tile-menu';
    menuBtn.setAttribute('aria-label', 'More options');
    menuBtn.innerHTML = MENU_SVG;
    menuBtn.addEventListener('click', e => { e.stopPropagation(); meetingMenuPop.hidden = false; meetingMenuBtn?.setAttribute('aria-expanded', 'true'); });
    tile.appendChild(menuBtn);
  }

  const overlay = document.createElement('div');
  overlay.className = 'meet-tile-overlay';
  const nameEl = document.createElement('span');
  nameEl.className = 'meet-tile-name';

  const micWrap = document.createElement('span');
  micWrap.className = 'meet-mic-icon' + (isLocal && !micOn ? ' is-muted' : '');
  micWrap.setAttribute('aria-hidden', 'true');
  micWrap.innerHTML = MIC_SVG;

  overlay.append(nameEl, micWrap);
  tile.append(video, placeholder, overlay);
  $('#videos').append(tile);

  const setName = () => {
    const t = typeof label === 'function' ? label() : label;
    nameEl.textContent = t;
  };
  setName();
  setInterval(setName, 1000);

  const markHasVideo = () => {
    const t = stream.getVideoTracks().some(tr => tr.enabled && tr.readyState === 'live');
    tile.classList.toggle('meet-tile--has-video', t);
    if (video.videoWidth > 0) tile.classList.add('meet-tile--has-video');
  };
  video.addEventListener('loadedmetadata', markHasVideo);
  video.addEventListener('playing', markHasVideo);
  stream.getVideoTracks().forEach(tr => tr.addEventListener('ended', markHasVideo));
  stream.getVideoTracks().forEach(tr => tr.addEventListener('mute', markHasVideo));
  stream.getVideoTracks().forEach(tr => tr.addEventListener('unmute', markHasVideo));
}

async function shareScreen() {
  if (!localStream || localStream.getVideoTracks().length === 0) return alert('Screen sharing is for hosts/speakers in this MVP.');
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const track = screenStream.getVideoTracks()[0];
    for (const pc of pcs.values()) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(track);
    }
    const localVideo = document.querySelector('[data-id="local"] video');
    if (localVideo) localVideo.srcObject = screenStream;
    const tile = document.querySelector('[data-id="local"]');
    tile?.classList.add('meet-tile--has-video');
    track.onended = async () => {
      const cam = localStream.getVideoTracks()[0];
      for (const pc of pcs.values()) pc.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(cam);
      if (localVideo) localVideo.srcObject = localStream;
    };
  } catch (_) {}
}

function addChat(name, text) {
  const p = document.createElement('p');
  p.className = 'msg';
  p.innerHTML = `<b>${escapeHtml(name)}:</b> ${escapeHtml(text)}`;
  $('#chatLog').append(p);
  $('#chatLog').scrollTop = $('#chatLog').scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
