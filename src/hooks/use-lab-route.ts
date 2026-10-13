import { useEffect, useState } from "react";
import { DEFAULT_LAB_ID, experimentFromHash, experimentHref, legacyPathToExperiment, type LabId } from "@/catalog/experiment-catalog";

function readRoute(): LabId | null {
  if (window.location.hash) return experimentFromHash(window.location.hash);
  return legacyPathToExperiment(window.location.pathname) ?? DEFAULT_LAB_ID;
}

export function useLabRoute(): LabId | null {
  const [labId, setLabId] = useState<LabId | null>(() => readRoute());

  useEffect(() => {
    if (!window.location.hash) {
      const initial = legacyPathToExperiment(window.location.pathname) ?? DEFAULT_LAB_ID;
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${experimentHref(initial)}`);
    }
    const handleHashChange = () => setLabId(experimentFromHash(window.location.hash));
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return labId;
}
