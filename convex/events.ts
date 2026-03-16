import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createEvent = mutation({
  args: {
    name: v.string(),
    address: v.string(),
    date_time: v.string(),
    event_code: v.string(),
    edit_code: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("events", {
      name: args.name,
      address: args.address,
      date_time: args.date_time,
      event_code: args.event_code,
      edit_code: args.edit_code,
    });

    const created = await ctx.db.get(id);
    return created ? [created] : [];
  },
});

export const editEvent = mutation({
  args: {
    event_code: v.string(),
    edit_code: v.string(),
    name: v.string(),
    address: v.string(),
    date_time: v.string(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_code_edit_code", (q) =>
        q.eq("event_code", args.event_code).eq("edit_code", args.edit_code)
      )
      .first();

    if (!event) {
      return [];
    }

    await ctx.db.patch(event._id, {
      name: args.name,
      address: args.address,
      date_time: args.date_time,
    });

    const updated = await ctx.db.get(event._id);
    return updated ? [updated] : [];
  },
});

export const getEventsByCode = query({
  args: { event_code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_event_code", (q) => q.eq("event_code", args.event_code))
      .collect();
  },
});

export const getCarpoolDataByCode = query({
  args: { event_code: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_code", (q) => q.eq("event_code", args.event_code))
      .first();

    if (!event) {
      return null;
    }

    return {
      carpool_geojson: event.carpool_geojson,
      jobs: event.jobs,
    };
  },
});

export const setCarpoolArtifacts = mutation({
  args: {
    event_code: v.string(),
    carpool_geojson: v.any(),
    jobs: v.any(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_code", (q) => q.eq("event_code", args.event_code))
      .first();

    if (!event) {
      throw new Error("Event code is not valid");
    }

    await ctx.db.patch(event._id, {
      carpool_geojson: args.carpool_geojson,
      jobs: args.jobs,
    });
  },
});
