import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import * as Linking from "expo-linking";

import { ActionButton, SectionCard, SurfaceHeader } from "@/components/kurukoo-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { haptic } from "@/lib/haptics";
import { getApiBaseUrl } from "@/constants/oauth";

function isKurukooUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const apiHost = new URL(getApiBaseUrl()).hostname;
    return url.protocol === "https:" && (url.hostname === apiHost || url.hostname === "kurukoo.app" || url.hostname === "www.kurukoo.app");
  } catch {
    return false;
  }
}

export default function ScanScreen() {
  const colors = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openContext = async (raw: string) => {
    haptic.success();
    setScanned(true);
    const data = raw.trim();
    if (!data) return setError("That QR code did not contain a Kurukoo context.");
    if (/^https:\/\//i.test(data)) {
      if (!isKurukooUrl(data)) return setError("This QR code points to a different website. Kurukoo did not open it.");
      return void Linking.openURL(data);
    }
    if (/^[A-Za-z0-9._~:-]{8,512}$/.test(data)) return router.replace({ pathname: "/(tabs)", params: { qr: data } });
    setError("This QR code is not a recognised Kurukoo context.");
  };

  if (Platform.OS === "web") return <ScreenContainer className="px-5 pt-3"><SurfaceHeader eyebrow="QR context" title="Scan on the native app" /><SectionCard><Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Camera scanning is only available on iOS and Android.</Text><ActionButton label="Back" onPress={() => router.back()} /></SectionCard></ScreenContainer>;
  if (!permission) return <ScreenContainer className="px-5 pt-3"><Text style={{ color: colors.muted }}>Checking camera permission…</Text></ScreenContainer>;
  if (!permission.granted) return <ScreenContainer className="px-5 pt-3"><SurfaceHeader eyebrow="QR context" title="Scan a Kurukoo code" /><SectionCard><Text style={{ color: colors.muted, fontFamily: "Inter_400Regular", lineHeight: 21 }}>Kurukoo uses camera access only to read a QR context and open the corresponding conversation or surface.</Text><ActionButton label={permission.canAskAgain ? "Allow camera" : "Open camera settings"} onPress={() => void requestPermission()} /><ActionButton label="Back" variant="ghost" onPress={() => router.back()} /></SectionCard></ScreenContainer>;

  return <ScreenContainer className="px-5 pt-3"><SurfaceHeader eyebrow="QR context" title="Scan to open Kurukoo" /><SectionCard><Text style={{ color: colors.muted, fontFamily: "Inter_400Regular", lineHeight: 21 }}>Point your camera at a Kurukoo QR. The server still validates the signed context before anything is opened.</Text><View style={{ height: 330, borderRadius: 18, overflow: "hidden", marginTop: 14 }}><CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={scanned ? undefined : ({ data }) => void openContext(data)} /></View>{error ? <Text style={{ color: colors.error, marginTop: 12, fontFamily: "Inter_500Medium" }}>{error}</Text> : null}<ActionButton label="Cancel" variant="ghost" onPress={() => router.back()} /></SectionCard></ScreenContainer>;
}
