'use client';

import { useEffect, useRef } from 'react';

export default function VideoTile({ label, stream, muted = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);

  return (
    <div className="tile">
      <video ref={videoRef} autoPlay playsInline muted={muted} />
      <div className="badge">{label}</div>
    </div>
  );
}
