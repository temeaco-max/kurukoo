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
    const response = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.readiness?.activationRequirement || 'Call request failed.');
    return payload;
  };
  function readRoomId() { const params = new URLSearchParams(window.location.search); return params.get('room') || params.get('roomId') || `call-${crypto.randomUUID()}`; }
  async function statusCheck() { const payload = await json('/api/webrtc/status'); if (!payload?.webrtc?.available) throw new Error(payload?.webrtc?.activationRequirement || 'WebRTC calling is not enabled for this deployment.'); }
  async function createRoom() { const payload = await json('/api/webrtc/create', { method:'POST', body:JSON.stringify({ roomId: readRoomId() }) }); roomId=payload.roomId; peerId=payload.phone; signalCursor=0; remotePeerId=(payload.peers||[]).find(id=>id!==peerId)||null; }
  function buildPeerConnection() {
    const config={iceServers:Array.isArray(window.KURUKOO_CALL_ICE_SERVERS)?window.KURUKOO_CALL_ICE_SERVERS:[]};
    const pc=new RTCPeerConnection(config);
    pc.ontrack=event=>{const [stream]=event.streams;if(stream&&remoteVideo){remoteVideo.srcObject=stream;placeholder.hidden=true;}};
    pc.onicecandidate=async event=>{if(!event.candidate||!roomId)return;try{await sendSignal('ice',event.candidate,remotePeerId);}catch(error){setStatus(error.message);}};
    pc.onconnectionstatechange=()=>{const state=pc.connectionState;if(connection)connection.textContent=state;if(state==='connected')setStatus('Call connected.');else if(state==='failed')setStatus('The call connection failed.');else if(state==='disconnected')setStatus('The other participant may have disconnected.');};
    return pc;
  }
  async function ensurePeerConnection(){if(!peerConnection)peerConnection=buildPeerConnection();if(localStream)for(const track of localStream.getTracks())if(!peerConnection.getSenders().some(sender=>sender.track===track))peerConnection.addTrack(track,localStream);}
  async function sendSignal(kind,payload,to){await json('/api/webrtc/signal',{method:'POST',body:JSON.stringify({roomId,kind,payload,...(to?{to}:{})})});}
  async function pollSignals(){if(!roomId||!peerId)return;try{const payload=await json(`/api/webrtc/signals?roomId=${encodeURIComponent(roomId)}${signalCursor?`&after=${signalCursor}`:''}`);for(const signal of payload.signals||[]){signalCursor=Math.max(signalCursor,Number(signal.createdAt||0));await handleSignal(signal);}}catch(error){if(!intentionalHangup)setStatus(error.message);}}
  async function discoverPeers(){const peers=await json(`/api/webrtc/peers?roomId=${encodeURIComponent(roomId)}`);remotePeerId=(peers.peers||[]).find(id=>id!==peerId)||remotePeerId;return Boolean(remotePeerId);}
  async function handleSignal(signal){await ensurePeerConnection();if(signal.kind==='offer'){remotePeerId=signal.from;await peerConnection.setRemoteDescription(signal.payload);const answer=await peerConnection.createAnswer();await peerConnection.setLocalDescription(answer);await sendSignal('answer',peerConnection.localDescription,remotePeerId);}else if(signal.kind==='answer'){await peerConnection.setRemoteDescription(signal.payload);}else if(signal.kind==='ice'){try{await peerConnection.addIceCandidate(signal.payload);}catch(_){}}else if(signal.kind==='hangup'){await cleanup(false);setStatus('The call ended.');}}
  async function maybeOffer(){await discoverPeers();if(!remotePeerId){setStatus('Waiting for the other participant to join…');return;}const initiator=String(peerId)<String(remotePeerId);if(initiator&&peerConnection&&!peerConnection.currentLocalDescription&&!peerConnection.currentRemoteDescription){const offer=await peerConnection.createOffer();await peerConnection.setLocalDescription(offer);await sendSignal('offer',peerConnection.localDescription,remotePeerId);setStatus('Calling the other participant…');}else if(connection?.textContent!=='connected')setStatus('Connecting…');}
  async function startCall(){intentionalHangup=false;try{await statusCheck();localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});if(localVideo)localVideo.srcObject=localStream;await createRoom();await ensurePeerConnection();mic.textContent='On';camera.textContent='On';cameraEnabled=true;placeholder.hidden=true;setStatus('Camera and microphone ready. Waiting for the other participant…');clearInterval(pollTimer);pollTimer=setInterval(async()=>{await pollSignals();await maybeOffer();},900);await maybeOffer();}catch(error){await cleanup(false);setStatus(error.message||'Unable to start the call.');}}
  async function cleanup(sendHangup=false){if(sendHangup&&roomId){try{await sendSignal('hangup',{reason:'client_disconnect'},remotePeerId);}catch(_){}}clearInterval(pollTimer);pollTimer=null;if(roomId&&peerId){try{await json('/api/webrtc/leave',{method:'POST',body:JSON.stringify({roomId})});}catch(_){}}localStream?.getTracks().forEach(track=>track.stop());peerConnection?.close();peerConnection=null;localStream=null;if(remoteVideo)remoteVideo.srcObject=null;if(localVideo)localVideo.srcObject=null;if(placeholder)placeholder.hidden=false;mic.textContent='Off';camera.textContent='Off';connection.textContent='Not connected';muted=false;cameraEnabled=false;roomId=null;peerId=null;remotePeerId=null;signalCursor=0;}
  muteButton?.addEventListener('click',()=>{if(!localStream)return;muted=!muted;localStream.getAudioTracks().forEach(track=>{track.enabled=!muted;});mic.textContent=muted?'Muted':'On';});
  cameraButton?.addEventListener('click',()=>{if(!localStream)return;cameraEnabled=!cameraEnabled;localStream.getVideoTracks().forEach(track=>{track.enabled=cameraEnabled;});camera.textContent=cameraEnabled?'On':'Off';});
  startButton?.addEventListener('click',startCall);
  endButton?.addEventListener('click',async()=>{intentionalHangup=true;await cleanup(true);setStatus('Call ended.');});
  window.addEventListener('pagehide',()=>{if(roomId&&peerId){navigator.sendBeacon?.('/api/webrtc/leave',new Blob([JSON.stringify({roomId})],{type:'application/json'}));}});
})();
