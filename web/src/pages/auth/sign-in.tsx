import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";

export default function SignInPage() {
  const router = useRouter();
  const session = useSession();
  const [autoLoginError, setAutoLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (session.status === "authenticated") {
      void router.replace("/");
      return;
    }

    if (session.status !== "unauthenticated") return;

    let active = true;
    void signIn("credentials", {
      email: "demo@langfuse.com",
      password: "password",
      callbackUrl: "/",
      redirect: false,
    }).then((result) => {
      if (!active) return;
      if (result?.ok) {
        void router.replace("/");
        return;
      }
      setAutoLoginError("Auto login failed. Verify seeded local user.");
    });

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
