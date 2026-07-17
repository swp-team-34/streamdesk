import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ConfirmDialogOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export type PromptDialogOptions = {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: "text" | "password";
  required?: boolean;
};

type ConfirmRequest = {
  kind: "confirm";
  options: ConfirmDialogOptions;
  resolve: (value: boolean) => void;
};

type PromptRequest = {
  kind: "prompt";
  options: PromptDialogOptions;
  resolve: (value: string | null) => void;
};

type DialogRequest = ConfirmRequest | PromptRequest;

type AppDialogContextValue = {
  confirm: (options: string | ConfirmDialogOptions) => Promise<boolean>;
  prompt: (options: string | PromptDialogOptions) => Promise<string | null>;
};

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const activeRequestRef = useRef<DialogRequest | null>(null);

  const replaceRequest = useCallback((nextRequest: DialogRequest) => {
    const activeRequest = activeRequestRef.current;
    if (activeRequest?.kind === "confirm") activeRequest.resolve(false);
    if (activeRequest?.kind === "prompt") activeRequest.resolve(null);
    activeRequestRef.current = nextRequest;
    setRequest(nextRequest);
  }, []);

  const finishRequest = useCallback((value: boolean | string | null) => {
    const activeRequest = activeRequestRef.current;
    if (!activeRequest) return;
    activeRequestRef.current = null;
    setRequest(null);
    if (activeRequest.kind === "confirm") activeRequest.resolve(Boolean(value));
    else activeRequest.resolve(typeof value === "string" ? value : null);
  }, []);

  const confirm = useCallback((options: string | ConfirmDialogOptions) => (
    new Promise<boolean>((resolve) => {
      replaceRequest({
        kind: "confirm",
        options: typeof options === "string"
          ? { description: options, destructive: true }
          : options,
        resolve,
      });
    })
  ), [replaceRequest]);

  const prompt = useCallback((options: string | PromptDialogOptions) => (
    new Promise<string | null>((resolve) => {
      const normalizedOptions = typeof options === "string"
        ? { title: options }
        : options;
      setPromptValue(normalizedOptions.defaultValue ?? "");
      replaceRequest({
        kind: "prompt",
        options: normalizedOptions,
        resolve,
      });
    })
  ), [replaceRequest]);

  const confirmOptions = request?.kind === "confirm" ? request.options : null;
  const promptOptions = request?.kind === "prompt" ? request.options : null;
  const promptIsInvalid = Boolean(promptOptions?.required && !promptValue.trim());

  return (
    <AppDialogContext.Provider value={{ confirm, prompt }}>
      {children}

      <AlertDialog
        open={Boolean(confirmOptions)}
        onOpenChange={(open) => {
          if (!open) finishRequest(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmOptions?.title ?? "Подтвердите действие"}</AlertDialogTitle>
            <AlertDialogDescription>{confirmOptions?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{confirmOptions?.cancelLabel ?? "Отмена"}</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                confirmOptions?.destructive &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
              onClick={() => finishRequest(true)}
            >
              {confirmOptions?.confirmLabel ?? "Продолжить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(promptOptions)}
        onOpenChange={(open) => {
          if (!open) finishRequest(null);
        }}
      >
        <DialogContent className="max-w-md">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!promptIsInvalid) finishRequest(promptValue.trim());
            }}
          >
            <DialogHeader>
              <DialogTitle>{promptOptions?.title}</DialogTitle>
              {promptOptions?.description && (
                <DialogDescription>{promptOptions.description}</DialogDescription>
              )}
            </DialogHeader>
            <div className="space-y-2">
              {promptOptions?.label && (
                <label className="text-sm font-medium text-foreground" htmlFor="app-dialog-prompt-input">
                  {promptOptions.label}
                </label>
              )}
              <Input
                id="app-dialog-prompt-input"
                type={promptOptions?.inputType ?? "text"}
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                placeholder={promptOptions?.placeholder}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => finishRequest(null)}>
                {promptOptions?.cancelLabel ?? "Отмена"}
              </Button>
              <Button type="submit" disabled={promptIsInvalid}>
                {promptOptions?.confirmLabel ?? "Применить"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(AppDialogContext);
  if (!context) {
    throw new Error("useAppDialog must be used within AppDialogProvider");
  }
  return context;
}
