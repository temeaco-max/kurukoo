import { useEffect, useState } from "react";

type ProfileResponse = { profile?: { name?: string | null; location?: string | null } };

async function fetchProfile() {
  const base = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");
  const response = await fetch(`${base}/api/profile`, { credentials: "include" });
  if (!response.ok) throw new Error("Profile unavailable");
  return (await response.json()) as ProfileResponse;
}

export function useProfileIdentity(fallback = "there") {
  const [name, setName] = useState(fallback);
  useEffect(() => {
    let cancelled = false;
    const read = () => {
      void fetchProfile().then(({ profile }) => {
        if (!cancelled && profile?.name?.trim()) setName(profile.name.trim());
      }).catch(() => {
        const cached = localStorage.getItem("kurukoo-profile-name")?.trim();
        if (!cancelled && cached) setName(cached);
      });
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("kurukoo-profile-updated", read);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", read);
      window.removeEventListener("kurukoo-profile-updated", read);
    };
  }, [fallback]);
  return name;
}
