"use client";

import { useEffect, useState } from "react";

type Origin =
  | { from: "unknown" }
  | { from: "server" }
  | { from: "bucket"; vector: string; location: string };

const STATIC_ROUTE = "/_next/static/";

// Shows where the browser got this page's static files from. A serving
// handler in front of object storage names the vector and the storage
// location in response headers. The Next.js server sends neither.
//
// This is for looking at a deployment. The app works without it and never
// uses the answer to build a URL.
export function StaticOrigin({ serverVector }: { serverVector: string }) {
  const [origin, setOrigin] = useState<Origin>({ from: "unknown" });

  useEffect(() => {
    const script = document.querySelector<HTMLScriptElement>(`script[src*="${STATIC_ROUTE}"]`);
    if (!script) return;
    const asset = new URL(script.src);
    fetch(asset, { method: "HEAD", cache: "no-store" })
      .then((response) => {
        const vector = response.headers.get("x-konfidence-vector");
        const object = response.headers.get("x-konfidence-static-origin");
        if (!vector || !object) return setOrigin({ from: "server" });
        // Cut the file off the object URL to get the directory of the bundle.
        const file = asset.pathname.slice(
          asset.pathname.indexOf(STATIC_ROUTE) + STATIC_ROUTE.length,
        );
        const location = object.endsWith(file) ? object.slice(0, -file.length) : object;
        setOrigin({ from: "bucket", vector, location });
      })
      .catch(() => setOrigin({ from: "server" }));
  }, []);

  if (origin.from === "unknown") return <span className="muted">checking</span>;
  if (origin.from === "server") return <span className="muted">served by the Next.js server</span>;
  return (
    <>
      <code>{origin.location}</code>{" "}
      <span className={origin.vector === serverVector ? "flag on" : "flag"}>
        {origin.vector === serverVector ? "same vector as the server" : `vector ${origin.vector}`}
      </span>
    </>
  );
}
