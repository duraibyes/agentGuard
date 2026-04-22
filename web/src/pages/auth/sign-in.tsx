import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";

export default function SignInPage() {
  const router = useRouter();
  const session = useSession();
  const [autoLoginError, setAutoLoginError] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (session.status === "authenticated") {
      void router.replace("/");
      return;
    }

    if (session.status !== "unauthenticated") return;
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    let active = true;
    const email = "admin@agentguard.local";
    const password = "AgentGuard@1234";

    void (async () => {
      try {
        const bootstrapResponse = await fetch("/api/auth/local-bootstrap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!active) return;

        if (!bootstrapResponse.ok) {
          const payload = (await bootstrapResponse.json().catch(() => null)) as
            | { message?: string }
            | null;
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
          "Auto setup failed. Verify database access and local auth config.",
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [router, session.status]);

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
