import { useEffect } from "react";
import { useRouter } from "next/router";

export default function SignUpPage() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/auth/sign-in");
  }, [router]);

  return null;
}