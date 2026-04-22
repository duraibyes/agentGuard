import { useHasEntitlement } from "@/src/features/entitlements/hooks";
import { api } from "@/src/utils/api";
import { useSession } from "next-auth/react";

export const useUiCustomization = () => {
  const hasEntitlement = useHasEntitlement("self-host-ui-customization");
  const session = useSession();
  const customization = api.uiCustomization.get.useQuery(undefined, {
    enabled: hasEntitlement && session.status === "authenticated",
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (!hasEntitlement) return null;
  return customization.data ?? null;
};

export type UiCustomizationOption = keyof NonNullable<
  ReturnType<typeof useUiCustomization>
>;
