import { useUiCustomization } from "@/src/ee/features/ui-customization/useUiCustomization";
import { env } from "@/src/env.mjs";

export function useLangfuseEnvCode(keys?: {
  secretKey: string;
  publicKey: string;
}): string {
  const uiCustomization = useUiCustomization();
  const baseUrl = `${uiCustomization?.hostname ?? window.origin}${env.NEXT_PUBLIC_BASE_PATH ?? ""}`;

  if (keys) {
    return `AGENTGUARD_SECRET_KEY="${keys.secretKey}"
AGENTGUARD_PUBLIC_KEY="${keys.publicKey}"
AGENTGUARD_BASE_URL="${baseUrl}"`;
  }

  return `AGENTGUARD_SECRET_KEY="sk-lf-..."
AGENTGUARD_PUBLIC_KEY="pk-lf-..."
AGENTGUARD_BASE_URL="${baseUrl}"`;
}
