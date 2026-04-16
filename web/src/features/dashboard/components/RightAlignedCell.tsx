import { cn } from "@/src/utils/tailwind";
import { type ReactNode } from "react";

export const RightAlignedCell = ({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) => (
  <div className={cn("block w-full text-right tabular-nums", className)} title={title}>
    {children}
  </div>
);
