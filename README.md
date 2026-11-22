# DealFinder - Style Preview ("Try On" v2 - Live Mirror)

A lightweight, zero-AI, accessible "Style Preview" modal component for the price-comparison app **DealFinder**.

## What's New in v2
- **Live Mirror Mode**: Mirrored local webcam feed with manual shoulder alignment.
- **WAI-ARIA Tabs**: "Body Twin" (SVG silhouette) and "Live Mirror" tabs with full keyboard arrow navigation.
- **Zero AI / Zero Tracking**: 100% client-side, zero pose estimation, zero server upload.
- **Snapshot Generator**: Local canvas draw export without pixel reading.
- **Vitest Unit Test Suite**: Comprehensive state machine coverage for `useCamera`.

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
