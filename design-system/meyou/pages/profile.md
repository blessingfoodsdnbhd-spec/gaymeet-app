# Profile Page Overrides

> **PROJECT:** Meyou
> **Generated:** 2026-07-20 18:53:34
> **Page Type:** Settings / Profile

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1200px (standard)
- **Layout:** Full-width sections, centered content
- **Sections:** 1. Hero with device mockup, 2. Screenshots carousel, 3. Features with icons, 4. Reviews/ratings, 5. Download CTAs

### Spacing Overrides

- No overrides — use Master spacing

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Dark/light matching app store feel. Star ratings in gold. Screenshots with device frames.

### Component Overrides

- Avoid: Default keyboard for all inputs
- Avoid: Desktop-first causing mobile issues
- Avoid: Default mobile tap handling

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Deep void + dark matter surfaces, Bitcoin orange/gold gradients for CTAs, pill buttons with glowing shadows, glassmorphic BlurView nav, monospace data rows, gradient text balances + masked orange-gold, pulsing status indicators and vertical ledger timelines, ultra-thin borders, high-precision typography
- Forms: Use inputmode attribute
- Responsive: Start with mobile styles then add breakpoints
- Touch: Use touch-action CSS or fastclick
- CTA Placement: Download buttons prominent (App Store + Play Store) throughout
