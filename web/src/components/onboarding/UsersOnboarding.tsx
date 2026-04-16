import React from "react";
import { SplashScreen } from "@/src/components/ui/splash-screen";

export function UsersOnboarding() {
  return (
    <SplashScreen
      title="You aren't tracking users yet"
      description="Once you add a user ID to your traces, you can correlate costs, evaluations and other LLM Application metrics to better understand how they interact with your LLM applications."
    >
      <div className="mt-8">
        <h3 className="mb-4 text-2xl font-semibold">Start tracking users</h3>
        <p className="text-muted-foreground mb-4 text-sm">
          To start tracking users, you need to add a <code>userId</code> to your
          traces.
        </p>
        <p className="text-muted-foreground text-sm">
          Add <code>userId</code> in your instrumentation to start seeing user
          analytics.
        </p>
      </div>
    </SplashScreen>
  );
}
