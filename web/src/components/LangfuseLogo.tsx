import { cn } from "@/src/utils/tailwind";
import Link from "next/link";
import { VersionLabel } from "./VersionLabel";
import { env } from "@/src/env.mjs";

export const LangfuseIcon = ({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/observe-logo.svg`}
    width={size}
    height={size}
    alt="Agent Guard Icon"
    className={className}
  />
);

const LangfuseLogotypeOrCustomized = ({ size }: { size: "sm" | "xl" }) => {
  return (
    <div className="flex items-center whitespace-nowrap">
      <LangfuseIcon
        size={size === "sm" ? 17 : 24}
        className="rounded-[6px] shadow-[0_0_0_1px_hsl(var(--border))]"
      />
      <span
        className={cn(
          "ml-2.5 leading-none font-extrabold tracking-tight group-data-[collapsible=icon]:hidden",
          size === "sm" ? "text-[1.02rem]" : "text-2xl",
        )}
      >
        <span className="text-[hsl(var(--foreground))]">
          Agent{" "}
        </span>
        <span className="text-[hsl(var(--primary))] drop-shadow-[0_1px_1px_rgba(124,58,237,0.2)]">
          Guard
        </span>
      </span>
    </div>
  );
};

export const LangfuseLogo = ({
  className,
  size = "sm",
  version = false,
}: {
  size?: "sm" | "xl";
  className?: string;
  version?: boolean;
}) => {
  return (
    <div
      className={cn(
        "ml-1 flex gap-3",
        className,
      )}
    >
      <div className="flex items-center">
        <Link href="/" className="flex items-center">
          <LangfuseLogotypeOrCustomized size={size} />
        </Link>
        {version && (
          <VersionLabel className="ml-2 group-data-[collapsible=icon]:hidden" />
        )}
      </div>
    </div>
  );
};
