# DealFinder - Style Preview ("Try On" v3 - Size Match)

A lightweight, zero-AI, accessible "Style Preview" modal component for the price-comparison app **DealFinder**.

## What's New in v3
- **Size Match Recommendation Engine**: Pure function `recommendSize(profile, chart)` calculating target chest with +4 cm comfort ease.
- **Shoulder Warning**: Flags sizes with shoulders > 2 cm narrower than user.
- **Collapsible Exact Measurements**: ProfileSetup includes optional chest (70–140 cm) and shoulder (30–60 cm) inputs with measurement instructions.
- **Interactive Size Chart Viewer**: Displays the store's chart and highlights the recommended size.
- **Vitest Unit Test Suite**: Comprehensive tests covering exact match, between sizes, smaller than all sizes, larger than all sizes, and missing data.

## Getting Started

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run dev server (requires HTTPS or localhost for webcam access)
npm run dev

# Typecheck and build
npm run build
```
