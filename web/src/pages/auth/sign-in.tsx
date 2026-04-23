import { type FormEvent, useEffect, useMemo, useState } from "react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetPath = useMemo(() => {
    const preferred = router.query.targetPath ?? router.query.callbackUrl;
    return getSafeRedirectPath(preferred);
  }, [router.query.callbackUrl, router.query.targetPath]);

  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  useEffect(() => {
    if (!router.isReady) return;

    void (async () => {
      const callbackUrl = targetPath;
      const nextAuthUrl = process.env.NEXTAUTH_URL ?? "";
      const isLocalNextAuth =
        nextAuthUrl.includes("localhost") || nextAuthUrl.includes("127.0.0.1");
      const shouldUseLocalBypass =
        process.env.NODE_ENV === "development" &&
        isLocalhost &&
        isLocalNextAuth;

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
        } catch {
          setMessage("Auto sign-in failed.");
        }
      }
    })();
  }, [router, router.isReady, targetPath, isLocalhost]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: targetPath,
        redirect: false,
      });

      if (result?.ok) {
        void router.replace(result.url ?? targetPath);
        return;
      }

      setError("Invalid email or password.");
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLocalhost) {
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
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "360px",
          display: "grid",
          gap: "0.75rem",
        }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            padding: "0.65rem",
            borderRadius: "8px",
            border: "1px solid #ccc",
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            padding: "0.65rem",
            borderRadius: "8px",
            border: "1px solid #ccc",
          }}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: "0.65rem",
            borderRadius: "8px",
            border: "none",
            cursor: isSubmitting ? "default" : "pointer",
          }}
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
        {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
      </form>
    </main>
  );
}
