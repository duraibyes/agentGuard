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
  const [message, setMessage] = useState("Redirecting to your workspace...");

  const targetPath = useMemo(() => {
    const preferred = router.query.targetPath ?? router.query.callbackUrl;
    return getSafeRedirectPath(preferred);
  }, [router.query.callbackUrl, router.query.targetPath]);

  useEffect(() => {
    if (!router.isReady) return;

    // Redirect directly to target path without sign-in
    void router.replace(targetPath);
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
