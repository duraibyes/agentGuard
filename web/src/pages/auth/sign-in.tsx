import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";

function getSafeRedirectPath(input: string | string[] | undefined): string {
  if (!input) return "/";

  const value = Array.isArray(input) ? input[0] : input;
  if (!value) return "/";

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/";
}

export default function SignInPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Redirecting to authentication...");

  const targetPath = useMemo(() => {
    const preferred = router.query.targetPath ?? router.query.callbackUrl;
    return getSafeRedirectPath(preferred);
  }, [router.query.callbackUrl, router.query.targetPath]);

  useEffect(() => {
    if (!router.isReady) return;

    void (async () => {
      const callbackUrl = targetPath;
      const hostname =
        typeof window !== "undefined" ? window.location.hostname : "";
      const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
      const shouldUseLocalBypass =
        process.env.NODE_ENV === "development" && isLocalhost;

      // Local bypass path: no sign-in UI, auto-bootstrap and sign in.
      if (shouldUseLocalBypass) {
        try {
          setMessage("Preparing local account...");
          const bootstrap = await fetch("/api/auth/local-bootstrap", {
            method: "POST",
          });

          if (!bootstrap.ok) {
            setMessage("Local bootstrap failed.");
            return;
          }

          setMessage("Signing you in...");
          const result = await signIn("credentials", {
            email: "admin@agentguard.local",
            password: "AgentGuard@1234",
            callbackUrl,
            redirect: false,
          });

          if (result?.ok) {
            void router.replace(callbackUrl);
            return;
          }

          setMessage("Auto sign-in failed.");
          return;
        } catch {
          setMessage("Auto sign-in failed.");
          return;
        }
      }

      const encodedCallback = encodeURIComponent(callbackUrl);
      void router.replace(`/api/auth/signin?callbackUrl=${encodedCallback}`);
    })();
  }, [router, router.isReady, targetPath]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
        padding: "1rem",
      }}
    >
      {message}
    </main>
  );
}
