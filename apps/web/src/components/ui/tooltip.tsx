import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

/** A shadcn-style Tooltip wrapper around Base UI's tooltip primitives. */

function TooltipProvider({ children, ...props }: React.ComponentProps<typeof BaseTooltip.Provider>) {
  return <BaseTooltip.Provider {...props}>{children}</BaseTooltip.Provider>;
}

function Tooltip({ children, ...props }: React.ComponentProps<typeof BaseTooltip.Root>) {
  return <BaseTooltip.Root {...props}>{children}</BaseTooltip.Root>;
}

function TooltipTrigger({ children, ...props }: React.ComponentProps<typeof BaseTooltip.Trigger>) {
  return <BaseTooltip.Trigger {...props}>{children}</BaseTooltip.Trigger>;
}

function TooltipContent({ className, sideOffset = 6, children, ...props }: React.ComponentProps<typeof BaseTooltip.Positioner> & { sideOffset?: number }) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner sideOffset={sideOffset} {...props}>
        <BaseTooltip.Popup
          className={cn(
            "z-50 max-w-xs overflow-hidden rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1",
            className,
          )}
        >
          {children}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
