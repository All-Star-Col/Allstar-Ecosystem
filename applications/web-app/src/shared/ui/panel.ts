export const minimalPanelStyles = {
    surface:
        "border border-border/70 bg-card/95 text-foreground shadow-[0_24px_80px_rgba(18,35,55,0.10)] backdrop-blur-xl",
    header:
        "flex flex-col gap-1.5 border-b border-border/70 px-4 py-3 md:px-5 md:py-4",
    footer:
        "mt-auto flex flex-col gap-2 border-t border-border/70 px-4 py-3 md:px-5 md:py-4",
    body: "px-4 py-4 md:px-5 md:py-5",
    chip:
        "rounded-full border border-border/70 bg-background/80 text-foreground shadow-none",
    trigger:
        "rounded-full border border-border/70 bg-card/90 text-foreground shadow-sm hover:bg-primary/5 hover:text-foreground",
    overlay: "bg-black/20 backdrop-blur-[1px]",
    rail: "bg-border/70",
    subtleTitle: "text-sm font-semibold text-foreground",
    subtleDescription: "text-xs text-muted-foreground",
} as const;
