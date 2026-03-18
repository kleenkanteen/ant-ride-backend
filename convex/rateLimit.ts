import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const consumeRequest = mutation({
  args: {
    client_key: v.string(),
    now_ms: v.number(),
    limit: v.number(),
    window_ms: v.number(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("rate_limits")
      .withIndex("by_client_key", (q) => q.eq("client_key", args.client_key))
      .unique();

    if (!record) {
      await ctx.db.insert("rate_limits", {
        client_key: args.client_key,
        request_count: 1,
        window_start_ms: args.now_ms,
      });

      return {
        allowed: true,
        retry_after_seconds: 0,
      };
    }

    const window_ends_at = record.window_start_ms + args.window_ms;
    const window_expired = args.now_ms >= window_ends_at;

    if (window_expired) {
      await ctx.db.patch(record._id, {
        request_count: 1,
        window_start_ms: args.now_ms,
      });

      return {
        allowed: true,
        retry_after_seconds: 0,
      };
    }

    if (record.request_count >= args.limit) {
      const retry_after_ms = Math.max(0, window_ends_at - args.now_ms);

      return {
        allowed: false,
        retry_after_seconds: Math.max(1, Math.ceil(retry_after_ms / 1000)),
      };
    }

    await ctx.db.patch(record._id, {
      request_count: record.request_count + 1,
    });

    return {
      allowed: true,
      retry_after_seconds: 0,
    };
  },
});
