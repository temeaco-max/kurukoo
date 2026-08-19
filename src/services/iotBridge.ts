import mqtt, { type MqttClient } from 'mqtt';
import { isFeatureEnabled } from './featureFlags.js';
import { getDb, saveDb } from '../database.js';

export interface MqttBridgeStatus {
    configured: boolean;
    enabled: boolean;
    connected: boolean;
    brokerConfigured: boolean;
    subscribedTopics: number;
    lastError?: string;
    activationRequirement: string;
}

let client: MqttClient | null = null;
let subscriptions = new Set<string>();
let status: MqttBridgeStatus = {
    configured: false,
    enabled: false,
    connected: false,
    brokerConfigured: false,
    subscribedTopics: 0,
    activationRequirement: 'Set MQTT_BROKER_URL and explicitly enable FF_IOT_REMOTE only after broker/device authorization is verified.',
};

async function persistInboundState(topic: string, payload: Buffer): Promise<void> {
    const db = await getDb();
    const rows = db.exec(`SELECT id,phone,metadata_json FROM connected_resources WHERE protocol='mqtt' AND status='active'`)[0]?.values || [];
    const receivedAt = new Date().toISOString();
    const bounded = payload.toString('utf8').slice(0, 10000);
    for (const row of rows) {
        const id = String(row[0]);
        const phone = String(row[1]);
        let metadata: Record<string, unknown> = {};
        try { metadata = JSON.parse(String(row[2] || '{}')); } catch {}
        const stateTopic = String(metadata.stateTopic || '').trim();
        if (!stateTopic || stateTopic !== topic) continue;
        let state: unknown = bounded;
        try { state = JSON.parse(bounded); } catch {}
        metadata.lastState = state;
        metadata.lastStateAt = receivedAt;
        db.run(`UPDATE connected_resources SET metadata_json=?,last_seen_at=CURRENT_TIMESTAMP WHERE id=? AND phone=? AND status='active'`, [JSON.stringify(metadata), id, phone]);
    }
    if (rows.length) saveDb();
}

async function subscribeConfiguredStateTopics(): Promise<void> {
    if (!client?.connected) return;
    try {
        const db = await getDb();
        const rows = db.exec(`SELECT metadata_json FROM connected_resources WHERE protocol='mqtt' AND status='active'`)[0]?.values || [];
        const topics: string[] = rows.map((row: any[]) => {
            try { const metadata = JSON.parse(String(row[0] || '{}')); return String(metadata.stateTopic || '').trim(); }
            catch { return ''; }
        }).filter((topic: string): topic is string => Boolean(topic)).slice(0, 200);
        for (const topic of topics) {
            if (subscriptions.has(topic)) continue;
            await new Promise<void>((resolve, reject) => client!.subscribe(topic, { qos: 1 }, error => error ? reject(error) : resolve()));
            subscriptions.add(topic);
        }
        status = { ...status, subscribedTopics: subscriptions.size };
    } catch (error) {
        status = { ...status, lastError: String((error as Error)?.message || error) };
    }
}

async function startBridge(): Promise<void> {
    const brokerUrl = String(process.env.MQTT_BROKER_URL || '').trim();
    const enabled = isFeatureEnabled(process.env.KURUKOO_DEFAULT_COUNTRY || 'ng', 'iot_remote');
    status = { ...status, enabled, brokerConfigured: Boolean(brokerUrl), configured: Boolean(brokerUrl && enabled) };
    if (!brokerUrl || !enabled || client) return;
    try {
        client = mqtt.connect(brokerUrl, { reconnectPeriod: 5000, connectTimeout: 5000, clean: true });
        client.on('connect', () => {
            status = { ...status, connected: true, lastError: undefined };
            void subscribeConfiguredStateTopics();
            console.log('[MQTT] Broker connection established; inbound device-state synchronization enabled for authorized resources.');
        });
        client.on('message', (topic, payload) => { void persistInboundState(String(topic), payload); });
        client.on('close', () => { status = { ...status, connected: false, subscribedTopics: 0 }; subscriptions = new Set(); });
        client.on('error', (error) => { status = { ...status, connected: false, lastError: String(error?.message || error) }; console.error('[MQTT] Broker error:', status.lastError); });
    } catch (error) {
        status = { ...status, connected: false, lastError: String((error as Error)?.message || error) };
        client = null;
    }
}

export function getMqttBridgeStatus(): MqttBridgeStatus {
    void startBridge();
    return { ...status };
}

export function sendMqttCommand(topic: string, payload: string): { accepted: boolean; state: 'queued' | 'not_configured' | 'not_connected'; reason?: string } {
    void startBridge();
    if (!status.configured) return { accepted: false, state: 'not_configured', reason: status.activationRequirement };
    if (!client?.connected) return { accepted: false, state: 'not_connected', reason: status.lastError || 'MQTT broker is not connected; no command was delivered.' };
    client.publish(topic, payload, { qos: 1 }, (error) => { if (error) status = { ...status, lastError: error.message }; });
    return { accepted: true, state: 'queued' };
}