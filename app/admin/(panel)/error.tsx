"use client";

import { Btn } from "@/components/admin/ui";

// A failed admin screen (bad link, lost connection). The rest of the shell stays usable.
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8">
      <div className="max-w-lg rounded-lg border border-line bg-white p-6">
        <h1 className="text-xl font-semibold">This page couldn&rsquo;t load</h1>
        <p className="text-muted">The link may be wrong, or the connection dropped. Try again; if it keeps happening, tell the manager.</p>
        <Btn variant="primary" onClick={reset}>
          Try again
        </Btn>
      </div>
    </div>
  );
}
