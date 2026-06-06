"use client";

import { useRef, useState } from "react";

export default function UploadScreen({
  onFile,
  isUploading,
}: {
  onFile: (file: File) => void;
  isUploading: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-xl text-center">
        <h1 className="font-heading text-4xl tracking-tight text-text sm:text-5xl">
          Your family tree, in plain English
        </h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          Upload a GEDCOM (.ged) file and ask anything — births, deaths,
          marriages, and how everyone is related.
        </p>

        <div
          role="button"
          tabIndex={0}
          onClick={() => !isUploading && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !isUploading)
              inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mt-10 cursor-pointer rounded-xl border-2 border-dashed px-8 py-14 transition-colors ${
            dragOver
              ? "border-accent bg-surface"
              : "border-border bg-surface/70 hover:border-accent/60"
          } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
        >
          {isUploading ? (
            <p className="text-text">Parsing your tree…</p>
          ) : (
            <>
              <p className="text-text">
                <span className="text-accent">Click to browse</span> or drag a
                .ged file here
              </p>
              <p className="mt-2 text-sm text-muted">Up to 50MB</p>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".ged,.gedcom"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
