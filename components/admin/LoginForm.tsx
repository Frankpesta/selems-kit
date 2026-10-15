"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Btn, Checkbox, FormField, Input } from "./ui";

// Staff sign-in (docs/06): sign in, invited sign-up (confirmed with an emailed
// code), and password reset by emailed code.

type Step = "signIn" | "signUp" | "verify" | "forgot" | "reset";

const KEEP_COOKIE = "selems_keep";

function setKeep(keep: boolean) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = keep
    ? `${KEEP_COOKIE}=1; path=/; max-age=${30 * 86400}; samesite=lax${secure}`
    : `${KEEP_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
}

/** Convex Auth's errors are terse; turn them into something a person can act on. */
function friendly(e: unknown, step: Step): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invited/i.test(msg)) return "This email hasn't been invited. Ask the hotel admin.";
  if (/too common|at least \d+ characters/i.test(msg)) return msg.match(/(That password is too common\. Choose another\.|Use at least \d+ characters\.)/)?.[0] ?? msg;
  if (/already exists/i.test(msg)) return "This email already has an account. Sign in instead, or reset your password.";
  if (/rate|too many/i.test(msg)) return "Too many attempts. Wait a few minutes and try again.";
  if (step === "verify" || step === "reset") return "That code is wrong or has expired. Check the latest email, or request a new code.";
  if (step === "signIn") return "Email or password is wrong.";
  return "Something went wrong. Try again.";
}

export function LoginForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const params = useSearchParams();
  const initial: Step = params.get("mode") === "signup" ? "signUp" : params.get("mode") === "reset" ? "forgot" : "signIn";
  const [step, setStep] = useState<Step>(initial);
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [keep, setKeepState] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const next = params.get("next");
  const destination = next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";

  function finish() {
    router.replace(destination);
    router.refresh();
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      if (step === "signIn") {
        setKeep(keep);
        const r = await signIn("password", { email, password: String(form.get("password")), flow: "signIn" });
        if (r.signingIn) return finish();
        setStep("verify");
        setNotice(`We've emailed a code to ${email}. Enter it to finish signing in.`);
      } else if (step === "signUp") {
        const password = String(form.get("password"));
        if (password !== String(form.get("confirm"))) {
          setError("The two passwords don't match.");
          return;
        }
        setKeep(keep);
        const r = await signIn("password", { email, password, name: String(form.get("name") ?? ""), flow: "signUp" });
        if (r.signingIn) return finish();
        setStep("verify");
        setNotice(`We've emailed an 8-digit code to ${email}. It works for 15 minutes.`);
      } else if (step === "verify") {
        const r = await signIn("password", { email, code: String(form.get("code")).replace(/\s/g, ""), flow: "email-verification" });
        if (r.signingIn) return finish();
      } else if (step === "forgot") {
        await signIn("password", { email, flow: "reset" });
        setStep("reset");
        setNotice(`If ${email} has a staff account, we've emailed it a code.`);
      } else if (step === "reset") {
        const newPassword = String(form.get("newPassword"));
        if (newPassword !== String(form.get("confirm"))) {
          setError("The two passwords don't match.");
          return;
        }
        setKeep(keep);
        const r = await signIn("password", { email, code: String(form.get("code")).replace(/\s/g, ""), newPassword, flow: "reset-verification" });
        if (r.signingIn) return finish();
      }
    } catch (err) {
      // "forgot" never reveals whether an account exists.
      if (step === "forgot") {
        setStep("reset");
        setNotice(`If ${email} has a staff account, we've emailed it a code.`);
      } else setError(friendly(err, step));
    } finally {
      setPending(false);
    }
  }

  const heading = {
    signIn: "Staff sign-in",
    signUp: "Create your staff account",
    verify: "Check your email",
    forgot: "Reset your password",
    reset: "Choose a new password",
  }[step];

  return (
    <form onSubmit={submit} className="flex w-full max-w-[400px] flex-col gap-[18px]" aria-labelledby="login-h" noValidate>
      <h1 id="login-h" className="m-0 text-[28px] font-semibold">
        {heading}
      </h1>
      <p className="m-0 text-muted">
        {step === "signUp"
          ? "Use the email address your invitation was sent to."
          : step === "verify" || step === "reset"
            ? (notice ?? "Enter the code we emailed you.")
            : "For Selems front office and management only."}
      </p>

      {step !== "verify" && step !== "reset" ? (
        <FormField label={step === "signIn" ? "Work email" : "Email"}>
          {(p) => (
            <Input {...p} type="email" name="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </FormField>
      ) : null}

      {step === "signUp" ? (
        <FormField label="Your name">{(p) => <Input {...p} name="name" autoComplete="name" required />}</FormField>
      ) : null}

      {step === "signIn" ? (
        <FormField label="Password">
          {(p) => <Input {...p} type="password" name="password" autoComplete="current-password" required />}
        </FormField>
      ) : null}

      {step === "signUp" ? (
        <>
          <FormField label="Password" hint="At least 10 characters. A short sentence works well.">
            {(p) => <Input {...p} type="password" name="password" autoComplete="new-password" required minLength={10} />}
          </FormField>
          <FormField label="Type it again">{(p) => <Input {...p} type="password" name="confirm" autoComplete="new-password" required />}</FormField>
        </>
      ) : null}

      {step === "verify" || step === "reset" ? (
        <FormField label="8-digit code">
          {(p) => <Input {...p} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" required autoFocus />}
        </FormField>
      ) : null}

      {step === "reset" ? (
        <>
          <FormField label="New password" hint="At least 10 characters.">
            {(p) => <Input {...p} type="password" name="newPassword" autoComplete="new-password" required minLength={10} />}
          </FormField>
          <FormField label="Type it again">{(p) => <Input {...p} type="password" name="confirm" autoComplete="new-password" required />}</FormField>
        </>
      ) : null}

      {step === "signIn" || step === "signUp" || step === "reset" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Checkbox label="Keep me signed in on this device" checked={keep} onChange={(e) => setKeepState(e.target.checked)} />
          {step === "signIn" ? (
            <button type="button" className="min-h-11 font-semibold text-amber underline-offset-4 hover:underline" onClick={() => { setStep("forgot"); setError(null); }}>
              Forgot password?
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="m-0 rounded-md bg-bad-bg px-3 py-2.5 text-sm font-medium text-bad">
          {error}
        </p>
      ) : null}

      <Btn type="submit" variant="primary" disabled={pending} className="min-h-12 text-[15px]">
        {pending
          ? "Please wait…"
          : { signIn: "Sign in", signUp: "Create account", verify: "Confirm", forgot: "Email me a code", reset: "Save new password" }[step]}
      </Btn>

      <p className="m-0 text-sm text-muted">
        {step === "signIn" ? (
          <>Accounts are created by the hotel manager. Roles: Admin, Staff.</>
        ) : (
          <button type="button" className="min-h-11 font-semibold text-amber underline-offset-4 hover:underline" onClick={() => { setStep("signIn"); setError(null); setNotice(null); }}>
            Back to sign in
          </button>
        )}
      </p>
      {step === "signIn" ? (
        <p className="m-0 text-sm text-muted">
          Invited? <Link href="/admin/login?mode=signup">Create your account</Link>
        </p>
      ) : null}
    </form>
  );
}
