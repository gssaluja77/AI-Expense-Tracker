"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Loader2,
  RefreshCw,
  ScanText,
  UploadCloud,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { DraftTransaction } from "@/types/draft-transaction";
import { DraftReviewForm } from "./DraftReviewForm";

/**
 * Upload a receipt → Gemini vision OCR → review & confirm.
 *
 * Flow:
 *   1. User drops or picks an image (or uses the device camera on mobile).
 *   2. We POST it multipart to /api/transactions/parse.
 *   3. The returned {@link DraftTransaction} is rendered in the shared
 *      {@link DraftReviewForm} alongside a side-by-side preview of the
 *      original image so the user can verify the extraction.
 *   4. Confirm persists via `createTransactionFromDraftAction`.
 */

interface ReceiptScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  baseCurrency: string;
}

const ACCEPT = "image/*,application/pdf";
const MAX_BYTES = 8 * 1024 * 1024;

type Stage =
  | { kind: "idle" }
  | { kind: "parsing"; file: File; previewUrl: string }
  | {
      kind: "review";
      file: File;
      previewUrl: string;
      draft: DraftTransaction;
    }
  | { kind: "error"; file: File; previewUrl: string; message: string };

export function ReceiptScannerDialog({
  open,
  onClose,
  onSaved,
  baseCurrency,
}: ReceiptScannerDialogProps) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStage((prev) => {
      if ("previewUrl" in prev && prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return { kind: "idle" };
    });
  }, []);

  // Revoke the object URL when the dialog closes so we don't leak blobs.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage.kind !== "parsing") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, stage.kind]);

  const parse = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        setStage({
          kind: "error",
          file,
          previewUrl: URL.createObjectURL(file),
          message: "This file is larger than 8 MB. Try a smaller image.",
        });
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setStage({ kind: "parsing", file, previewUrl });

      try {
        const form = new FormData();
        form.set("image", file);
        const res = await fetch("/api/transactions/parse", {
          method: "POST",
          body: form,
        });
        const json = (await res.json()) as
          | { draft: DraftTransaction }
          | { error: string };
        if (!res.ok || "error" in json) {
          throw new Error(
            "error" in json
              ? json.error
              : `Parsing failed (HTTP ${res.status}).`
          );
        }
        setStage({ kind: "review", file, previewUrl, draft: json.draft });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not read the receipt.";
        setStage({ kind: "error", file, previewUrl, message });
      }
    },
    []
  );

  const onFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      void parse(file);
    },
    [parse]
  );

  if (!open) return null;

  const showingPreview = stage.kind !== "idle";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && stage.kind !== "parsing") onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl dark:border-slate-800 dark:bg-slate-950">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
              <ScanText className="h-4 w-4" />
            </span>
            <div>
              <h2 id="receipt-dialog-title" className="text-base font-semibold">
                Scan a receipt
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Drop an image or PDF — Gemini will extract the details, then
                you can review and save.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={stage.kind === "parsing"}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div
          className={cn(
            "grid max-h-[calc(92vh-4.5rem)] overflow-y-auto",
            showingPreview ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""
          )}
        >
          {/* Preview / uploader */}
          <div className="border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40 md:border-b-0 md:border-r">
            {stage.kind === "idle" ? (
              <Dropzone
                dragOver={dragOver}
                setDragOver={setDragOver}
                onFiles={onFiles}
                inputRef={inputRef}
              />
            ) : (
              <div className="flex h-full flex-col gap-3">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-950">
                  {stage.file.type.startsWith("image/") ? (
                    // Blob URL preview — next/image would require a loader config for blobs,
                    // so we fall back to a native img for local previews.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={stage.previewUrl}
                      alt={stage.file.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      <span className="text-center">
                        PDF · {stage.file.name}
                        <br />
                        <span className="text-xs">
                          (preview not available)
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="truncate">
                    {stage.file.name} · {(stage.file.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    onClick={reset}
                    disabled={stage.kind === "parsing"}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Replace
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right-hand side: status / review form */}
          <div className="p-4">
            {stage.kind === "idle" ? (
              <UploadHints />
            ) : stage.kind === "parsing" ? (
              <ParsingState />
            ) : stage.kind === "error" ? (
              <ErrorState
                message={stage.message}
                onRetry={() => {
                  if (stage.file) void parse(stage.file);
                }}
                onReset={reset}
              />
            ) : (
              <DraftReviewForm
                draft={stage.draft}
                baseCurrency={baseCurrency}
                source="ocr"
                onSaved={() => {
                  onSaved();
                  reset();
                }}
                onCancel={reset}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Sub-components                              */
/* -------------------------------------------------------------------------- */

function Dropzone({
  dragOver,
  setDragOver,
  onFiles,
  inputRef,
}: {
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onFiles: (files: FileList | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <label
      htmlFor="receipt-file-input"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex h-full min-h-[18rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition",
        dragOver
          ? "border-brand-400 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-200"
          : "border-slate-300 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-brand-700 dark:hover:bg-brand-950/20"
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
        <UploadCloud className="h-6 w-6" />
      </span>
      <div>
        <p className="text-sm font-semibold">Drop a receipt here</p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          or click to choose a file · JPEG / PNG / WebP / HEIC / PDF · up to 8 MB
        </p>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            inputRef.current?.click();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          <UploadCloud className="h-3.5 w-3.5" />
          Upload
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            const camEl = document.getElementById(
              "receipt-camera-input"
            ) as HTMLInputElement | null;
            camEl?.click();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:hidden"
        >
          <Camera className="h-3.5 w-3.5" />
          Camera
        </button>
      </div>
      <input
        ref={inputRef}
        id="receipt-file-input"
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <input
        id="receipt-camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </label>
  );
}

function UploadHints() {
  const tips = [
    "Lay the receipt flat on a dark surface for best contrast.",
    "Make sure the grand total, date, and merchant name are sharp.",
    "We'll still accept blurry photos — you can fix anything we miss.",
  ];
  return (
    <div className="flex h-full flex-col gap-3">
      <h3 className="text-sm font-semibold">What happens next</h3>
      <ol className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
        <Step n={1} text="Upload an image — we don’t store anything yet." />
        <Step n={2} text="Gemini reads it and extracts the transaction." />
        <Step n={3} text="You review, tweak, and hit save. Done." />
      </ol>
      <div className="mt-auto rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <p className="font-medium text-slate-800 dark:text-slate-200">
          Tips for sharper extractions
        </p>
        <ul className="mt-1.5 ml-4 list-disc space-y-0.5">
          {tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ParsingState() {
  return (
    <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-3 text-center text-sm text-slate-600 dark:text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600 dark:text-brand-400" />
      <div>
        <p className="font-semibold text-slate-800 dark:text-slate-200">
          Reading your receipt…
        </p>
        <p className="mt-1 text-xs">
          Gemini is extracting the total, merchant, date, and line items.
        </p>
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
  onReset,
}: {
  message: string;
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
        <p className="font-semibold">Couldn’t read that receipt.</p>
        <p className="mt-1 text-xs opacity-80">{message}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Choose another file
        </button>
      </div>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
        {n}
      </span>
      <span>{text}</span>
    </li>
  );
}
