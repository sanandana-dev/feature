# DealFinder - Style Preview ("Try On" v1)

A lightweight, zero-AI, accessible "Style Preview" modal component for the price-comparison app **DealFinder**.

## Product Idea
When a shopper taps "Try On" next to a shirt, t-shirt, or hoodie deal, they see the shirt on a simple body silhouette that matches their height, build, and skin tone. At the bottom is a strip of similar deals from other stores; tapping one swaps the shirt instantly. This is a STYLE preview, not a fit check.

## Constraints & Architecture
- **100% Zero AI**: No ML models, no AI APIs, no pose tracking, no background-removal libraries.
- **Zero Three.js / WebGL / Canvas**: Pure SVG silhouette + CSS `mix-blend-mode: multiply` on product images.
- **Pure React + TypeScript**: Built with React 18, TypeScript strict mode, functional components, hooks, and plain CSS.
- **Mobile-first & Accessible**: Responsive (360px+), touch & mouse Pointer Events (pan nudge + pinch zoom), focus trapping, Escape to close, and prefers-reduced-motion support.

## Getting Started

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Typecheck and build
npm run build
```

## Structure
- [`src/tryon/`](./src/tryon/): The core reusable "Style Preview" modal component, hooks, and styling.
- [`src/App.tsx`](./src/App.tsx): Showcase application with 5 mock deals (including model-photo fallback mode).
