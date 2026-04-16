import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/src/utils/tailwind";
import { usePostHogClientCapture } from "@/src/features/posthog-analytics/usePostHogClientCapture";
import { Button } from "@/src/components/ui/button";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const capture = usePostHogClientCapture();

  if (compact) {
    const isLight = theme === "light";
    const nextTheme = isLight ? "dark" : "light";

    return (
      <Button
        variant="outline"
        size="icon"
        title={`Switch to ${nextTheme} mode`}
        className="h-9 w-9 rounded-md"
        onClick={(e) => {
          e.preventDefault();
          setTheme(nextTheme);
          capture("user_settings:theme_changed", {
            theme: nextTheme,
          });
        }}
      >
        {isLight ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <div className="flex items-center space-x-1">
      <span className="mr-2">Theme</span>
      <div title="Light mode">
        <Sun
          className={cn(
            theme === "light" ? "text-primary-accent" : "",
            "text:primary hover:bg-input hover:text-primary-accent h-[1.6rem] w-[1.6rem] rounded-sm p-1",
          )}
          onClick={(e) => {
            e.preventDefault();
            setTheme("light");
            capture("user_settings:theme_changed", {
              theme: "light",
            });
          }}
        />
      </div>
      <div title="Dark mode">
        <Moon
          className={cn(
            theme === "dark" ? "text-primary-accent" : "",
            "hover:bg-input hover:text-primary-accent h-[1.6rem] w-[1.6rem] rounded-sm p-1",
          )}
          onClick={(e) => {
            e.preventDefault();
            setTheme("dark");
            capture("user_settings:theme_changed", {
              theme: "dark",
            });
          }}
        />
      </div>
      <div title="System mode">
        <Monitor
          className={cn(
            theme === "system" ? "text-primary-accent" : "",
            "hover:bg-input hover:text-primary-accent h-[1.6rem] w-[1.6rem] rounded-sm p-1",
          )}
          onClick={(e) => {
            e.preventDefault();
            setTheme("system");
            capture("user_settings:theme_changed", {
              theme: "system",
            });
          }}
        />
      </div>
    </div>
  );
}
