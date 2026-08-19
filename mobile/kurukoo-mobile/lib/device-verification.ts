import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEVICE_VERIFICATION_STORAGE_KEY = "kurukoo.mobile.device-verification.v1";

export type DeviceVerificationState = "verified" | "not-provider";

export function parseDeviceVerificationState(value: string | null): DeviceVerificationState | null {
  if (value === "verified" || value === "not-provider") return value;
  return null;
}

export async function loadDeviceVerificationState(): Promise<DeviceVerificationState | null> {
  try {
    return parseDeviceVerificationState(await AsyncStorage.getItem(DEVICE_VERIFICATION_STORAGE_KEY));
  } catch {
    return null;
  }
}

export async function saveDeviceVerificationState(state: DeviceVerificationState): Promise<void> {
  await AsyncStorage.setItem(DEVICE_VERIFICATION_STORAGE_KEY, state);
}

export async function clearDeviceVerificationState(): Promise<void> {
  await AsyncStorage.removeItem(DEVICE_VERIFICATION_STORAGE_KEY);
}
