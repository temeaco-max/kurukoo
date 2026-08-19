import { useLocalSearchParams } from "expo-router";
import { SurfaceDetail, type SurfaceDetailKind } from "@/components/surface-detail";

const validKinds: SurfaceDetailKind[] = ["connect", "memory", "safety", "checkout", "confirmation", "partners", "agents", "admin"];

export default function SurfaceRoute() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const selected = validKinds.includes(kind as SurfaceDetailKind) ? (kind as SurfaceDetailKind) : "connect";
  return <SurfaceDetail kind={selected} />;
}
