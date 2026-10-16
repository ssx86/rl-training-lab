import type { Td3AgentState, Td3SerializedTensor } from "@/rl/continuous/td3-agent";
import type { Subject2RuntimeCheckpoint } from "./subject2-runtime";

export const SUBJECT2_CHECKPOINT_KEY = "qlearning.subject2.checkpoint.v3";
export const LEGACY_SUBJECT2_CHECKPOINT_KEYS = ["qlearning.subject2.checkpoint.v2", "qlearning.subject2.checkpoint.v1"] as const;

export interface StoredSubject2Checkpoint {
  readonly savedAt: string;
  readonly checkpoint: Subject2RuntimeCheckpoint;
}

interface EncodedTensor {
  readonly shape: readonly number[];
  readonly values: string;
}

type EncodedAgentState = Omit<Td3AgentState, "networks"> & {
  readonly networks: readonly (readonly EncodedTensor[])[];
};

type EncodedRuntimeCheckpoint = Omit<Subject2RuntimeCheckpoint, "agent"> & { readonly agent: EncodedAgentState };
interface EncodedStoredCheckpoint { readonly schemaVersion: 3; readonly savedAt: string; readonly checkpoint: EncodedRuntimeCheckpoint }

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(offset, offset + 0x8000)));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodeTensor(tensor: Td3SerializedTensor): EncodedTensor {
  const bytes = new Uint8Array(tensor.values.buffer, tensor.values.byteOffset, tensor.values.byteLength);
  return { shape: [...tensor.shape], values: bytesToBase64(bytes) };
}

function decodeTensor(tensor: EncodedTensor): Td3SerializedTensor {
  const bytes = base64ToBytes(tensor.values);
  if (bytes.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) throw new RangeError("模型权重数据长度无效。");
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { shape: [...tensor.shape], values: new Float32Array(copy) };
}

export function saveSubject2Checkpoint(record: StoredSubject2Checkpoint, storage: Storage = localStorage): void {
  const encoded: EncodedStoredCheckpoint = {
    schemaVersion: 3,
    savedAt: record.savedAt,
    checkpoint: {
      ...record.checkpoint,
      agent: {
        ...record.checkpoint.agent,
        networks: record.checkpoint.agent.networks.map((network) => network.map(encodeTensor)),
      },
    },
  };
  storage.setItem(SUBJECT2_CHECKPOINT_KEY, JSON.stringify(encoded));
}

export function loadSubject2Checkpoint(storage: Storage = localStorage): StoredSubject2Checkpoint | null {
  try {
    const raw = storage.getItem(SUBJECT2_CHECKPOINT_KEY);
    if (!raw) return null;
    const encoded = JSON.parse(raw) as EncodedStoredCheckpoint;
    if (encoded.schemaVersion !== 3 || encoded.checkpoint?.version !== 3 || encoded.checkpoint.agent?.version !== 1
      || !Array.isArray(encoded.checkpoint.agent.networks) || !Number.isFinite(Date.parse(encoded.savedAt))) return null;
    return {
      savedAt: encoded.savedAt,
      checkpoint: {
        ...encoded.checkpoint,
        agent: {
          ...encoded.checkpoint.agent,
          networks: encoded.checkpoint.agent.networks.map((network) => network.map(decodeTensor)),
        },
      },
    };
  } catch {
    return null;
  }
}

export function hasLegacySubject2Checkpoint(storage: Storage = localStorage): boolean {
  return LEGACY_SUBJECT2_CHECKPOINT_KEYS.some((key) => storage.getItem(key) !== null);
}
