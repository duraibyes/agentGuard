import { ExpandListButton } from "@/src/features/dashboard/components/cards/ChevronButton";
import { useState, type ReactNode } from "react";
import { NoDataOrLoading } from "@/src/components/NoDataOrLoading";

type TableHeaders = ReactNode[];
type TableRows = ReactNode[][];
type DashboardTableProps = {
  headers: TableHeaders;
  rows: TableRows;
  children?: ReactNode;
  collapse?: {
    collapsed: number;
    expanded: number;
  };
  noDataProps?: {
    description: string;
    href: string;
  };
  isLoading: boolean;
};

export const DashboardTable = ({
  headers,
  rows,
  children,
  collapse,
  noDataProps,
  isLoading,
}: DashboardTableProps) => {
  const [isExpanded, setExpanded] = useState(false);
  return (
    <>
      {children}
      {rows.length > 0 ? (
        <div className="mt-4">
          <div className="overflow-x-auto rounded-xl border border-[var(--dashboard-table-border)] bg-[var(--dashboard-table-bg)] shadow-sm">
            <div className="inline-block min-w-full align-middle">
              <table className="animate-in animate-out min-w-full table-fixed">
                <thead className="bg-[var(--dashboard-table-header-bg)]">
                  <tr>
                    {headers.map((header, i) => (
                      <th
                        key={i}
                        scope="col"
                        className="text-primary border-b border-[var(--dashboard-table-border)] px-4 py-3.5 text-left text-xs font-semibold whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="bg-[var(--dashboard-table-bg)]">
                  {rows
                    .slice(
                      0,
                      collapse
                        ? isExpanded
                          ? collapse.expanded
                          : collapse.collapsed
                        : undefined,
                    )
                    .map((row, i) => (
                      <tr
                        key={i}
                        className="transition-colors hover:bg-[var(--dashboard-table-hover-bg)] last:[&_td]:border-b-0"
                      >
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="text-muted-foreground border-b border-[var(--dashboard-table-border)] px-4 py-2 text-xs whitespace-nowrap"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
          {collapse ? (
            <ExpandListButton
              isExpanded={isExpanded}
              setExpanded={setExpanded}
              totalLength={rows.length}
              maxLength={collapse.collapsed}
              expandText={
                rows.length > collapse.expanded
                  ? `Show top ${collapse.expanded}`
                  : "Show all"
              }
            />
          ) : null}
        </div>
      ) : (
        <NoDataOrLoading isLoading={isLoading} {...noDataProps} />
      )}
    </>
  );
};
