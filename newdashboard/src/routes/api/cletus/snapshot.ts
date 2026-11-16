import { createFileRoute } from "@tanstack/react-router";
import { getSnapshotData } from "../../../lib/cletus/server";

// Server route: GET /api/cletus/snapshot
// Served only on the server — the `server.handlers` block is intercepted by
// TanStack Start before any component rendering, so this file needs no UI.
export const Route = createFileRoute("/api/cletus/snapshot")({
  server: {
    handlers: {
      GET: async () => {
        const snap = await getSnapshotData();
        return Response.json(snap);
      },
    },
  },
});
