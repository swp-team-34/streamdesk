import { useCallback, useEffect, useRef, useState } from "react";
import { publishGlobalSyncState } from "@/lib/global-sync-state";

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type ValidationResult<TPayload> =
  | { ok: true; payload: TPayload }
  | { ok: false; error?: string };

type UseDebouncedAutosaveOptions<TValue, TPayload> = {
  enabled: boolean;
  resetKey: string;
  source: string;
  value: TValue;
  validate: (value: TValue) => ValidationResult<TPayload>;
  save: (payload: TPayload) => Promise<unknown>;
  serialize?: (value: TValue) => string;
  delayMs?: number;
};

const DEFAULT_AUTOSAVE_DELAY_MS = 800;

export function useDebouncedAutosave<TValue, TPayload>({
  enabled,
  resetKey,
  source,
  value,
  validate,
  save,
  serialize = JSON.stringify,
  delayMs = DEFAULT_AUTOSAVE_DELAY_MS,
}: UseDebouncedAutosaveOptions<TValue, TPayload>) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedKeyRef = useRef("");
  const lastSavedSignatureRef = useRef("");
  const latestValueRef = useRef(value);
  const activeSaveRef = useRef<Promise<boolean> | null>(null);
  const validateRef = useRef(validate);
  const saveRef = useRef(save);
  const serializeRef = useRef(serialize);
  const sourceRef = useRef(source);

  latestValueRef.current = value;
  validateRef.current = validate;
  saveRef.current = save;
  serializeRef.current = serialize;
  sourceRef.current = source;

  const clearTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const executeSave = useCallback(async (snapshot: TValue, signature: string): Promise<boolean> => {
    if (activeSaveRef.current) await activeSaveRef.current;
    if (signature !== serializeRef.current(latestValueRef.current)) return true;

    const validated = validateRef.current(snapshot);
    if (!validated.ok) {
      setStatus("dirty");
      setError(validated.error || "");
      return false;
    }

    setStatus("saving");
    setError("");
    publishGlobalSyncState(sourceRef.current, "syncing");

    const request = (async () => {
      try {
        await saveRef.current(validated.payload);
        lastSavedSignatureRef.current = signature;
        const latestSignature = serializeRef.current(latestValueRef.current);
        if (latestSignature === signature) {
          setStatus("saved");
          publishGlobalSyncState(sourceRef.current, "synced");
        } else {
          setStatus("dirty");
        }
        return true;
      } catch (saveError: any) {
        const message = saveError?.message || "Не удалось сохранить изменения";
        setStatus("error");
        setError(message);
        publishGlobalSyncState(sourceRef.current, "error", message);
        return false;
      }
    })();

    activeSaveRef.current = request;
    const result = await request;
    if (activeSaveRef.current === request) activeSaveRef.current = null;
    return result;
  }, []);

  const signature = serialize(value);

  useEffect(() => {
    clearTimer();
    if (!enabled) {
      initializedKeyRef.current = "";
      lastSavedSignatureRef.current = "";
      setStatus("idle");
      setError("");
      return;
    }

    if (initializedKeyRef.current !== resetKey) {
      initializedKeyRef.current = resetKey;
      lastSavedSignatureRef.current = signature;
      setStatus("saved");
      setError("");
      return;
    }

    if (signature === lastSavedSignatureRef.current) {
      if (!activeSaveRef.current) setStatus("saved");
      setError("");
      return;
    }

    const validated = validate(value);
    if (!validated.ok) {
      setStatus("dirty");
      setError(validated.error || "");
      return;
    }

    setStatus("dirty");
    setError("");
    const snapshot = value;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void executeSave(snapshot, signature);
    }, delayMs);

    return clearTimer;
  }, [clearTimer, delayMs, enabled, executeSave, resetKey, signature]);

  useEffect(() => clearTimer, [clearTimer]);

  const flush = useCallback(async (): Promise<boolean> => {
    clearTimer();
    while (enabled) {
      if (activeSaveRef.current) {
        const activeResult = await activeSaveRef.current;
        if (!activeResult) return false;
        continue;
      }
      const snapshot = latestValueRef.current;
      const latestSignature = serializeRef.current(snapshot);
      if (latestSignature === lastSavedSignatureRef.current) return true;
      const validated = validateRef.current(snapshot);
      if (!validated.ok) {
        setStatus("dirty");
        setError(validated.error || "");
        return false;
      }
      const result = await executeSave(snapshot, latestSignature);
      if (!result) return false;
    }
    return true;
  }, [clearTimer, enabled, executeSave]);

  return { status, error, flush };
}
