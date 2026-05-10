'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VideoTile from './VideoTile';
import PrejoinRoom from './PrejoinRoom';

const JOIN_SESSION_KEY = 'kreoMeetJoin';

const rtcConfig = { iceServers: [] };
const cleanRoom = value => (value || 'main-room').replace(/[^a-zA-Z0-9_-]/g, '') || 'main-room';
const safeName = value => (value || 'Guest').slice(0, 60);

/** Decode a name from a query string (handles + and percent-encoding). */
function nameFromQuery(raw) {
  if (raw == null || raw === '') return '';
  const spaced = String(raw).replace(/\+/g, ' ');
  try {
    return decodeURIComponent(spaced).trim().slice(0, 60);
  } catch {
    return spaced.trim().slice(0, 60);
  }
}

export default function MeetingApp({ initialRoom = 'main-room', autoRoom = false }) {
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');
  const [room, setRoom] = useState(() => cleanRoom(initialRoom));
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
    setRoom(cleanRoom(initialRoom));
  }, [initialRoom]);

  useEffect(() => {
    if (joined) return;
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const qName = params.get('name');
    if (qName) {
      const n = nameFromQuery(qName);
      if (n) setName(n);
    }

    if (qName && nameFromQuery(qName)) return undefined;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data.user?.displayName) {
          setName(prev => (prev.trim() ? prev : data.user.displayName));
          return;
        }
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('name') : null;
      if (saved) setName(prev => (prev.trim() ? prev : saved));
    })();

    return () => {
      cancelled = true;
    };
  }, [joined]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);
  useEffect(() => {
    chatLogRef.current?.scrollTo({ top: chatLogRef.current.scrollHeight });
  }, [messages]);

  const addChat = useCallback((from, text) => {
    setMessages(items => [...items, { id: crypto.randomUUID(), from, text }]);
  }, []);

  const send = useCallback(obj => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(obj));
  }, []);

  const updatePeers = useCallback(list => {
    peersRef.current = new Map(list.map(p => [p.id, p]));
    setPeers(list);
    setStreams(items =>
      items.map(item =>
        item.id === 'local' ? item : { ...item, label: peersRef.current.get(item.id)?.name || item.id }
      )
    );
  }, []);

  const addStream = useCallback((id, stream, label, muted = false) => {
    setStreams(items => (items.some(item => item.id === id) ? items : [...items, { id, stream, label, muted }]));
  }, []);

  const closePeer = useCallback(id => {
    pcsRef.current.get(id)?.close();
    pcsRef.current.delete(id);
    setStreams(items => items.filter(item => item.id !== id));
  }, []);

  const makePc = useCallback(
    id => {
      if (pcsRef.current.has(id)) return pcsRef.current.get(id);
      const pc = new RTCPeerConnection(rtcConfig);
      pcsRef.current.set(id, pc);
      const remote = new MediaStream();
      addStream(id, remote, peersRef.current.get(id)?.name || id);
      pc.ontrack = ev => ev.streams[0].getTracks().forEach(track => remote.addTrack(track));
      pc.onicecandidate = ev => ev.candidate && send({ type: 'ice', to: id, candidate: ev.candidate });
      pc.onconnectionstatechange = () => ['failed', 'closed', 'disconnected'].includes(pc.connectionState) && closePeer(id);
      return pc;
    },
    [addStream, closePeer, send]
  );

  const callPeer = useCallback(
    async (id, polite) => {
      if (id === myIdRef.current || pcsRef.current.has(id)) return;
      const pc = makePc(id);
      localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
      if (polite) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ type: 'offer', to: id, sdp: pc.localDescription });
      }
    },
    [makePc, send]
  );

  const handle = useCallback(
    async msg => {
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
        try {
          await pcsRef.current.get(msg.from)?.addIceCandidate(msg.candidate);
        } catch {
          /* ignore */
        }
      }
      if (msg.type === 'chat') addChat(msg.name || 'Guest', msg.text);
      if (msg.type === 'raise-hand') addChat('System', `${msg.name || 'Guest'} raised their hand.`);
    },
    [addChat, callPeer, closePeer, makePc, send, updatePeers]
  );

  const connectMeeting = useCallback(
    async (nextRoom, nextName) => {
      const roomId = cleanRoom(nextRoom);
      const displayName = safeName(nextName);
      roomRef.current = roomId;
      nameRef.current = displayName;
      setRoom(roomId);
      setName(displayName);
      window.localStorage.setItem('name', displayName);
      if (autoRoom) {
        const path = `/room/${encodeURIComponent(roomId)}`;
        window.history.replaceState(null, '', path);
      }
      setJoined(true);
      setStatus('Connecting…');
      setStatusMode('');

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera/mic requires HTTPS or localhost. Open this app with https:// on a trusted domain.');
        }
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = localStream;
        addStream('local', localStream, `${displayName} (you)`, true);
      } catch (error) {
        alert(`Camera/mic permission failed: ${error.message}`);
        addChat('System', `Camera/mic unavailable: ${error.message}`);
        localStreamRef.current = new MediaStream();
        addStream('local', localStreamRef.current, `${displayName} (you)`, true);
      }

      const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`);
      wsRef.current = ws;
      ws.onopen = () => {
        setStatus('Live');
        setStatusMode('live');
        send({ type: 'join', roomId, name: displayName, role: 'host', userAgent: navigator.userAgent });
      };
      ws.onmessage = ev => handle(JSON.parse(ev.data));
      ws.onclose = () => {
        setStatus('Disconnected');
        setStatusMode('offline');
        addChat('System', 'Disconnected from signaling server.');
      };
    },
    [addChat, addStream, autoRoom, handle, send]
  );

  useEffect(() => {
    if (!autoRoom || joined) return;
    let raw;
    try {
      raw = sessionStorage.getItem(JOIN_SESSION_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(JOIN_SESSION_KEY);
      return;
    }
    const target = cleanRoom(initialRoom);
    if (cleanRoom(parsed.room) !== target) {
      sessionStorage.removeItem(JOIN_SESSION_KEY);
      return;
    }
    sessionStorage.removeItem(JOIN_SESSION_KEY);
    void connectMeeting(target, safeName(parsed.name));
  }, [autoRoom, joined, initialRoom, connectMeeting]);

  const handlePrejoinJoin = useCallback(() => {
    const displayName = safeName(name);
    if (!displayName || displayName === 'Guest') {
      alert('Enter your name before joining.');
      return;
    }
    void connectMeeting(room, displayName);
  }, [connectMeeting, name, room]);

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    window.location.href = '/';
  };

  const toggleMic = () => {
    setMicOn(value => {
      const next = !value;
      localStreamRef.current?.getAudioTracks().forEach(track => {
        track.enabled = next;
      });
      return next;
    });
  };

  const toggleCam = () => {
    setCamOn(value => {
      const next = !value;
      localStreamRef.current?.getVideoTracks().forEach(track => {
        track.enabled = next;
      });
      return next;
    });
  };

  const shareScreen = async () => {
    if (!localStreamRef.current?.getVideoTracks().length) return alert('Enable your camera first, or refresh and allow media.');
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = screenStream.getVideoTracks()[0];
      for (const pc of pcsRef.current.values()) {
        const sender = pc.getSenders().find(item => item.track?.kind === 'video');
        if (sender) sender.replaceTrack(track);
      }
      setStreams(items => items.map(item => (item.id === 'local' ? { ...item, stream: screenStream } : item)));
      track.onended = () => {
        const cam = localStreamRef.current.getVideoTracks()[0];
        for (const pc of pcsRef.current.values()) pc.getSenders().find(item => item.track?.kind === 'video')?.replaceTrack(cam);
        setStreams(items => items.map(item => (item.id === 'local' ? { ...item, stream: localStreamRef.current } : item)));
      };
    } catch {
      /* user cancelled */
    }
  };

  const copyLink = async () => {
    const link = `${window.location.origin}/room/${encodeURIComponent(roomRef.current)}`;
    await navigator.clipboard.writeText(link);
    addChat('System', 'Meeting link copied.');
  };

  const leave = () => {
    window.location.href = '/';
  };

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
      <PrejoinRoom
        roomCode={room}
        displayName={name}
        onDisplayNameChange={setName}
        secureHint={secureHint}
        onJoin={handlePrejoinJoin}
      />
    );
  }

  return (
    <main className="shell">
      <section className="app-shell">
        <header className="topbar">
          <div className="meeting-id">
            <div className="brand-mark small">KM</div>
            <div>
              <strong>Kreo Meet</strong>
              <span> · {room}</span>
            </div>
          </div>
          <div className={`status-pill ${statusMode}`.trim()}>{status}</div>
          <div className="actions">
            <button type="button" className="secondary" onClick={copyLink}>
              🔗 Copy link
            </button>
            <button type="button" className="secondary" onClick={toggleMic}>
              {micOn ? '🎙️ Mute' : '🔇 Unmute'}
            </button>
            <button type="button" className="secondary" onClick={toggleCam}>
              {camOn ? '📷 Stop cam' : '📷 Start cam'}
            </button>
            <button type="button" className="secondary" onClick={shareScreen}>
              🖥️ Share
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                send({ type: 'raise-hand' });
                addChat('System', 'You raised your hand.');
              }}
            >
              ✋ Raise hand
            </button>
            <button type="button" className="secondary" onClick={() => void signOut()}>
              Sign out
            </button>
            <button type="button" className="danger" onClick={leave}>
              Leave
            </button>
          </div>
        </header>
        <div className="grid">
          <section className="stage">
            <div className="stage-head">
              <div>
                <h2>Live room</h2>
                <p>Everyone joins with camera and mic. Share the link to invite others.</p>
              </div>
            </div>
            <div className="videos">
              {streams.map(item => (
                <VideoTile key={item.id} label={item.label} stream={item.stream} muted={item.muted} />
              ))}
            </div>
          </section>
          <aside className="side">
            <section className="panel">
              <div className="panel-title">
                <h2>Participants</h2>
                <span>{peers.length}</span>
              </div>
              <ul>
                {peers.map(peer => (
                  <li key={peer.id}>
                    {peer.name}
                    <small>{peer.role}</small>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel chat-panel">
              <div className="panel-title">
                <h2>Chat</h2>
              </div>
              <div className="chatlog" ref={chatLogRef}>
                {messages.map(msg => (
                  <p className="msg" key={msg.id}>
                    <b>{msg.from}:</b> {msg.text}
                  </p>
                ))}
              </div>
              <form id="chatForm" onSubmit={submitChat}>
                <input value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Message everyone" />
                <button type="submit">Send</button>
              </form>
            </section>
            <section className="panel exports">
              <a href={`/api/attendance/${room}`} target="_blank" rel="noreferrer">
                View attendance JSON
              </a>
              <a href={`/api/attendance/${room}/csv`} target="_blank" rel="noreferrer">
                Download attendance CSV
              </a>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
