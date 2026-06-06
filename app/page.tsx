"use client";

import { useState } from "react";
import UploadScreen from "@/components/upload-screen";
import SummaryScreen from "@/components/summary-screen";
import PeopleScreen from "@/components/people-screen";
import FamiliesScreen from "@/components/families-screen";
import ChatScreen from "@/components/chat-screen";
import { Family, Individual, TreeData, TreeSummary } from "@/lib/types";

type AppState =
  | "upload"
  | "summary"
  | "people"
  | "families"
  | "chat"
  | "error";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

export default function Home() {
  const [state, setState] = useState<AppState>("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [summary, setSummary] = useState<TreeSummary | null>(null);
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [initialQuestion, setInitialQuestion] = useState<string | null>(null);

  function reset() {
    setState("upload");
    setSummary(null);
    setTreeData(null);
    setInitialQuestion(null);
    setErrorMessage("");
    setIsUploading(false);
  }

  async function handleFile(file: File) {
    setErrorMessage("");

    // Client-side guard: reject oversized files before sending.
    if (file.size > MAX_FILE_BYTES) {
      setErrorMessage(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 50MB.`
      );
      setState("error");
      return;
    }

    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong parsing the file.");
        setState("error");
        return;
      }

      setSummary(data.summary as TreeSummary);
      setTreeData(data.treeData as TreeData);
      setState("summary");
    } catch {
      setErrorMessage("Could not reach the server. Please try again.");
      setState("error");
    } finally {
      setIsUploading(false);
    }
  }

  function ask(question: string) {
    setInitialQuestion(question);
    setState("chat");
  }

  function selectPerson(person: Individual) {
    ask(`Tell me about ${person.nameFull}.`);
  }

  function selectFamily(family: Family) {
    if (!treeData) return;
    const husb = family.husbandId
      ? treeData.individuals[family.husbandId]?.nameFull
      : null;
    const wife = family.wifeId
      ? treeData.individuals[family.wifeId]?.nameFull
      : null;
    const couple = [husb, wife].filter(Boolean).join(" and ");
    ask(
      couple
        ? `Tell me about the family of ${couple}.`
        : "Tell me about this family."
    );
  }

  return (
    <main className="min-h-screen">
      {state === "upload" && (
        <UploadScreen onFile={handleFile} isUploading={isUploading} />
      )}

      {state === "summary" && summary && (
        <SummaryScreen
          summary={summary}
          onAsk={ask}
          onOpenPeople={() => setState("people")}
          onOpenFamilies={() => setState("families")}
        />
      )}

      {state === "people" && treeData && (
        <PeopleScreen
          individuals={Object.values(treeData.individuals)}
          onBack={() => setState("summary")}
          onSelect={selectPerson}
        />
      )}

      {state === "families" && treeData && (
        <FamiliesScreen
          treeData={treeData}
          onBack={() => setState("summary")}
          onSelect={selectFamily}
        />
      )}

      {state === "chat" && treeData && (
        <ChatScreen
          treeData={treeData}
          initialQuestion={initialQuestion}
          onBack={() => {
            setInitialQuestion(null);
            setState("summary");
          }}
          onReset={reset}
        />
      )}

      {state === "error" && (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
          <h1 className="font-heading text-3xl text-text">Something went wrong</h1>
          <p className="max-w-md text-muted">{errorMessage}</p>
          <button
            onClick={reset}
            className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm text-text transition-colors hover:border-accent hover:text-accent"
          >
            Try another file
          </button>
        </div>
      )}
    </main>
  );
}
