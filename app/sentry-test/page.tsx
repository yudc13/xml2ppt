"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function SentryTestPage() {
  const [status, setStatus] = useState<string>("Ready");

  const triggerFrontendError = () => {
    setStatus("Triggering frontend error...");

    setTimeout(() => {
      throw new Error(`Sentry frontend test error at ${new Date().toISOString()}`);
    }, 0);
  };

  const triggerBackendError = async () => {
    setStatus("Calling backend test endpoint...");

    try {
      const response = await fetch("/api/sentry-test", { method: "GET", cache: "no-store" });
      if (!response.ok) {
        setStatus(
          `Backend responded with ${response.status}. Check Sentry for server-side event.`
        );
        return;
      }
      setStatus("Unexpected: backend endpoint returned 2xx.");
    } catch (error) {
      setStatus(`Backend request failed in browser: ${String(error)}`);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Sentry Test Page</h1>
        <p className="text-muted-foreground text-sm">
          Use this page to trigger a frontend exception and a backend exception.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="destructive" onClick={triggerFrontendError}>
          Trigger Frontend Error
        </Button>
        <Button variant="outline" onClick={triggerBackendError}>
          Trigger Backend Error
        </Button>
      </div>

      <div className="bg-muted rounded-md p-4 text-sm">
        <p className="font-medium">Status</p>
        <p className="text-muted-foreground mt-1 break-all">{status}</p>
      </div>
    </main>
  );
}
