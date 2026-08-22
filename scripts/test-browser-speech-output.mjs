import fs from 'node:fs';

const adapter = fs.readFileSync('public/js/kurukoo-speech-output.js', 'utf8');
const chat = fs.readFileSync('public/js/kurukoo-primary-chat.js', 'utf8');
const adapterMarkers = ['SpeechSynthesisUtterance', 'window.KurukooSpeechOutput', "provider: 'browser'", 'window.speechSynthesis.cancel()', 'window.speechSynthesis.speak(utterance)'];
const chatMarkers = ['function speakAssistantResponse', "['speak', 'Speak response', 'mic']", 'KurukooSpeechOutput', 'output.speak(text'];
const missing = [
  ...adapterMarkers.filter(marker => !adapter.includes(marker)).map(marker => `adapter:${marker}`),
  ...chatMarkers.filter(marker => !chat.includes(marker)).map(marker => `chat:${marker}`),
];
if (missing.length) {
  console.error(JSON.stringify({ status: 'FAIL', missing }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  status: 'PASS',
  provider: 'browser',
  zeroCost: true,
  interaction: 'explicit_per_response',
  adapterMarkers: adapterMarkers.length,
  chatMarkers: chatMarkers.length,
}, null, 2));
