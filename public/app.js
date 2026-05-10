const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
$('#room').value = params.get('room') || 'main-room';
$('#name').value = localStorage.name || '';

let ws, myId, roomId, localStream, screenStream;
let micOn = true, camOn = true;
const pcs = new Map();
const peers = new Map();
const localVideoId = 'local';

const rtcConfig = { iceServers: [] }; // Fully custom/no external STUN. Same-network/public-host tests work best; custom STUN/TURN is a future production component.

$('#joinBtn').onclick = join;
$('#leave').onclick = () => location.href = '/';
$('#copyLink').onclick = async () => { await navigator.clipboard.writeText(location.href); $('#copyLink').textContent = 'Copied'; setTimeout(()=>$('#copyLink').textContent='Copy link',1200); };
$('#mic').onclick = () => { micOn = !micOn; localStream?.getAudioTracks().forEach(t => t.enabled = micOn); $('#mic').textContent = micOn ? 'Mute mic' : 'Unmute mic'; };
$('#cam').onclick = () => { camOn = !camOn; localStream?.getVideoTracks().forEach(t => t.enabled = camOn); $('#cam').textContent = camOn ? 'Stop cam' : 'Start cam'; };
$('#screen').onclick = shareScreen;
$('#raiseHand').onclick = () => { send({type:'raise-hand'}); addChat('System', 'You raised your hand.'); };
$('#chatForm').onsubmit = e => { e.preventDefault(); const text = $('#chatInput').value.trim(); if (text) { send({type:'chat', text}); addChat('Me', text); $('#chatInput').value=''; } };

async function join() {
  roomId = ($('#room').value || 'main-room').replace(/[^a-zA-Z0-9_-]/g,'') || 'main-room';
  const name = ($('#name').value || 'Guest').slice(0,60);
  localStorage.name = name;
  history.replaceState(null, '', `/?room=${encodeURIComponent(roomId)}`);
  $('#join').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#roomLabel').textContent = ` · ${roomId}`; $('#attendance').href = `/api/attendance/${roomId}`; $('#attendanceCsv').href = `/api/attendance/${roomId}/csv`;
  const role = $('#role').value;
  if (role === 'host') {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera/mic requires HTTPS or localhost. Open this app with https:// on a trusted domain, not plain http:// public IP.');
      }
      localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
    } catch (err) {
      alert('Camera/mic permission failed: ' + err.message);
      addChat('System', 'Camera/mic unavailable: ' + err.message);
      localStream = new MediaStream();
    }
    addVideo(localVideoId, localStream, `${name} (you)`);
  } else {
    localStream = new MediaStream();
    $('#mic').disabled = true; $('#cam').disabled = true; $('#screen').disabled = true;
    addChat('System', 'Joined as watch-only attendee. Use Raise hand to ask the host to promote you later.');
  }
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => send({ type:'join', roomId, name, role, userAgent: navigator.userAgent });
  ws.onmessage = ev => handle(JSON.parse(ev.data));
  ws.onclose = () => addChat('System', 'Disconnected from signaling server.');
}
function send(obj){ ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(obj)); }
async function handle(msg) {
  if (msg.type === 'welcome') {
    myId = msg.id; updatePeers(msg.peers);
    for (const p of msg.peers) if (p.id !== myId) await callPeer(p.id, true);
  }
  if (msg.type === 'peer-joined') { updatePeers(msg.peers); await callPeer(msg.peer.id, false); addChat('System', `${msg.peer.name} joined.`); }
  if (msg.type === 'peer-left') { updatePeers(msg.peers); closePeer(msg.id); addChat('System', `A participant left.`); }
  if (msg.type === 'offer') { const pc = makePc(msg.from); await pc.setRemoteDescription(msg.sdp); localStream?.getTracks().forEach(t => pc.addTrack(t, localStream)); const ans = await pc.createAnswer(); await pc.setLocalDescription(ans); send({type:'answer', to:msg.from, sdp:pc.localDescription}); }
  if (msg.type === 'answer') { await pcs.get(msg.from)?.setRemoteDescription(msg.sdp); }
  if (msg.type === 'ice') { try { await pcs.get(msg.from)?.addIceCandidate(msg.candidate); } catch {} }
  if (msg.type === 'chat') addChat(msg.name || 'Guest', msg.text);
  if (msg.type === 'raise-hand') addChat('System', `${msg.name || 'Guest'} raised their hand.`);
}
function updatePeers(list){ peers.clear(); list.forEach(p=>peers.set(p.id,p)); $('#count').textContent = list.length; $('#people').innerHTML = list.map(p=>`<li>${escapeHtml(p.name)} <small>${p.role}</small></li>`).join(''); }
async function callPeer(id, polite) {
  if (id === myId || pcs.has(id)) return;
  const pc = makePc(id);
  localStream?.getTracks().forEach(t => pc.addTrack(t, localStream));
  if (polite) { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); send({type:'offer', to:id, sdp:pc.localDescription}); }
}
function makePc(id) {
  if (pcs.has(id)) return pcs.get(id);
  const pc = new RTCPeerConnection(rtcConfig); pcs.set(id, pc);
  const remote = new MediaStream(); addVideo(id, remote, () => peers.get(id)?.name || id);
  pc.ontrack = ev => ev.streams[0].getTracks().forEach(t => remote.addTrack(t));
  pc.onicecandidate = ev => ev.candidate && send({type:'ice', to:id, candidate:ev.candidate});
  pc.onconnectionstatechange = () => ['failed','closed','disconnected'].includes(pc.connectionState) && closePeer(id);
  return pc;
}
function closePeer(id){ pcs.get(id)?.close(); pcs.delete(id); document.querySelector(`[data-id="${id}"]`)?.remove(); }
function addVideo(id, stream, label) {
  if (document.querySelector(`[data-id="${id}"]`)) return;
  const tile = document.createElement('div'); tile.className='tile'; tile.dataset.id=id;
  const video = document.createElement('video'); video.autoplay=true; video.playsInline=true; video.muted = id === localVideoId; video.srcObject=stream;
  const badge = document.createElement('div'); badge.className='badge'; badge.textContent = typeof label === 'function' ? label() : label;
  tile.append(video,badge); $('#videos').append(tile);
  setInterval(()=>{ if(typeof label==='function') badge.textContent=label(); }, 1000);
}
async function shareScreen() {
  if (!localStream || localStream.getVideoTracks().length === 0) return alert('Screen sharing is for hosts/speakers in this MVP.');
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({video:true, audio:false});
    const track = screenStream.getVideoTracks()[0];
    for (const pc of pcs.values()) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(track);
    }
    const localVideo = document.querySelector('[data-id="local"] video'); localVideo.srcObject = screenStream;
    track.onended = async () => {
      const cam = localStream.getVideoTracks()[0];
      for (const pc of pcs.values()) pc.getSenders().find(s=>s.track?.kind==='video')?.replaceTrack(cam);
      localVideo.srcObject = localStream;
    };
  } catch {}
}
function addChat(name, text){ const p=document.createElement('p'); p.className='msg'; p.innerHTML=`<b>${escapeHtml(name)}:</b> ${escapeHtml(text)}`; $('#chatLog').append(p); $('#chatLog').scrollTop = $('#chatLog').scrollHeight; }
function escapeHtml(s){ return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
