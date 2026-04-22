import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";

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
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const targetPath = useMemo(() => {
    const preferred = router.query.targetPath ?? router.query.callbackUrl;
    return getSafeRedirectPath(preferred);
  }, [router.query.callbackUrl, router.query.targetPath]);

  useEffect(() => {
    if (session.status === "authenticated") {
      void router.replace(targetPath);
    }
  }, [router, session.status, targetPath]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError(null);
    setSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: targetPath,
      redirect: false,
    });

    setSubmitting(false);

    if (result?.ok) {
      void router.replace(targetPath);
      return;
    }

    setError("Sign in failed. Please check your email/password.");
  };

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
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: "360px",
          display: "grid",
          gap: "0.75rem",
          padding: "1.25rem",
          borderRadius: "12px",
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--card))",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.25rem" }}>
          Sign in to Agent Guard
        </h1>
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          autoComplete="email"
          style={{
            padding: "0.625rem 0.75rem",
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--background))",
            color: "hsl(var(--foreground))",
          }}
        />
        <input
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          style={{
            padding: "0.625rem 0.75rem",
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--background))",
            color: "hsl(var(--foreground))",
          }}
        />
        <button
          type="submit"
          disabled={submitting || session.status === "loading"}
          style={{
            padding: "0.625rem 0.75rem",
            borderRadius: "8px",
            border: "none",
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            cursor: "pointer",
            opacity: submitting ? 0.85 : 1,
          }}
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
        {error ? (
          <p
            style={{
              margin: 0,
              color: "hsl(var(--destructive))",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </p>
        ) : null}
      </form>
    </main>
  );
}
