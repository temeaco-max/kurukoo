(() => {
  let localStream = null;
  let peerConnection = null;
  let roomId = null;
  let peerId = null;
  let remotePeerId = null;
  let signalCursor = 0;
  let pollTimer = null;
  let muted = false;
  let cameraEnabled = true;
  let intentionalHangup = false;

  const remoteVideo = document.getElementById('remote-video');
  const localVideo = document.getElementById('local-video');
  const status = document.getElementById('call-status');
  const mic = document.getElementById('mic-state');
  const camera = document.getElementById('camera-state');
  const connection = document.getElementById('connection-state');
  const placeholder = document.getElementById('video-placeholder');
  const startButton = document.getElementById('start-call');
  const muteButton = document.getElementById('mute-call');
  const cameraButton = document.getElementById('camera-call');
  const endButton = document.getElementById('end-call');

  const setStatus = text => { if (status) status.textContent = text; };

  const json = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Call request failed.');
    return payload;
  };

  const readRoomId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || params.get('roomId') || '';
  };

  async function statusCheck() {
    const payload = await json('/api/voice/webrtc/status');
    if (!payload?.webrtc?.available) {
      throw new Error(payload?.webrtc?.activationRequirement || 'WebRTC calling is not enabled for this deployment.');
    }
  }

  async function createRoom() {
    const requestedRoom = readRoomId();
    const payload = await json('/api/voice/webrtc/room', {
      method: 'POST',
      body: JSON.stringify({ roomId: requestedRoom || undefined }),
    });
    roomId = payload.roomId;
    peerId = payload.peerId;
    remotePeerId = payload.remotePeerId || null;
    signalCursor = 0;
  }

  function buildPeerConnection() {
    const config = { iceServers: [] };
    if (window.KURUKOO_CALL_ICE_SERVERS && Array.isArray(window.KURUKOO_CALL_ICE_SERVERS)) {
      config.iceServers = window.KURUKOO_CALL_ICE_SERVERS;
    }
    const pc = new RTCPeerConnection(config);
    pc.ontrack = event => {
      const [stream] = event.streams;
      if (stream && remoteVideo) {
        remoteVideo.srcObject = stream;
        placeholder.hidden = true;
      }
    };
    pc.onicecandidate = async event => {
      if (!event.candidate || !roomId) return;
      try {
        await json('/api/voice/webrtc/signal', {
          method: 'POST',
          body: JSON.stringify({ roomId, kind: 'ice', payload: event.candidate, to: remotePeerId || undefined }),
        });
      } catch (error) {
        setStatus(error.message);
      }
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (connection) connection.textContent = state;
      if (state === 'connected') setStatus('Call connected.');
      if (state === 'failed') setStatus('The call connection failed.');
      if (state === 'disconnected') setStatus('The other participant may have disconnected.');
    };
    return pc;
  }

  async function sendSignal(kind, payload, to) {
    await json('/api/voice/webrtc/signal', {
      method: 'POST',
      body: JSON.stringify({ roomId, kind, payload, to: to || undefined }),
    });
  }

  async function ensurePeerConnection() {
    if (!peerConnection) peerConnection = buildPeerConnection();
    if (localStream) localStream.getTracks().forEach(track => {
      const alreadyAdded = peerConnection.getSenders().some(sender => sender.track === track);
      if (!alreadyAdded) peerConnection.addTrack(track, localStream);
    });
  }

  async function pollSignals() {
    if (!roomId || !peerId) return;
    try {
      const payload = await json(`/api/voice/webrtc/signals?roomId=${encodeURIComponent(roomId)}&after=${signalCursor}`);
      signalCursor = Number(payload.cursor || signalCursor);
      remotePeerId = payload.remotePeerId || remotePeerId;
      for (const signal of payload.signals || []) {
        await handleSignal(signal);
      }
    } catch (error) {
      if (!intentionalHangup) setStatus(error.message);
    }
  }

  async function handleSignal(signal) {
    if (!peerConnection) await ensurePeerConnection();
    if (signal.kind === 'offer') {
      remotePeerId = signal.from;
      await peerConnection.setRemoteDescription(signal.payload);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await sendSignal('answer', peerConnection.localDescription, remotePeerId);
      return;
    }
    if (signal.kind === 'answer') {
      await peerConnection.setRemoteDescription(signal.payload);
      return;
    }
    if (signal.kind === 'ice') {
      try { await peerConnection.addIceCandidate(signal.payload); } catch (_) { /* remote description may still be settling */ }
      return;
    }
    if (signal.kind === 'hangup') {
      await cleanup(false);
      setStatus('The call ended.');
    }
  }

  async function maybeOffer() {
    await pollSignals();
    const peers = await json(`/api/voice/webrtc/peers?roomId=${encodeURIComponent(roomId)}`);
    const others = (peers.peers || []).filter(id => id !== peerId);
    remotePeerId = remotePeerId || others[0] || null;
    if (!remotePeerId) {
      setStatus('Waiting for the other participant to join…');
      return;
    }
    const initiator = String(peerId) < String(remotePeerId);
    if (initiator && !peerConnection?.currentRemoteDescription) {
      await ensurePeerConnection();
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await sendSignal('offer', peerConnection.localDescription, remotePeerId);
      setStatus('Calling the other participant…');
    } else if (connection?.textContent !== 'connected') {
      setStatus('Connecting…');
    }
  }

  async function startCall() {
    intentionalHangup = false;
    try {
      await statusCheck();
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      if (localVideo) localVideo.srcObject = localStream;
      await createRoom();
      await ensurePeerConnection();
      localStream.getTracks().forEach(track => {
        if (!peerConnection.getSenders().some(sender => sender.track === track)) peerConnection.addTrack(track, localStream);
      });
      mic.textContent = 'On'; camera.textContent = 'On'; cameraEnabled = true;
      placeholder.hidden = true;
      setStatus('Camera and microphone ready. Waiting for the other participant…');
      clearInterval(pollTimer);
      pollTimer = setInterval(async () => {
        await pollSignals();
        await maybeOffer();
      }, 900);
      await maybeOffer();
    } catch (error) {
      await cleanup(false);
      setStatus(error.message || 'Unable to start the call.');
    }
  }

  async function cleanup(sendHangup = false) {
    if (sendHangup && roomId) {
      try { await sendSignal('hangup', { reason: 'client_disconnect' }, remotePeerId); } catch (_) {}
    }
    clearInterval(pollTimer);
    pollTimer = null;
    localStream?.getTracks().forEach(track => track.stop());
    localStream = null;
    peerConnection?.close();
    peerConnection = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    if (localVideo) localVideo.srcObject = null;
    if (placeholder) placeholder.hidden = false;
    mic.textContent = 'Off'; camera.textContent = 'Off'; connection.textContent = 'Not connected';
    muted = false; cameraEnabled = false;
    roomId = null; peerId = null; remotePeerId = null; signalCursor = 0;
  }

  muteButton?.addEventListener('click', () => {
    if (!localStream) return;
    muted = !muted;
    localStream.getAudioTracks().forEach(track => { track.enabled = !muted; });
    mic.textContent = muted ? 'Muted' : 'On';
  });

  cameraButton?.addEventListener('click', () => {
    if (!localStream) return;
    cameraEnabled = !cameraEnabled;
    localStream.getVideoTracks().forEach(track => { track.enabled = cameraEnabled; });
    camera.textContent = cameraEnabled ? 'On' : 'Off';
  });

  startButton?.addEventListener('click', startCall);
  endButton?.addEventListener('click', async () => {
    intentionalHangup = true;
    await cleanup(true);
    setStatus('Call ended.');
  });

  window.addEventListener('beforeunload', () => {
    if (roomId) navigator.sendBeacon?.('/api/voice/webrtc/leave', new Blob([JSON.stringify({ roomId, peerId })], { type: 'application/json' }));
  });
})();
