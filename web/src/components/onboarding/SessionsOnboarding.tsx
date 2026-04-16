import React from "react";
import { SplashScreen } from "@/src/components/ui/splash-screen";

export function SessionsOnboarding() {
  return (
    <SplashScreen
      title="You aren't using sessions yet"
      description="Sessions let you group traces that belong to the same workflow, or conversation."
    >
      <div className="mt-8">
        <h3 className="mb-4 text-2xl font-semibold">Start using sessions</h3>
        <p className="text-muted-foreground mb-4 text-sm">
          To start using sessions, you need to add a <code>sessionId</code> to
          your traces.
        </p>
        <p className="text-muted-foreground text-sm">
          Add <code>sessionId</code> in your instrumentation to group related
          traces.
        </p>
      </div>
    </SplashScreen>
  );
}
