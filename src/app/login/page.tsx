"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const pseudonym = String(formData.get("pseudonym") ?? "");
    start(async () => {
      const res =
        mode === "login"
          ? await login({ email, password })
          : await register({ email, pseudonym, password });
      if (res.ok) {
        router.push("/complaints");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {mode === "login" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Official complaint case management and community voice.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface p-6 shadow-card">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-sm bg-sunken p-1 text-sm">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`rounded-xs py-1.5 font-medium transition-colors ${
                mode === m ? "bg-surface text-ink shadow-card" : "text-ink-muted"
              }`}
            >
              {m === "login" ? "Sign in" : "Register"}
            </button>
          ))}
        </div>

        <form action={submit} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <TextInput id="email" name="email" type="email" required autoComplete="email" />
          </Field>

          {mode === "register" && (
            <Field
              label="Public pseudonym"
              htmlFor="pseudonym"
              hint="Shown on AICTE Voice. Never linked to your identity publicly."
            >
              <TextInput id="pseudonym" name="pseudonym" required minLength={3} maxLength={30} />
            </Field>
          )}

          <Field label="Password" htmlFor="password">
            <TextInput
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </Field>

          {error && (
            <p className="rounded-sm bg-accent-weak px-3 py-2 text-sm text-accent" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>
      </div>

      <p className="mt-4 text-center text-xs text-ink-subtle">
        New accounts are community members. Officer access is granted by an
        administrator.
      </p>
    </div>
  );
}
