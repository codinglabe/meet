'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VideoTile from './VideoTile';

const rtcConfig = { iceServers: [] };
const cleanRoom = value => (value || 'main-room').replace(/[^a-zA-Z0-9_-]/g, '') || 'main-room';
const safeName = value => (value || 'Guest').slice(0, 60);

export default function MeetingApp({ initialRoom = 'main-room', autoRoom = false }) {
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');
  const [room, setRoom] = useState(cleanRoom(initialRoom));
  const [role, setRole] = useState('host');
  const [status, setStatus] = useState('Ready');
  const [statusMode, setStatusMode] = useState('');
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [streams, setStreams] = useState([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const wsRef = useRef(null);
  const myIdRef = useRef(null);
  const roleRef = useRef(role);
  const roomRef = useRef(room);
  const nameRef = useRef(name);
  const localStreamRef = useRef(null);
  const pcsRef = useRef(new Map());
  const peersRef = useRef(new Map());
  const chatLogRef = useRef(null);

  const secureHint = useMemo(() => {
    if (typeof window === 'undefined') return 'Secure connection recommended';
    const secure = window.location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(window.location.hostname);
    return secure ? 'Camera ready' : 'Use HTTPS for camera/mic';
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem('name');
    if (saved) setName(saved);
    const params = new URLSearchParams(window.location.search);
    const queryRoom = params.get('room');
    if (queryRoom && !autoRoom) setRoom(cleanRoom(queryRoom));
  }, [autoRoom]);

  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { nameRef.current = name; }, [name]);
  useEffect(() => { chatLogRef.current?.scrollTo({ top: chatLogRef.current.scrollHeight }); }, [messages]);

  const addChat = useCallback((from, text) => {
    setMessages(items => [...items, { id: crypto.randomUUID(), from, text }]);
  }, []);

  const send = useCallback(obj => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(obj));
  }, []);

  const updatePeers = useCallback(list => {
    peersRef.current = new Map(list.map(p => [p.id, p]));
    setPeers(list);
    setStreams(items => items.map(item => item.id === 'local' ? item : ({ ...item, label: peersRef.current.get(item.id)?.name || item.id })));
  }, []);

  const addStream = useCallback((id, stream, label, muted = false) => {
    setStreams(items => items.some(item => item.id === id) ? items : [...items, { id, stream, label, muted }]);
  }, []);

  const closePeer = useCallback(id => {
    pcsRef.current.get(id)?.close();
    pcsRef.current.delete(id);
    setStreams(items => items.filter(item => item.id !== id));
  }, []);

  const makePc = useCallback(id => {
    if (pcsRef.current.has(id)) return pcsRef.current.get(id);
    const pc = new RTCPeerConnection(rtcConfig);
    pcsRef.current.set(id, pc);
    const remote = new MediaStream();
    addStream(id, remote, peersRef.current.get(id)?.name || id);
    pc.ontrack = ev => ev.streams[0].getTracks().forEach(track => remote.addTrack(track));
    pc.onicecandidate = ev => ev.candidate && send({ type: 'ice', to: id, candidate: ev.candidate });
    pc.onconnectionstatechange = () => ['failed', 'closed', 'disconnected'].includes(pc.connectionState) && closePeer(id);
    return pc;
  }, [addStream, closePeer, send]);

  const callPeer = useCallback(async (id, polite) => {
    if (id === myIdRef.current || pcsRef.current.has(id)) return;
    const pc = makePc(id);
    localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    if (polite) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: 'offer', to: id, sdp: pc.localDescription });
    }
  }, [makePc, send]);

  const handle = useCallback(async msg => {
    if (msg.type === 'welcome') {
      myIdRef.current = msg.id;
      updatePeers(msg.peers);
      for (const peer of msg.peers) if (peer.id !== msg.id) await callPeer(peer.id, true);
    }
    if (msg.type === 'peer-joined') {
      updatePeers(msg.peers);
      await callPeer(msg.peer.id, false);
      addChat('System', `${msg.peer.name} joined.`);
    }
    if (msg.type === 'peer-left') {
      updatePeers(msg.peers);
      closePeer(msg.id);
      addChat('System', 'A participant left.');
    }
    if (msg.type === 'offer') {
      const pc = makePc(msg.from);
      await pc.setRemoteDescription(msg.sdp);
      localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: 'answer', to: msg.from, sdp: pc.localDescription });
    }
    if (msg.type === 'answer') await pcsRef.current.get(msg.from)?.setRemoteDescription(msg.sdp);
    if (msg.type === 'ice') {
      try { await pcsRef.current.get(msg.from)?.addIceCandidate(msg.candidate); } catch {}
    }
    if (msg.type === 'chat') addChat(msg.name || 'Guest', msg.text);
    if (msg.type === 'raise-hand') addChat('System', `${msg.name || 'Guest'} raised their hand.`);
  }, [addChat, callPeer, closePeer, makePc, send, updatePeers]);

  const join = useCallback(async event => {
    event?.preventDefault();
    const nextRoom = cleanRoom(roomRef.current);
    const nextName = safeName(nameRef.current);
    const nextRole = roleRef.current;
    roomRef.current = nextRoom;
    nameRef.current = nextName;
    setRoom(nextRoom);
    setName(nextName);
    window.localStorage.setItem('name', nextName);
    if (!autoRoom) window.history.replaceState(null, '', `/?room=${encodeURIComponent(nextRoom)}`);
    setJoined(true);
    setStatus('Connecting…');
    setStatusMode('');

    if (nextRole === 'host') {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera/mic requires HTTPS or localhost. Open this app with https:// on a trusted domain.');
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = localStream;
        addStream('local', localStream, `${nextName} (you)`, true);
      } catch (error) {
        alert(`Camera/mic permission failed: ${error.message}`);
        addChat('System', `Camera/mic unavailable: ${error.message}`);
        localStreamRef.current = new MediaStream();
        addStream('local', localStreamRef.current, `${nextName} (you)`, true);
      }
    } else {
      localStreamRef.current = new MediaStream();
      addChat('System', 'Joined as watch-only attendee. Use Raise hand to ask the host to promote you later.');
    }

    const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`);
    wsRef.current = ws;
    ws.onopen = () => {
      setStatus('Live');
      setStatusMode('live');
      send({ type: 'join', roomId: nextRoom, name: nextName, role: nextRole, userAgent: navigator.userAgent });
    };
    ws.onmessage = ev => handle(JSON.parse(ev.data));
    ws.onclose = () => {
      setStatus('Disconnected');
      setStatusMode('offline');
      addChat('System', 'Disconnected from signaling server.');
    };
  }, [addChat, addStream, autoRoom, handle, send]);

  const toggleMic = () => {
    setMicOn(value => {
      const next = !value;
      localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = next; });
      return next;
    });
  };

  const toggleCam = () => {
    setCamOn(value => {
      const next = !value;
      localStreamRef.current?.getVideoTracks().forEach(track => { track.enabled = next; });
      return next;
    });
  };

  const shareScreen = async () => {
    if (!localStreamRef.current?.getVideoTracks().length) return alert('Screen sharing is for hosts/speakers in this MVP.');
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = screenStream.getVideoTracks()[0];
      for (const pc of pcsRef.current.values()) {
        const sender = pc.getSenders().find(item => item.track?.kind === 'video');
        if (sender) sender.replaceTrack(track);
      }
      setStreams(items => items.map(item => item.id === 'local' ? { ...item, stream: screenStream } : item));
      track.onended = () => {
        const cam = localStreamRef.current.getVideoTracks()[0];
        for (const pc of pcsRef.current.values()) pc.getSenders().find(item => item.track?.kind === 'video')?.replaceTrack(cam);
        setStreams(items => items.map(item => item.id === 'local' ? { ...item, stream: localStreamRef.current } : item));
      };
    } catch {}
  };

  const copyLink = async () => {
    const link = `${window.location.origin}/room/${encodeURIComponent(roomRef.current)}`;
    await navigator.clipboard.writeText(link);
    addChat('System', 'Meeting link copied.');
  };

  const leave = () => window.location.href = '/';
  const submitChat = event => {
    event.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    send({ type: 'chat', text });
    addChat('Me', text);
    setChatText('');
  };

  if (!joined) {
    return (
      <main className="shell">
        <section className="join-screen">
          <div className="hero-card">
            <div className="brand-row">
              <div className="brand-mark">KM</div>
              <div><div className="brand">Kreo Meet</div><div className="subtle">Next.js custom video meetings</div></div>
            </div>
            <h1>Meet, teach, stream, and track attendance.</h1>
            <p className="lead">A modern Next.js meeting app with custom WebRTC signaling, webinar roles, chat, screen sharing, raise hand, and attendance export.</p>
            <div className="feature-grid" aria-label="Features">
              <div>🎥 Video rooms</div><div>🧑‍🏫 Webinar mode</div><div>💬 Live chat</div><div>📊 Attendance CSV</div>
            </div>
          </div>
          <form className="card join-card" onSubmit={join}>
            <div className="form-title"><span>Join meeting</span><small>{secureHint}</small></div>
            <label>Your name <input value={name} onChange={e => setName(e.target.value)} placeholder="Riyad" autoComplete="name" /></label>
            <label>Room <input value={room} onChange={e => setRoom(e.target.value)} placeholder="main-room" /></label>
            <label>Role
              <select value={role} onChange={e => setRole(e.target.value)}><option value="host">Host / speaker</option><option value="attendee">Attendee / watch only</option></select>
            </label>
            <button className="primary" type="submit">Join meeting</button>
            <small className="note">For camera/mic, open with HTTPS: <strong>https://meet.believeinunity.org</strong></small>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="app-shell">
        <header className="topbar">
          <div className="meeting-id"><div className="brand-mark small">KM</div><div><strong>Kreo Meet</strong><span> · {room}</span></div></div>
          <div className={`status-pill ${statusMode}`.trim()}>{status}</div>
          <div className="actions">
            <button className="secondary" onClick={copyLink}>🔗 Copy link</button>
            <button className="secondary" onClick={toggleMic} disabled={role === 'attendee'}>{micOn ? '🎙️ Mute' : '🔇 Unmute'}</button>
            <button className="secondary" onClick={toggleCam} disabled={role === 'attendee'}>{camOn ? '📷 Stop cam' : '📷 Start cam'}</button>
            <button className="secondary" onClick={shareScreen} disabled={role === 'attendee'}>🖥️ Share</button>
            <button className="secondary" onClick={() => { send({ type: 'raise-hand' }); addChat('System', 'You raised your hand.'); }}>✋ Raise hand</button>
            <button className="danger" onClick={leave}>Leave</button>
          </div>
        </header>
        <div className="grid">
          <section className="stage">
            <div className="stage-head"><div><h2>Live room</h2><p>Speakers appear here. Attendees can watch, chat, and raise hand.</p></div></div>
            <div className="videos">{streams.map(item => <VideoTile key={item.id} label={item.label} stream={item.stream} muted={item.muted} />)}</div>
          </section>
          <aside className="side">
            <section className="panel"><div className="panel-title"><h2>Participants</h2><span>{peers.length}</span></div><ul>{peers.map(peer => <li key={peer.id}>{peer.name}<small>{peer.role}</small></li>)}</ul></section>
            <section className="panel chat-panel"><div className="panel-title"><h2>Chat</h2></div><div className="chatlog" ref={chatLogRef}>{messages.map(msg => <p className="msg" key={msg.id}><b>{msg.from}:</b> {msg.text}</p>)}</div><form id="chatForm" onSubmit={submitChat}><input value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Message everyone" /><button>Send</button></form></section>
            <section className="panel exports"><a href={`/api/attendance/${room}`} target="_blank">View attendance JSON</a><a href={`/api/attendance/${room}/csv`} target="_blank">Download attendance CSV</a></section>
          </aside>
        </div>
      </section>
    </main>
  );
}
