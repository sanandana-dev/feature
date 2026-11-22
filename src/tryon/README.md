# DealFinder "Style Preview" (Try On v1)

A lightweight, zero-AI, accessible "Style Preview" modal component for clothes shopping apps.

## Key Features
- **100% Zero AI & Zero WebGL**: No ML models, no canvas pixel reading, no heavy physics engines.
- **Pure React + TypeScript**: Built strictly with React 18, functional components, hooks, and standard CSS.
- **Fluid Silhouette & Multiply Blending**: Parametric SVG body silhouette scaled to the user's height, build, and skin tone. Product images overlay with `mix-blend-mode: multiply` to seamlessly eliminate white backgrounds.
- **Interactive Gestures**: Pointer Events for drag nudging and pinch zooming (or use the size slider and reset button).
- **Graceful Model Photo Fallback**: Deals marked `tryOnMode: "model"` clearly alert the shopper that Style Preview is disabled while still allowing price comparison.
- **Accessibility**: Full keyboard support (Escape closes modal, Tab/Shift-Tab focus trapping, aria labels, and `prefers-reduced-motion` compliance for the sway animation).

---

## Component Structure

```
src/tryon/
  types.ts             # Deal, Profile, FitType definitions & constants
  useProfile.ts        # Resilient localStorage hook with debounce
  ProfileSetup.tsx     # Height slider, segmented build control, 6 skin swatches
  PaperDoll.tsx        # Dynamic SVG silhouette + shirt overlay + drag/pinch controls
  DealStrip.tsx        # Smooth scroll-snap horizontal strip of alternative deals
  TryOnModal.tsx       # Focus-trapped dialog orchestrating all components
  tryon.css            # Mobile-first styles (360px+), CSS transforms & animations
  README.md            # Usage notes and integration guide
```

---

## Integration Guide

### 1. Basic Usage

Import `TryOnModal` and pass your deals list along with the selected deal ID:

```tsx
import React, { useState } from "react";
import { TryOnModal } from "./tryon/TryOnModal";
import { Deal } from "./tryon/types";

function ProductCatalog({ deals }: { deals: Deal[] }) {
  const [activeDealId, setActiveDealId] = useState<string | null>(null);

  return (
    <div>
      {deals.map((deal) => (
        <div key={deal.id}>
          <span>{deal.title}</span>
          <button onClick={() => setActiveDealId(deal.id)}>Try On</button>
        </div>
      ))}

      {activeDealId && (
        <TryOnModal
          deals={deals}
          activeDealId={activeDealId}
          onClose={() => setActiveDealId(null)}
        />
      )}
    </div>
  );
}
```

### 2. Passing Real Deals

Provide clean flat-lay or plain-background product photos where possible. If an item only has an on-model photo, mark `tryOnMode: "model"`:

```ts
const realDeals: Deal[] = [
  {
    id: "sku-101",
    title: "100% Supima Cotton Crewneck",
    price: 699,
    store: "AJIO",
    imageUrl: "https://images.example.com/products/sku-101-flat.jpg",
    buyUrl: "https://ajio.com/p/sku-101",
    tryOnMode: "flat", // renders on silhouette
  },
  {
    id: "sku-102",
    title: "Tailored Oversized Blazer",
    price: 3499,
    store: "Myntra",
    imageUrl: "https://images.example.com/products/sku-102-model.jpg",
    buyUrl: "https://myntra.com/p/sku-102",
    tryOnMode: "model", // shows fallback card + price comparison
  },
];
```

---

## Running with Vite

To run locally in development mode or build for production:

```bash
# Install dependencies
npm install

# Start Vite local development server
npm run dev

# Run TypeScript checks and production build
npm run build
```
