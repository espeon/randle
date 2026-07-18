import { useEffect, useState } from "react";
import { finishLogin } from "../state/session.ts";

export default function Callback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // OAuth returns state/code/iss in the URL *fragment* (#...), not the query.
    const source =
      window.location.hash.replace(/^#/, "") ||
      window.location.search.replace(/^\?/, "");
    const params = new URLSearchParams(source);

    finishLogin(params)
      .then(() => {
        window.location.href = "/";
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-destructive">Authentication error: {error}</p>
        <a href="/" className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline">
          Go back
        </a>
      </div>
    );
  }

  return <p className="py-16 text-center text-sm text-muted-foreground">Authenticating…</p>;
}
