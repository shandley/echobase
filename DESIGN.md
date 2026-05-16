# EchoBase — Design System

## Color strategy: Restrained
Tinted neutrals with a single warm amber accent used at ≤10% of surface area.
All colors in OKLCH. Neutrals tinted toward hue 245 (blue-gray, cool/scientific).

## Palette
| Token | OKLCH | Role |
|---|---|---|
| bg-base | oklch(8.5% 0.008 250) | App background |
| bg-surface | oklch(11% 0.009 248) | Cards, table rows |
| bg-elevated | oklch(14% 0.01 246) | Hover states, raised elements |
| border | oklch(21% 0.012 245) | Primary borders |
| border-subtle | oklch(16% 0.01 247) | Row dividers |
| text-primary | oklch(93% 0.008 250) | Headings, data values |
| text-secondary | oklch(57% 0.016 248) | Labels, secondary info |
| text-tertiary | oklch(38% 0.01 250) | Placeholder, disabled |
| accent | oklch(72% 0.14 82) | Warm amber -- indicator light, not brand color |
| badge-chromosome | oklch(62% 0.12 148) | Sage green |
| badge-scaffold | oklch(68% 0.13 75) | Warm amber |
| badge-other | oklch(58% 0.10 28) | Muted terracotta |

## Typography
- Sans: Geist Sans (loaded) -- use for all UI text
- Mono: Geist Mono -- use for all data values (genome sizes, gene counts, accessions, tax IDs)
- Scientific names: italic, text-primary weight 400
- Data values: monospace, text-primary, weight 400
- Headers: weight 600, tighter tracking
- Labels: weight 500, text-secondary, smaller than body

## Elevation
No box shadows. Depth via border + background difference only.

## Badges / Assembly level
- Filled small rectangles (2px radius), not pills
- Chromosome: sage green bg + text
- Scaffold: amber bg + text  
- Contig: terracotta bg + text

## Nav
- Single thin bottom border only
- Logo: "EchoBase" in text-primary, weight 500, not uppercase, not accent-colored
- Height: 48px
- No dividers, no icons
