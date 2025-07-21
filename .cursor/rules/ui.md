---
description: Global UI contract
globs: ["src/**/*.{tsx,ts}"]
alwaysApply: true
---

# Styling discipline
- Use Tailwind utilities + shadcn/ui components only.
- Never introduce `<style>` tags or external CSS.

# Layout & accessibility
- Desktop-first: optimize for ≥1280 px widths and progressive enhancement down to tablet.
- All interactive elements: must show a visible `:focus-visible` ring.
- Minimum interactive size: 32×32 px (desktop-friendly target).

# Component reuse
- Prefer `/src/components/ui/{Button,Card,Input}` before new markup.
