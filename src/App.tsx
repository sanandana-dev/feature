import React, { useState } from "react";
import { Deal } from "./tryon/types";
import { TryOnModal } from "./tryon/TryOnModal";

const MOCK_DEALS: Deal[] = [
  {
    id: "deal-1",
    title: "Classic Heavyweight Cotton Crewneck Tee",
    price: 499,
    store: "Amazon",
    imageUrl: "https://placehold.co/400x400/ffffff/1e293b.png?text=Classic+Tee",
    buyUrl: "https://amazon.in",
    tryOnMode: "flat",
  },
  {
    id: "deal-2",
    title: "Streetwear Oversized Fleece Hoodie",
    price: 1299,
    store: "Flipkart",
    imageUrl: "https://placehold.co/400x400/ffffff/b91c1c.png?text=Fleece+Hoodie",
    buyUrl: "https://flipkart.com",
    tryOnMode: "flat",
  },
  {
    id: "deal-3",
    title: "Relaxed Fit Vintage Wash Poplin Shirt",
    price: 899,
    store: "AJIO",
    imageUrl: "https://placehold.co/400x400/ffffff/047857.png?text=Vintage+Shirt",
    buyUrl: "https://ajio.com",
    tryOnMode: "flat",
  },
  {
    id: "deal-4",
    title: "Editorial Autumn Trench Coat On-Model",
    price: 2499,
    store: "Myntra",
    imageUrl: "https://placehold.co/400x400/e2e8f0/1e293b.png?text=Model+Editorial+1",
    buyUrl: "https://myntra.com",
    tryOnMode: "model",
  },
  {
    id: "deal-5",
    title: "Studio Shot Athleisure Pullover On-Model",
    price: 1599,
    store: "Amazon",
    imageUrl: "https://placehold.co/400x400/e2e8f0/1e293b.png?text=Model+Editorial+2",
    buyUrl: "https://amazon.in",
    tryOnMode: "model",
  },
];

export const App: React.FC = () => {
  const [activeDealId, setActiveDealId] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header style={{ marginBottom: "1.5rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.75rem", margin: 0, color: "#0f172a" }}>DealFinder</h1>
        <p style={{ color: "#64748b", margin: "0.25rem 0 0" }}>
          Compare top clothing deals across stores with quick <strong>Style Preview</strong>.
        </p>
      </header>

      <main>
        <h2 style={{ fontSize: "1.2rem", color: "#334155", marginBottom: "1rem" }}>Trending Deals</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem" }}>
          {MOCK_DEALS.map((deal) => (
            <article
              key={deal.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "0.85rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                backgroundColor: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", borderRadius: "8px" }}>
                <img
                  src={deal.imageUrl}
                  alt={deal.title}
                  style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                  loading="lazy"
                />
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#64748b" }}>
                    {deal.store}
                  </span>
                  <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#2563eb" }}>
                    ₹{deal.price.toLocaleString("en-IN")}
                  </span>
                </div>
                <h3 style={{ fontSize: "0.95rem", margin: "0.2rem 0", color: "#0f172a", lineHeight: 1.3 }}>
                  {deal.title}
                </h3>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto" }}>
                <button
                  type="button"
                  onClick={() => setActiveDealId(deal.id)}
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                  aria-label={`Try On ${deal.title}`}
                >
                  Try On
                </button>
                <a
                  href={deal.buyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "0.5rem 0.75rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    color: "#334155",
                    textDecoration: "none",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  Buy
                </a>
              </div>
            </article>
          ))}
        </div>
      </main>

      {/* Try On Modal */}
      {activeDealId && (
        <TryOnModal
          deals={MOCK_DEALS}
          activeDealId={activeDealId}
          onClose={() => setActiveDealId(null)}
        />
      )}
    </div>
  );
};

export default App;
