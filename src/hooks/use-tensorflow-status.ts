import { useEffect, useState } from "react";

interface TensorFlowStatus {
  state: "loading" | "ready" | "error";
  version?: string;
  backend?: string;
}

export function useTensorFlowStatus(): TensorFlowStatus {
  const [status, setStatus] = useState<TensorFlowStatus>({ state: "loading" });

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    let active = true;
    void import("@tensorflow/tfjs")
      .then(async (tf) => {
        await tf.ready();
        if (active) {
          setStatus({ state: "ready", version: tf.version.tfjs, backend: tf.getBackend() });
        }
      })
      .catch(() => {
        if (active) setStatus({ state: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

  return status;
}

