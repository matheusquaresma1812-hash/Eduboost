import { useEffect, useState, useCallback } from "react";

const KEY = "eduboost-profile";

export function getStoredProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  localStorage.setItem(KEY, JSON.stringify(profile));
}

export function clearProfile() {
  localStorage.removeItem(KEY);
}

export function useProfile() {
  const [profile, setProfile] = useState(() => getStoredProfile());
  useEffect(() => {
    const handler = () => setProfile(getStoredProfile());
    window.addEventListener("eduboost:profile", handler);
    return () => window.removeEventListener("eduboost:profile", handler);
  }, []);
  const update = useCallback((p) => {
    saveProfile(p);
    setProfile(p);
    window.dispatchEvent(new Event("eduboost:profile"));
  }, []);
  return [profile, update];
}

export function initials(name) {
  if (!name) return "AL";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || "A") + (parts[1]?.[0] || parts[0]?.[1] || "L");
}
