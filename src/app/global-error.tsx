"use client";

// Last-resort error page used when the root layout itself fails (for example
// when the database is not running). It has no dependencies on the app's code.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: '"Alexandria Variable", Alexandria, system-ui, sans-serif', textAlign: "center", padding: "20vh 1rem", color: "#352A2B", background: "#FAF6F8" }}>
        <h1 style={{ fontFamily: '"Alexandria Variable", Alexandria, system-ui, sans-serif', fontSize: "2rem" }}>We will be right back</h1>
        <p>The store is temporarily unavailable. Please try again in a moment.</p>
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: "1rem", padding: "0.75rem 1.5rem", borderRadius: "999px", border: 0, background: "#9B5275", color: "#fff", fontWeight: 700, cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
