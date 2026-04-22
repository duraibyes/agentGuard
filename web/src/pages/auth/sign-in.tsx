import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";

const SESSION_LOADING_TIMEOUT_MS = 8000;
const BOOTSTRAP_REQUEST_TIMEOUT_MS = 12000;

export default function SignInPage() {
  const router = useRouter();
  const session = useSession();
  const [autoLoginError, setAutoLoginError] = useState<string | null>(null);
  const [sessionLoadingTimedOut, setSessionLoadingTimedOut] = useState(false);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (session.status !== "loading") {
      setSessionLoadingTimedOut(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setSessionLoadingTimedOut(true);
    }, SESSION_LOADING_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [session.status]);

  useEffect(() => {
    if (session.status === "authenticated") {
      void router.replace("/");
      return;
    }

    const shouldAttemptAutoLogin =
      session.status === "unauthenticated" ||
      (session.status === "loading" && sessionLoadingTimedOut);

    if (!shouldAttemptAutoLogin) return;
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    let active = true;
    const email = "admin@agentguard.local";
    const password = "AgentGuard@1234";
    const bootstrapAbortController = new AbortController();
    const bootstrapAbortTimeout = window.setTimeout(() => {
      bootstrapAbortController.abort();
    }, BOOTSTRAP_REQUEST_TIMEOUT_MS);

    void (async () => {
      try {
        const bootstrapResponse = await fetch("/api/auth/local-bootstrap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: bootstrapAbortController.signal,
        });

        if (!active) return;
        window.clearTimeout(bootstrapAbortTimeout);

        if (!bootstrapResponse.ok) {
          const payload = (await bootstrapResponse
            .json()
            .catch(() => null)) as { message?: string } | null;
          setAutoLoginError(
            payload?.message ??
              "Auto setup failed. Verify database access and local auth config.",
          );
          return;
        }

        const result = await signIn("credentials", {
          email,
          password,
          callbackUrl: "/",
          redirect: false,
        });

        if (!active) return;

        if (result?.ok) {
          void router.replace("/");
          return;
        }

        setAutoLoginError(
          "Auto login failed. Verify the local bootstrap user password.",
        );
      } catch {
        if (!active) return;
        setAutoLoginError(
          "Auto setup timed out. Verify database/network access and try refreshing.",
        );
      } finally {
        window.clearTimeout(bootstrapAbortTimeout);
      }
    })();

    return () => {
      active = false;
      bootstrapAbortController.abort();
      window.clearTimeout(bootstrapAbortTimeout);
    };
  }, [router, session.status, sessionLoadingTimedOut]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
        fontFamily: "Inter, sans-serif",
        fontSize: "16px",
      }}
    >
      {autoLoginError ?? "Redirecting to Agent Guard..."}
    </div>
  );
}
