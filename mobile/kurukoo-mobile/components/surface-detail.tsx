import { KURUKOO_VISUAL_TOKENS } from "@/lib/visual-contract";
import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";

import { ActionButton, ContinuityBand, SectionCard, StatusPill, SurfaceHeader } from "@/components/kurukoo-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { haptic } from "@/lib/haptics";
import { probeExpoPushToken } from "@/lib/notifications";
import { trpc } from "@/lib/trpc";

export type SurfaceDetailKind = "connect" | "memory" | "safety" | "checkout" | "confirmation" | "partners" | "agents" | "admin";
type Tone = "neutral" | "success" | "warning";
type Section = { title: string; detail: string; tone?: Tone; action?: string };
type Surface = { eyebrow: string; title: string; detail: string; status: string; sections: Section[]; primary?: string };

const content: Record<SurfaceDetailKind, Surface> = {
  connect: { eyebrow: "Connect", title: "One relationship, different access points", detail: "Connect channels when you are ready. Kurukoo only shows a connection as live after provider evidence exists.", status: "Ready for activation", primary: "Review connection", sections: [{ title: "WhatsApp", detail: "Linked-device and business webhook boundaries are separate. Current state: provider setup required.", tone: "warning", action: "View boundary" }, { title: "Telegram", detail: "Linked-device foundation is available. Current state: provider setup required.", tone: "warning", action: "View boundary" }, { title: "Email and push", detail: "Internal notification queue is ready. Delivery requires configured provider and device evidence.", tone: "neutral", action: "Check device readiness" }] },
  memory: { eyebrow: "Memory", title: "Useful context, under your control", detail: "Kurukoo remembers carefully, with provenance and revocation rather than silent profile expansion.", status: "In your control", primary: "Review memory", sections: [{ title: "Living memory", detail: "One saved context is helping with your active request. It is being used because you can see and revoke it.", tone: "success", action: "See provenance" }, { title: "Review and revoke", detail: "You can remove any memory and its retrieval references from this surface.", tone: "neutral", action: "Manage access" }] },
  safety: { eyebrow: "Safety", title: "Protection without losing the conversation", detail: "Emergency access and protective interruptions can bypass onboarding while mutations remain gated.", status: "Available", primary: "Set a check-in", sections: [{ title: "Emergency help", detail: "Local emergency directory and the Nigeria 112 pathway are available when the relevant market applies.", tone: "success", action: "View help" }, { title: "Check-ins", detail: "Schedule, pause or resolve a safety check-in from Chat notifications.", tone: "neutral", action: "Schedule" }, { title: "Trusted contacts", detail: "No contact has been added. Adding one requires your explicit confirmation.", tone: "warning", action: "Add contact" }] },
  checkout: { eyebrow: "Checkout", title: "Review before anything proceeds", detail: "The offer, source, price state and confirmation boundary remain visible in the same journey.", status: "Price pending confirmation", primary: "Confirm request", sections: [] },
  confirmation: { eyebrow: "Confirmation", title: "You stay in control", detail: "Confirmations distinguish an internal action accepted by Kurukoo from external provider delivery or fulfilment.", status: "Waiting for you", primary: "Confirm action", sections: [] },
  partners: { eyebrow: "Partners", title: "Build trust into every opportunity", detail: "Partners see opportunities, evidence and lifecycle state without turning a discovery entity into a provider too early.", status: "Candidate network", primary: "View opportunities", sections: [] },
  agents: { eyebrow: "Agents", title: "Bounded autonomy, visible control", detail: "Manage agent goals, policy-reviewed tools, owners, risk and bounded autonomy.", status: "Policy governed", primary: "Review active goals", sections: [] },
  admin: { eyebrow: "Admin", title: "Operational clarity before activation", detail: "Review evidence, policy and lifecycle prerequisites in one compact operational workspace.", status: "Needs activation", primary: "Review prerequisites", sections: [{ title: "Activation queue", detail: "Items remain pending until the required owner, evidence and policy checks are present.", tone: "warning", action: "Review queue" }, { title: "Evidence ledger", detail: "Provider, agent and opportunity evidence stays attributable to its source and current lifecycle state.", tone: "success", action: "Inspect evidence" }, { title: "Policy controls", detail: "Pause or hold operations before a mutation, spend or external action can proceed.", tone: "neutral", action: "Review policy" }] },
};

const toneForStatus = (status: string): Tone => status === "Available" || status === "In your control" || status === "Verified" ? "success" : status.includes("Pending") || status.includes("Waiting") || status.includes("Needs") || status.includes("Candidate") ? "warning" : "neutral";

export function SurfaceDetail({ kind }: { kind: SurfaceDetailKind }) {
  const colors = useColors();
  const item = content[kind];
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [readiness, setReadiness] = useState<string | null>(null);
  const sectionCount = useMemo(() => kind === "agents" ? 4 : kind === "partners" ? 4 : kind === "checkout" ? 4 : kind === "confirmation" ? 4 : item.sections.length, [kind, item.sections.length]);

  const activate = (label: string, title: string) => {
    haptic.light();
    setActiveSection(title);
    if (kind === "confirmation" && label === "Confirm action") setConfirmed(true);
  };

  const checkReadiness = async () => setReadiness((await probeExpoPushToken()).detail);

  return (
    <ScreenContainer className="px-5 pt-3" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceHeader eyebrow={item.eyebrow} title={confirmed ? "Accepted internally" : item.title} right={<StatusPill label={confirmed ? "Accepted internally" : item.status} tone={confirmed ? "success" : toneForStatus(item.status)} />} />
        <Text style={[styles.intro, { color: colors.muted }]}>{item.detail}</Text>
        <ContinuityBand contextLabel={`${item.eyebrow} surface`} contextId={kind} evidence={kind === "checkout" || kind === "confirmation" ? "This surface preserves the proposal and confirmation context. Internal acceptance never implies external payment, delivery or fulfilment." : "This surface remains linked to the canonical conversation. Selecting a section prepares a next step without changing state silently."} action={<ActionButton label="Return to Chat" variant="ghost" onPress={() => router.replace("/(tabs)")} />} />
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Chat" onPress={() => router.replace("/(tabs)")} style={styles.backLink}><Text style={[styles.backLinkText, { color: colors.primary }]}>Back to Chat</Text></Pressable>

        {kind === "agents" ? <AgentsView colors={colors} activeSection={activeSection} onSelect={setActiveSection} /> : null}
        {kind === "connect" ? <ConnectView colors={colors} activeSection={activeSection} onSelect={setActiveSection} /> : null}
        {kind === "partners" ? <PartnersView colors={colors} activeSection={activeSection} onSelect={setActiveSection} /> : null}
        {kind === "checkout" ? <CheckoutView colors={colors} activeSection={activeSection} onSelect={setActiveSection} /> : null}
        {kind === "confirmation" ? <ConfirmationView colors={colors} confirmed={confirmed} onConfirm={() => activate("Confirm action", "Action proposal")} activeSection={activeSection} onSelect={setActiveSection} /> : null}

        {kind !== "agents" && kind !== "connect" && kind !== "partners" && kind !== "checkout" && kind !== "confirmation" ? <>
          <View style={[styles.metaRow, { borderColor: colors.border }]}><Text style={[styles.metaLabel, { color: colors.muted }]}>Surface readiness</Text><Text style={[styles.metaValue, { color: colors.foreground }]}>{sectionCount} governed areas</Text></View>
          {item.sections.map((section) => {
            const isActive = activeSection === section.title;
            return <SectionCard key={section.title} style={isActive ? { borderColor: colors.primary } : undefined}><View style={styles.sectionHeader}><View style={styles.sectionCopy}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{section.title}</Text><Text style={[styles.sectionDetail, { color: colors.muted }]}>{section.detail}</Text></View><StatusPill label={section.tone === "success" ? "Ready" : section.tone === "warning" ? "Pending" : "Defined"} tone={section.tone ?? "neutral"} /></View><Pressable accessibilityRole="button" accessibilityLabel={section.action} onPress={() => section.action === "Check device readiness" ? void checkReadiness() : activate(section.action ?? "Open", section.title)} style={({ pressed }) => [styles.rowAction, { borderTopColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.rowActionText, { color: colors.primary }]}>{isActive ? "Selected" : section.action}</Text></Pressable></SectionCard>;
          })}
          {readiness ? <View style={[styles.feedback, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}33` }]}><Text style={[styles.feedbackTitle, { color: colors.foreground }]}>Notification readiness</Text><Text style={[styles.feedbackDetail, { color: colors.muted }]}>{readiness}</Text></View> : null}
        </> : null}

        {activeSection && kind !== "confirmation" ? <View style={[styles.feedback, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}33` }]}><Text style={[styles.feedbackTitle, { color: colors.foreground }]}>Ready for the next step</Text><Text style={[styles.feedbackDetail, { color: colors.muted }]}>{`“${activeSection}” is selected. Kurukoo keeps the evidence and confirmation boundary visible.`}</Text></View> : null}
        {kind === "confirmation" && confirmed ? <View style={[styles.feedback, { backgroundColor: `${colors.success}12`, borderColor: `${colors.success}44` }]}><Text style={[styles.feedbackTitle, { color: colors.foreground }]}>Accepted internally</Text><Text style={[styles.feedbackDetail, { color: colors.muted }]}>Kurukoo has accepted and queued this action. Provider delivery or fulfilment remains pending independent evidence.</Text></View> : null}
        <ActionButton label={confirmed || activeSection === item.primary ? "Return to Chat" : item.primary ?? "Back to Chat"} onPress={() => { if (confirmed || activeSection === item.primary || !item.primary) router.replace("/(tabs)"); else activate(item.primary, item.primary); }} />
      </ScrollView>
    </ScreenContainer>
  );
}

function QrPairingScanner({ colors, onToken, onCancel }: { colors: ReturnType<typeof useColors>; onToken: (token: string) => void; onCancel: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  if (Platform.OS === "web") return <SectionCard><Text style={[styles.feedbackTitle, { color: colors.foreground }]}>Camera scanning is available in the native app</Text><Text style={[styles.feedbackDetail, { color: colors.muted }]}>On web, paste the pairing token from the QR code into the confirmation field.</Text><ActionButton label="Cancel scanning" variant="ghost" onPress={onCancel} /></SectionCard>;
  if (!permission) return <SectionCard><Text style={[styles.feedbackDetail, { color: colors.muted }]}>Checking camera permission…</Text></SectionCard>;
  if (!permission.granted) return <SectionCard><Text style={[styles.feedbackTitle, { color: colors.foreground }]}>Camera permission needed</Text><Text style={[styles.feedbackDetail, { color: colors.muted }]}>Kurukoo uses the camera only to read a one-time device-pairing QR code.</Text><View style={{ marginTop: 10 }}><ActionButton label={permission.canAskAgain ? "Allow camera access" : "Open camera settings"} onPress={() => void requestPermission()} /></View><ActionButton label="Cancel scanning" variant="ghost" onPress={onCancel} /></SectionCard>;
  return <SectionCard><Text style={[styles.feedbackTitle, { color: colors.foreground }]}>Scan pairing QR</Text><Text style={[styles.feedbackDetail, { color: colors.muted }]}>Align the QR code inside the frame. Expired or replayed codes are rejected by the server.</Text><View style={{ height: 260, overflow: "hidden", borderRadius: 16, marginTop: 12 }}><CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={scanned ? undefined : ({ data }) => { setScanned(true); onToken(data); }} /></View><ActionButton label="Cancel scanning" variant="ghost" onPress={onCancel} /></SectionCard>;
}

function ConnectView({ colors, activeSection, onSelect }: { colors: ReturnType<typeof useColors>; activeSection: string | null; onSelect: (value: string) => void }) {
  const channels = [
    { name: "WhatsApp", detail: "Companion-device QR linking is ready. Business webhook delivery still requires separate Meta provider evidence.", readiness: "QR linking ready", tone: "success" as Tone },
    { name: "Telegram", detail: "Companion-device QR linking is ready. Bot callback delivery remains pending Telegram provider evidence.", readiness: "QR linking ready", tone: "success" as Tone },
    { name: "Email and push", detail: "Review notification permission and link this device for internal delivery readiness. Delivery still needs provider evidence.", readiness: "Provider pending", tone: "warning" as Tone },
  ];
  const [selectedChannel, setSelectedChannel] = useState("WhatsApp");
  const [pairing, setPairing] = useState<{ pairingId: number | null; token: string; qrDataUrl: string; expiresAt: string; status: string } | null>(null);
  const [token, setToken] = useState("");
  const [deviceKey, setDeviceKey] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const devices = trpc.os.devices.list.useQuery(undefined, { retry: false });
  const driveConnection = trpc.os.storage.googleDriveStatus.useQuery(undefined, { retry: false });
  const createPairing = trpc.os.devices.createPairing.useMutation();
  const confirmPairing = trpc.os.devices.confirmPairing.useMutation();
  const revokeDevice = trpc.os.devices.revoke.useMutation();
  const beginDriveAuthorization = trpc.os.storage.beginGoogleDriveAuthorization.useMutation();
  const revokeDrive = trpc.os.storage.revokeGoogleDrive.useMutation();

  useEffect(() => {
    if (!pairing) { setRemainingMs(0); return; }
    const tick = () => setRemainingMs(Math.max(0, new Date(pairing.expiresAt).getTime() - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [pairing]);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem("kurukoo.mobile.device-key.v1").then((existing) => {
      if (!mounted) return;
      if (existing) setDeviceKey(existing);
      else {
        const created = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setDeviceKey(created);
        void AsyncStorage.setItem("kurukoo.mobile.device-key.v1", created);
      }
    });
    const acceptPairingUrl = (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const incoming = typeof parsed.queryParams?.token === "string" ? parsed.queryParams.token : undefined;
      if (incoming) { setToken(incoming); setFeedback("A pairing token was received. Confirm it to link this device."); }
      const driveState = typeof parsed.queryParams?.drive === "string" ? parsed.queryParams.drive : undefined;
      if (driveState === "connected") { setFeedback("Google Drive connected. New user artifacts will prefer your Kurukoo folder there."); void driveConnection.refetch(); }
      if (driveState === "error") setFeedback("Google Drive connection was not completed. No Drive access was saved.");
    };
    void Linking.getInitialURL().then(acceptPairingUrl);
    const subscription = Linking.addEventListener("url", ({ url }) => acceptPairingUrl(url));
    return () => { mounted = false; subscription.remove(); };
  }, []);

  const startPairing = async (channelName: string) => {
    setSelectedChannel(channelName);
    onSelect(channelName);
    setFeedback(null);
    if (!deviceKey) { setFeedback("This device is still preparing its secure pairing identity. Try again in a moment."); return; }
    try {
      const result = await createPairing.mutateAsync({ label: `${channelName} companion`, platform: Platform.OS, deviceKey });
      setPairing(result);
      setToken(result.token);
      setFeedback("QR pairing session created. Scan it from the device you want to link, then confirm the token.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "The pairing session could not be created. No device was linked.");
    }
  };

  const confirm = async () => {
    try {
      const result = await confirmPairing.mutateAsync({ token: token.trim() });
      setFeedback(`${result.label} is linked. Kurukoo can now use this device as an authenticated connection point.`);
      setPairing(null);
      await devices.refetch();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "The device could not be linked. No connection was marked complete.");
    }
  };

  return <>
    <View style={styles.channelNotice}><Text style={[styles.feedbackTitle, { color: colors.foreground }]}>Pairing stays truthful</Text><Text style={[styles.feedbackDetail, { color: colors.muted }]}>Generate a short-lived QR session, scan or copy its token on the other device, then confirm. A provider channel is only shown as linked after the server accepts the pairing.</Text></View>
    <Text style={[styles.subheading, { color: colors.foreground }]}>Communication</Text>
    {channels.map((channel) => <SectionCard key={channel.name} style={selectedChannel === channel.name ? { borderColor: colors.primary } : undefined}><View style={styles.rowHeader}><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>{channel.name}</Text><Text style={[styles.rowDetail, { color: colors.muted }]}>{channel.detail}</Text></View><StatusPill label={selectedChannel === channel.name && pairing ? "Pairing ready" : channel.readiness} tone={selectedChannel === channel.name && pairing ? "neutral" : channel.tone} /></View><ActionButton label={selectedChannel === channel.name && pairing ? "Refresh QR session" : "Create QR pairing"} variant={selectedChannel === channel.name && pairing ? "secondary" : "primary"} onPress={() => void startPairing(channel.name)} /></SectionCard>)}
    <Text style={[styles.subheading, { color: colors.foreground }]}>Storage</Text>
    <SectionCard><View style={styles.rowHeader}><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>Google Drive</Text><Text style={[styles.rowDetail, { color: colors.muted }]}>{driveConnection.data?.detail ?? "Checking Drive connection…"}</Text></View><StatusPill label={driveConnection.data?.status === "connected" ? "Connected" : driveConnection.data?.status === "not-configured" ? "Not configured" : "Not connected"} tone={driveConnection.data?.status === "connected" ? "success" : "warning"} /></View>{driveConnection.data?.status === "connected" ? <><Text style={[styles.rowDetail, { color: colors.muted }]}>Account: {driveConnection.data.accountEmail ?? "Connected Google account"}</Text><Text style={[styles.rowDetail, { color: colors.muted }]}>Kurukoo Voice folder: {driveConnection.data.folderId ?? "Created"}</Text><ActionButton label={revokeDrive.isPending ? "Revoking…" : "Revoke Drive access"} variant="ghost" onPress={() => void revokeDrive.mutateAsync().then(() => driveConnection.refetch())} /></> : <ActionButton label={beginDriveAuthorization.isPending ? "Preparing secure connection…" : "Connect Google Drive"} onPress={() => void beginDriveAuthorization.mutateAsync().then(({ authorizationUrl }) => Linking.openURL(authorizationUrl)).catch((error) => setFeedback(error instanceof Error ? error.message : "Google Drive is not ready to connect."))} />}</SectionCard>
        {scanning ? <QrPairingScanner colors={colors} onCancel={() => setScanning(false)} onToken={(raw) => { const parsed = Linking.parse(raw); const incoming = typeof parsed.queryParams?.token === "string" ? parsed.queryParams.token : raw; setToken(incoming); setScanning(false); setFeedback("QR code read. Confirm the link to complete device pairing."); }} /> : null}
    {pairing ? <SectionCard><Text style={[styles.feedbackTitle, { color: colors.foreground }]}>Scan to link {selectedChannel}</Text>
    <Text style={[styles.feedbackDetail, { color: colors.muted }]}>{remainingMs > 0 ? `Expires in ${Math.ceil(remainingMs / 1000)} seconds · ${new Date(pairing.expiresAt).toLocaleTimeString()}` : "This QR has expired. Refresh to create a new pairing session."} It does not claim provider delivery or external messaging.</Text><Image source={{ uri: pairing.qrDataUrl }} accessibilityLabel={`${selectedChannel} device pairing QR code`} style={{ width: 240, height: 240, alignSelf: "center", marginVertical: 12 }} /><ActionButton label="Scan QR code" variant="secondary" onPress={() => setScanning(true)} /><TextInput value={token} onChangeText={setToken} placeholder="Pairing token" placeholderTextColor={colors.muted} autoCapitalize="none" style={{ minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, color: colors.foreground, fontFamily: "Inter_400Regular" }} /><View style={{ marginTop: 10 }}><ActionButton label={remainingMs > 0 ? (confirmPairing.isPending ? "Linking…" : "Confirm link") : "Refresh QR session"} onPress={() => remainingMs > 0 ? void confirm() : void startPairing(selectedChannel)} /></View></SectionCard> : null}
    {feedback ? <View style={[styles.feedback, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}33` }]}><Text style={[styles.feedbackTitle, { color: colors.foreground }]}>Connection status</Text><Text style={[styles.feedbackDetail, { color: colors.muted }]}>{feedback}</Text></View> : null}
    <SectionCard><View style={styles.rowHeader}><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>Linked devices</Text><Text style={[styles.rowDetail, { color: colors.muted }]}>Only server-confirmed links appear here.</Text></View><StatusPill label={devices.isLoading ? "Loading" : `${devices.data?.length ?? 0} linked`} tone={devices.data?.length ? "success" : "neutral"} /></View>{devices.data?.map((device) => { const lastSeen = device.lastSeenAt ? new Date(device.lastSeenAt) : null; const stale = !lastSeen || Date.now() - lastSeen.getTime() > 7 * 24 * 60 * 60 * 1000; const active = device.status === "linked" && !stale; return <View key={device.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 10, gap: 5 }}><View style={styles.rowHeader}><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>{device.label}</Text><Text style={[styles.rowDetail, { color: colors.muted }]}>{device.platform} · connected {new Date(device.createdAt).toLocaleDateString()}</Text></View><StatusPill label={device.status === "revoked" ? "Revoked" : active ? "Active" : "Inactive"} tone={device.status === "revoked" ? "warning" : active ? "success" : "neutral"} /></View><Text style={[styles.rowDetail, { color: colors.muted }]}>{device.status === "linked" ? "Verified device link" : "Access is no longer active"} · last seen {lastSeen ? lastSeen.toLocaleString() : "not yet seen"}</Text>{device.status !== "revoked" ? <Pressable accessibilityRole="button" accessibilityLabel={`Revoke access for ${device.label}`} onPress={() => Alert.alert("Revoke device access?", `This will invalidate ${device.label} and stop future use.`, [{ text: "Cancel", style: "cancel" }, { text: "Revoke access", style: "destructive", onPress: () => void revokeDevice.mutateAsync({ id: device.id }).then(() => devices.refetch()) }])} style={styles.inlineAction}><Text style={[styles.rowActionText, { color: colors.error }]}>Revoke access</Text></Pressable> : null}</View>; })}</SectionCard>
  </>;
}

function AgentsView({ colors, activeSection, onSelect }: { colors: ReturnType<typeof useColors>; activeSection: string | null; onSelect: (value: string) => void }) {
  const agents = [{ name: "Price Checker", owner: "Retail Ops Team", risk: "Low risk", status: "Active", autonomy: "Up to 3 external calls per run" }, { name: "Support Triage", owner: "Customer Success", risk: "Low risk", status: "Active", autonomy: "Up to 5 internal actions" }, { name: "Reminder Agent", owner: "People Ops", risk: "Low risk", status: "Paused", autonomy: "Up to 2 external actions" }];
  return <><View style={styles.filterRow}><Text style={styles.filterLabel}>Search agents</Text><StatusPill label="All status" tone="neutral" /><StatusPill label="All risk" tone="neutral" /></View><Text style={styles.subheading}>Agents directory</Text>{agents.map((agent) => <SectionCard key={agent.name} style={activeSection === agent.name ? { borderColor: colors.primary } : undefined}><View style={styles.rowHeader}><View style={[styles.agentDot, { backgroundColor: colors.primary }]}><Text style={styles.agentDotText}>{agent.name.slice(0, 1)}</Text></View><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>{agent.name}</Text><Text style={[styles.rowDetail, { color: colors.muted }]}>{agent.owner}</Text></View><StatusPill label={agent.status} tone={agent.status === "Active" ? "success" : "warning"} /></View><View style={styles.metricGrid}><Metric label="Risk" value={agent.risk} colors={colors} /><Metric label="Bounded autonomy" value={agent.autonomy} colors={colors} /></View><Pressable accessibilityRole="button" onPress={() => onSelect(agent.name)} style={styles.inlineAction}><Text style={[styles.rowActionText, { color: colors.primary }]}>{activeSection === agent.name ? "Selected" : "Review agent"}</Text></Pressable></SectionCard>)}<SectionCard><Text style={[styles.subheading, { color: colors.foreground }]}>Active goal queue</Text>{["Check price for SKU 1289 in US", "Triage request from Sarah Lee", "Remind team about Q2 planning"].map((goal, index) => <View key={goal} style={[styles.goalRow, { borderBottomColor: colors.border }]}><Text style={[styles.rowDetail, { color: colors.foreground }]}>{goal}</Text><StatusPill label={index === 2 ? "Paused" : "Running"} tone={index === 2 ? "warning" : "success"} /></View>)}</SectionCard></>;
}

function PartnersView({ colors, activeSection, onSelect }: { colors: ReturnType<typeof useColors>; activeSection: string | null; onSelect: (value: string) => void }) {
  return <><View style={styles.stepper}>{["Welcome", "Capability", "Opportunities", "Impact"].map((label, index) => <View key={label} style={styles.stepItem}><View style={[styles.stepCircle, { backgroundColor: index === 0 ? colors.primary : colors.surface, borderColor: colors.primary }]}><Text style={[styles.stepNumber, { color: index === 0 ? KURUKOO_VISUAL_TOKENS.onPrimary : colors.primary }]}>{index + 1}</Text></View><Text style={[styles.stepLabel, { color: colors.muted }]}>{label}</Text></View>)}</View><SectionCard style={styles.heroPanel}><Text style={[styles.heroTitle, { color: colors.foreground }]}>Join the Kurukoo network</Text><Text style={[styles.rowDetail, { color: colors.muted }]}>Tell us about yourself so we can connect you with the right opportunities.</Text><ActionButton label="Get started" onPress={() => onSelect("Get started")} /></SectionCard><SectionCard><View style={styles.cardHeader}><Text style={[styles.subheading, { color: colors.foreground }]}>Your capability & availability</Text><StatusPill label="80%" tone="success" /></View><Text style={[styles.rowDetail, { color: colors.muted }]}>Profile strength</Text><View style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: "80%" }]} /></View><View style={styles.chipRow}>{["Project management", "Stakeholder engagement", "Strategy", "Risk assessment"].map((chip) => <StatusPill key={chip} label={chip} tone="neutral" />)}</View><Pressable accessibilityRole="button" onPress={() => onSelect("Edit capability")} style={styles.inlineAction}><Text style={[styles.rowActionText, { color: colors.primary }]}>{activeSection === "Edit capability" ? "Selected" : "Edit capability"}</Text></Pressable></SectionCard><SectionCard><View style={styles.cardHeader}><Text style={[styles.subheading, { color: colors.foreground }]}>Opportunities</Text><Text style={[styles.rowActionText, { color: colors.primary }]}>View all</Text></View>{["Project brief — May 14", "Decisions log — May 13", "Client update — May 12"].map((opportunity, index) => <View key={opportunity} style={[styles.goalRow, { borderBottomColor: colors.border }]}><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>{opportunity}</Text><Text style={[styles.rowDetail, { color: colors.muted }]}>Source: {index === 0 ? "Google Docs" : index === 1 ? "Notion" : "Acme Corp"}</Text></View><StatusPill label={index === 2 ? "Claimed" : "Invited"} tone={index === 2 ? "success" : "warning"} /></View>)}</SectionCard><SectionCard><Text style={[styles.subheading, { color: colors.foreground }]}>Impact dashboard</Text><View style={styles.metricGrid}><Metric label="Opportunities" value="4 active" colors={colors} /><Metric label="Hours contributed" value="18" colors={colors} /><Metric label="Evidence submitted" value="3" colors={colors} /></View><Text style={[styles.rowDetail, { color: colors.muted }]}>Evidence required remains visible before payments or verified impact are claimed.</Text></SectionCard></>;
}

function CheckoutView({ colors, activeSection, onSelect }: { colors: ReturnType<typeof useColors>; activeSection: string | null; onSelect: (value: string) => void }) {
  return <><View style={styles.stepper}>{["Review offer", "Cart & provenance", "Confirm request", "Track request"].map((label, index) => <View key={label} style={styles.stepItem}><View style={[styles.stepCircle, { backgroundColor: index === 0 ? colors.primary : colors.surface, borderColor: colors.primary }]}><Text style={[styles.stepNumber, { color: index === 0 ? KURUKOO_VISUAL_TOKENS.onPrimary : colors.primary }]}>{index + 1}</Text></View><Text style={[styles.stepLabel, { color: colors.muted }]}>{label}</Text></View>)}</View><SectionCard><Text style={[styles.subheading, { color: colors.foreground }]}>Your cart</Text><View style={styles.cartRow}><View style={[styles.documentIcon, { backgroundColor: `${colors.primary}18` }]}><Text style={[styles.documentIconText, { color: colors.primary }]}>D</Text></View><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>Client meeting prep pack</Text><Text style={[styles.rowDetail, { color: colors.muted }]}>Key risks, decisions, and draft agenda for May 20 meeting.</Text></View><Text style={[styles.rowTitle, { color: colors.foreground }]}>1</Text></View><View style={[styles.provenanceBox, { borderColor: colors.border }]}><Metric label="Seller" value="Alex Morgan" colors={colors} /><Metric label="Source" value="Kurukoo Network" colors={colors} /><Metric label="Provider type" value="Independent expert" colors={colors} /><Metric label="Price" value="Pending confirmation" colors={colors} /></View><View style={[styles.notice, { borderColor: colors.border }]}><StatusPill label="Payment not completed" tone="warning" /><Text style={[styles.rowDetail, { color: colors.muted }]}>This is a request, not an automatic purchase. Final price and delivery remain seller-dependent.</Text></View></SectionCard><ActionButton label={activeSection === "Confirm request" ? "Return to Chat" : "Confirm request"} onPress={() => onSelect("Confirm request")} /><ActionButton label="Cancel" variant="ghost" onPress={() => onSelect("Cancel")} /></>;
}

function ConfirmationView({ colors, confirmed, onConfirm, activeSection, onSelect }: { colors: ReturnType<typeof useColors>; confirmed: boolean; onConfirm: () => void; activeSection: string | null; onSelect: (value: string) => void }) {
  return <><SectionCard><View style={styles.requestBadge}><Text style={[styles.rowDetail, { color: colors.muted }]}>Request #1842</Text></View><Text style={[styles.subheading, { color: colors.foreground }]}>{confirmed ? "Accepted internally" : "Confirm action"}</Text><View style={[styles.notice, { borderColor: colors.border }]}><StatusPill label={confirmed ? "Accepted internally" : "Prepared"} tone={confirmed ? "success" : "neutral"} /><Text style={[styles.rowDetail, { color: colors.muted }]}>{confirmed ? "Kurukoo has accepted and queued this action." : "This action can create or change data outside Kurukoo."}</Text></View><View style={styles.objectList}>{["Project brief — May 14", "Risk register (current)", "Decisions log — May 13", "Draft agenda"].map((object) => <View key={object} style={[styles.objectRow, { borderBottomColor: colors.border }]}><Text style={[styles.rowDetail, { color: colors.foreground }]}>{object}</Text></View>)}</View><View style={styles.timeline}>{["Accepted internally", "Sent to provider", "Provider confirmation", "Complete"].map((state, index) => <View key={state} style={styles.timelineItem}><View style={[styles.timelineDot, { backgroundColor: index === 0 && confirmed ? colors.success : index === 0 ? colors.primary : colors.border }]} /><Text style={[styles.rowDetail, { color: colors.muted }]}>{state}</Text></View>)}</View></SectionCard><SectionCard><Text style={[styles.subheading, { color: colors.foreground }]}>Evidence</Text><Metric label="Request ID" value="#1842" colors={colors} /><Metric label="Agent" value="Kurukoo Agent" colors={colors} /><Metric label="Provider state" value={confirmed ? "Pending" : "Not sent"} colors={colors} /></SectionCard><ActionButton label={confirmed ? "Continue in Chat" : "Confirm action"} onPress={confirmed ? () => onSelect("Continue in Chat") : onConfirm} /></>;
}

function Metric({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) { return <View style={styles.metric}><Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text><Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text></View>; }

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 16 },
  intro: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  backLink: { minHeight: 44, justifyContent: "center" },
  backLinkText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13, borderTopWidth: 1, borderBottomWidth: 1 },
  metaLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 },
  metaValue: { fontFamily: "Inter_700Bold", fontSize: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  sectionCopy: { flex: 1, gap: 6 },
  sectionTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 23 },
  sectionDetail: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  rowAction: { minHeight: 40, marginTop: 4, paddingTop: 10, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowActionText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  feedback: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 5 },
  feedbackTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 15 },
  feedbackDetail: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.72 },
  filterRow: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  filterLabel: { flex: 1, minWidth: 130, minHeight: 42, borderWidth: 1, borderColor: KURUKOO_VISUAL_TOKENS.border, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 12, fontFamily: "Inter_400Regular", fontSize: 12, color: KURUKOO_VISUAL_TOKENS.muted },
  subheading: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 18, lineHeight: 24 },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  agentDot: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  agentDotText: { color: KURUKOO_VISUAL_TOKENS.onPrimary, fontFamily: "Inter_700Bold", fontSize: 14 },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 15, lineHeight: 20 },
  rowDetail: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  metric: { flex: 1, minWidth: 120, gap: 3 },
  metricLabel: { fontFamily: "Inter_500Medium", fontSize: 11 },
  metricValue: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  inlineAction: { minHeight: 44, justifyContent: "center", borderTopWidth: 1, borderTopColor: KURUKOO_VISUAL_TOKENS.border, marginTop: 12 },
  goalRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottomWidth: 1 },
  stepper: { flexDirection: "row", gap: 8, justifyContent: "space-between" },
  stepItem: { flex: 1, gap: 6 },
  stepCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepNumber: { fontFamily: "Inter_700Bold", fontSize: 11 },
  stepLabel: { fontFamily: "Inter_500Medium", fontSize: 10, lineHeight: 13 },
  heroPanel: { gap: 12 },
  heroTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 22, lineHeight: 28 },
  progressTrack: { height: 7, borderRadius: 4, overflow: "hidden", marginTop: 10 },
  progressFill: { height: 7, borderRadius: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  cartRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  documentIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  documentIconText: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 18 },
  provenanceBox: { borderWidth: 1, borderRadius: 13, padding: 12, gap: 10, marginTop: 14 },
  notice: { borderWidth: 1, borderRadius: 13, padding: 12, gap: 8, marginTop: 14 },
  requestBadge: { alignSelf: "flex-start", borderWidth: 1, borderColor: KURUKOO_VISUAL_TOKENS.border, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8 },
  objectList: { borderWidth: 1, borderColor: KURUKOO_VISUAL_TOKENS.border, borderRadius: 13, paddingHorizontal: 12, marginTop: 12 },
  objectRow: { minHeight: 42, justifyContent: "center", borderBottomWidth: 1 },
  timeline: { marginTop: 14, gap: 10 },
  timelineItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  timelineDot: { width: 8, height: 8, borderRadius: 4 },
  channelNotice: { padding: 14, borderWidth: 1, borderColor: KURUKOO_VISUAL_TOKENS.border, borderRadius: 14, backgroundColor: KURUKOO_VISUAL_TOKENS.surfaceSoft, gap: 4, marginBottom: 12 },
});
