import { useEffect, useState } from "react";
import { DEFAULT_LAB_ID, labFromHash, labHref, legacyPathToLab, type LabId } from "@/domain/lab-registry";

function readRoute(): LabId | null {
  if (window.location.hash) return labFromHash(window.location.hash);
  return legacyPathToLab(window.location.pathname) ?? DEFAULT_LAB_ID;
}

export function useLabRoute(): LabId | null {
  const [labId, setLabId] = useState<LabId | null>(() => readRoute());

  useEffect(() => {
    if (!window.location.hash) {
      const initial = legacyPathToLab(window.location.pathname) ?? DEFAULT_LAB_ID;
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${labHref(initial)}`);
    }
    const handleHashChange = () => setLabId(labFromHash(window.location.hash));
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return labId;
}
