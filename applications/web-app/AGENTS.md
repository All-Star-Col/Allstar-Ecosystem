# Web App

## OVERVIEW
Primary frontend implementation: React 19 + TypeScript + Vite with shared UI primitives under `src/shared/ui`.

## STRUCTURE
```text
web-app/
├── README.md          # local setup
├── package.json       # dev/build/test/lint scripts
└── src/
    ├── apps/          # domain app surfaces: forms, products, data-viewer
    ├── system/        # login and dashboard shells
    ├── shared/        # reusable UI, hooks, components, utils, types
    ├── config/        # API/base config
    └── test/          # frontend tests
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Local setup | `README.md` | `VITE_API_SERVER` and dev startup |
| Scripts | `package.json` | `dev`, `build`, `test`, `lint`, `preview` |
| API configuration | `src/config/api.ts` | Base URL wiring |
| App-specific flows | `src/apps/` | `forms/`, `products/`, `data-viewer/` |
| Reusable primitives | `src/shared/ui/` | High-density UI layer; prefer reuse |
| Shell/auth flows | `src/system/` and `src/core/` | Dashboard/login and auth helpers |

## CONVENTIONS
- Run app tasks through `package.json` scripts.
- `lint` includes `check:forms-category-contract`; keep forms code compatible with that contract check.
- `VITE_API_SERVER` is the local API entry point; keep environment-specific setup in app-level env files.
- Prefer existing primitives in `src/shared/ui/` and `src/shared/components/` before adding new variants.
- Prefer semantic token classes (`bg-card`, `text-foreground`, `border-border`, `bg-primary`, etc.) over raw hex values or one-off gray palettes.
- If a feature needs a visual change already repeated elsewhere, extend the shared primitive or theme once instead of stacking long local overrides.
- When a wrapper exists in `src/shared/ui/`, use it instead of importing Radix primitives directly inside feature modules.
- `src/apps/forms/store.ts` caches forms metadata with validators/TTL behavior; changes there should preserve cache semantics intentionally.

## TYPOGRAPHY SYSTEM
All typography is defined as CSS variables in `src/shared/theme.css` and exposed to Tailwind via `@theme inline`.

### Font Family
| Token | Value | Usage |
|---|---|---|
| `--font-sans` | "Inter", system-ui | Body text, UI elements |
| `--font-display` | "Inter", system-ui | Headings, display text |
| `--font-mono` | JetBrains Mono, monospace | Code, loader text |

Use `font-sans`, `font-display`, `font-mono` Tailwind classes. Font family is consistent across light/dark modes.

### Font Size Scale
| Token | Value | Tailwind Class | Usage |
|---|---|---|---|
| `--text-2xs` | 0.625rem (10px) | `text-2xs` | Micro labels |
| `--text-xs` | 0.75rem (12px) | `text-xs` | Captions, hints |
| `--text-sm` | 0.875rem (14px) | `text-sm` | Secondary text |
| `--text-base` | 1rem (16px) | `text-base` | Body text |
| `--text-lg` | 1.125rem (18px) | `text-lg` | Lead text |
| `--text-xl` | 1.25rem (20px) | `text-xl` | Section headers |
| `--text-2xl` | 1.5rem (24px) | `text-2xl` | Page titles |
| `--text-3xl` | 1.875rem (30px) | `text-3xl` | Hero headings |
| `--text-4xl`–`--text-7xl` | 36px–72px | `text-4xl`–`text-7xl` | Display headings |

### Font Weight Scale
| Token | Value | Tailwind Class | Usage |
|---|---|---|---|
| `--font-weight-light` | 300 | `font-light` | Light display |
| `--font-weight-normal` | 400 | `font-normal` | Body text |
| `--font-weight-medium` | 500 | `font-medium` | Labels, buttons |
| `--font-weight-semibold` | 600 | `font-semibold` | Emphasized text |
| `--font-weight-bold` | 700 | `font-bold` | Strong emphasis |

### Line Height & Letter Spacing
| Category | Tokens | Tailwind Classes |
|---|---|---|
| Line height | `--leading-none` (1), `--leading-tight` (1.25), `--leading-normal` (1.5), `--leading-loose` (2) | `leading-none`, `leading-tight`, `leading-normal`, `leading-loose` |
| Letter spacing | `--tracking-tight` (-0.025em), `--tracking-normal` (0), `--tracking-wide` (0.025em) | `tracking-tight`, `tracking-normal`, `tracking-wide` |

Base HTML elements (h1–h4, label, button, input) have default weight and line-height via `@layer base` in theme.css. Tailwind utility classes override these defaults per-component.

## ANIMATION SYSTEM
All motion values are centralized in `src/shared/animations.ts`. Use these instead of inline numbers.

### Framer Motion Presets (from `animations.ts`)
| Preset | Usage | Values |
|---|---|---|
| `spring.modal` | Modal overlays, backdrop, card entrance | stiffness: 300, damping: 30 |
| `spring.widget` | Interactive widgets (AppTitle, hover transforms) | stiffness: 260, damping: 20 |
| `spring.celebratory` | Success confirmations, scale-in icons | stiffness: 200, damping: 15 |
| `spring.interactive` | Radio buttons, checkbox animations | stiffness: 300, damping: 20 |

### Duration Presets
| Preset | Value | Usage |
|---|---|---|
| `duration.micro` | 0.15s | Instant feedback (checkbox, toggle) |
| `duration.hover` | 0.2s | Hover state transitions |
| `duration.overlay` | 0.3s | Section transitions, progress bars |
| `duration.page` | 0.4s | Page-level entrances |
| `duration.hero` | 0.5s | Hero elements, full-page loaders |

### Easing Presets
| Preset | Values | Usage |
|---|---|---|
| `easing.standard` | [0.23, 1, 0.32, 1] | Page/container entrance (custom decelerate) |
| `easing.decelerate` | [0, 0, 0.2, 1] | Elements entering view |
| `easing.accelerate` | [0.4, 0, 1, 1] | Elements leaving view |

### Stagger Presets
| Preset | Value | Usage |
|---|---|---|
| `stagger.tight` | 0.05s | Rapid sequential (chip tabs, table rows) |
| `stagger.normal` | 0.1s | Standard sequential (header elements) |
| `stagger.loose` | 0.15s | Slower sequential (footer sections) |

Import: `import { spring, duration, easing, stagger } from "../../shared/animations";` (adjust path per file location).

### CSS Animations (tailwind.config.js)
| Class | Animation |
|---|---|
| `animate-loader-steps` | Shimmer loader (2s, 11 steps) |
| `animate-caret-blink` | Cursor blink (1s) |
| `animate-accordion-down` | Accordion open |
| `animate-accordion-up` | Accordion close |

Use `transition-colors`, `transition-all`, `transition-transform` from Tailwind for CSS-only hover effects (no Framer Motion needed for simple hover states).

## BUTTON SYSTEM
Use the shared `Button` component from `src/shared/ui/button`. Import: `import { Button } from "@/shared/ui/button";`

### Variants
| Variant | Usage |
|---|---|
| `primary` / `default` | Primary CTA, main actions |
| `destructive` | Delete, cancel order, danger actions |
| `accent` | Gold accent — summary/review steps |
| `outline` | Secondary actions, form actions |
| `ghost` | Minimal actions — close, dismiss, icon-only |
| `link` | Inline text links |

### Sizes
| Size | Height | Padding | Use |
|---|---|---|---|
| `xs` | h-7 | px-2 py-1 | Small chips, badges |
| `sm` | h-8 | px-3 py-1.5 | Compact, filter buttons |
| `md` | h-9 | px-4 py-2 | Default action |
| `lg` | h-10 | px-5 py-2.5 | Primary CTA, modal buttons |
| `xl` | h-11 | px-6 py-3 | Prominent actions |
| `2xl` | h-12 | px-7 py-3.5 | Hero CTAs |
| `icon` | 9×9 | — | Icon-only |
| `icon-sm` | 8×8 | — | Small icon-only |

**Auto-rounded:** `lg`, `xl` sizes automatically get `rounded-lg`. Smaller sizes get `rounded`.

### Special Props
- `loading={true}` — shows Lucide `Loader2` spinner, disables the button
- `disabled={true}` — disables + reduces opacity
- `className="w-full"` — full-width button
- `className="min-w-[220px] justify-center"` — wide centered button
- Lucide icons work automatically inside buttons

### Pattern Guide
| Scenario | Recommended Button |
|---|---|
| Primary modal action | `<Button variant="default" size="lg">` |
| Cancel / secondary | `<Button variant="outline" size="md">` |
| Close icon | `<Button variant="ghost" size="icon-sm"><X /></Button>` |
| Full-width form submit | `<Button variant="primary" size="lg" className="w-full">` |
| Destructive action | `<Button variant="destructive" size="lg">` |
| Gold summary action | `<Button variant="accent" size="lg">` |
| Inline text link | `<Button variant="link">` |

Do NOT use raw `<button>` elements in feature modules. If a button needs styling that the `Button` component cannot express, extend the component's CVA variants in `src/shared/ui/button.tsx` instead of adding inline styles.

## COLOR TOKEN SYSTEM
All colors are defined in `src/shared/theme.css`. Use semantic token classes instead of raw hex values.

### Base Tokens (Light Mode)
| Token | Hex Value | Usage |
|---|---|---|
| `--background` | `#f6f5f0` | Page background |
| `--foreground` | `#122337` | Primary text |
| `--card` | `#ffffff` | Card backgrounds |
| `--card-foreground` | `#122337` | Card text |
| `--popover` | `#ffffff` | Popover backgrounds |
| `--popover-foreground` | `#122337` | Popover text |
| `--primary` | `#122337` | Primary actions, buttons |
| `--primary-foreground` | `#f6f5f0` | Text on primary backgrounds |
| `--secondary` | `#2f3339` | Secondary actions |
| `--secondary-foreground` | `#f6f5f0` | Text on secondary backgrounds |
| `--muted` | `#e8e7e2` | Muted backgrounds |
| `--muted-foreground` | `#6b6e73` | Muted text |
| `--accent` | `#b69559` | Accent highlights |
| `--accent-foreground` | `#122337` | Text on accent backgrounds |
| `--warning` | `#b69559` | Warning states |
| `--warning-foreground` | `#122337` | Text on warning backgrounds |
| `--destructive` | `#c7664c` | Destructive actions, errors |
| `--destructive-foreground` | `#ffffff` | Text on destructive backgrounds |
| `--success` | `#059669` | Success states |
| `--success-foreground` | `#ffffff` | Text on success backgrounds |
| `--info` | `#2563eb` | Interactive links, focus rings, info states |
| `--info-foreground` | `#ffffff` | Text on info backgrounds |
| `--placeholder` | `#9ca3af` | Input placeholder text |
| `--border` | `rgba(18, 35, 55, 0.15)` | Borders |
| `--input` | `rgba(18, 35, 55, 0.2)` | Input borders |
| `--input-background` | `#ffffff` | Input backgrounds |
| `--switch-background` | `#d4d3cd` | Switch/toggle backgrounds |
| `--ring` | `#b69559` | Focus rings |

### Opacity Scales
Use `color-mix(in srgb, ...)` for opacity variants:
- `--color-primary-5` → `bg-primary-5` (5% opacity)
- `--color-primary-10` → `bg-primary-10` (10% opacity)
- `--color-primary-20` → `bg-primary-20` (20% opacity)
- `--color-primary-50` → `bg-primary-50` (50% opacity)
- `--color-destructive-5` → `bg-destructive-5` (5% opacity)
- `--color-destructive-10` → `bg-destructive-10` (10% opacity)
- `--color-destructive-20` → `bg-destructive-20` (20% opacity)
- `--color-info-5` → `bg-info-5` (5% opacity)
- `--color-info-10` → `bg-info-10` (10% opacity)
- `--color-info-20` → `bg-info-20` (20% opacity)

### Tailwind Utility Classes
| Class | Token | Example |
|---|---|---|
| `bg-primary` | `--primary` | `bg-primary` |
| `text-primary-foreground` | `--primary-foreground` | `text-primary-foreground` |
| `bg-info` | `--info` | `bg-info` |
| `text-info-foreground` | `--info-foreground` | `text-info-foreground` |
| `text-placeholder` | `--placeholder` | `text-placeholder` |
| `ring-info` | `--info` | `ring-info` |
| `border-info` | `--info` | `border-info` |

## ANTI-PATTERNS
- Do not duplicate primitives that already exist in `src/shared/ui/`.
- Do not introduce forms-category usage that fails the custom lint contract.
- Do not assume `mobile-app/` has matching implementation patterns; it is not a peer codebase yet.

## COMMANDS
```bash
npm install
npm run dev
npm run test
npm run lint
npm run build
```
