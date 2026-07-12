import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const snapshot = await ctx.runQuery(
      internal.ingestion.getHealthSnapshot,
      {}
    );
    return new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
