import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const gender = v.union(v.literal("Male"), v.literal("Female"));

export const getParticipantsByEventCode = query({
  args: { event_code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("participants")
      .withIndex("by_event_code", (q) => q.eq("event_code", args.event_code))
      .collect();
  },
});

export const getParticipantsByEventConfirmedGender = query({
  args: {
    event_code: v.string(),
    confirmed: v.boolean(),
    gender,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("participants")
      .withIndex("by_event_code_confirmed_gender", (q) =>
        q
          .eq("event_code", args.event_code)
          .eq("confirmed", args.confirmed)
          .eq("gender", args.gender)
      )
      .collect();
  },
});

export const findParticipantsByNameAddress = query({
  args: {
    name: v.string(),
    address: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("participants")
      .withIndex("by_name_address", (q) =>
        q.eq("name", args.name).eq("address", args.address)
      )
      .collect();
  },
});

export const createParticipant = mutation({
  args: {
    event_code: v.string(),
    edit_code: v.string(),
    name: v.string(),
    gender,
    address: v.string(),
    can_pickup: v.boolean(),
    seats_available: v.number(),
    phone_num: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("participants", {
      event_code: args.event_code,
      edit_code: args.edit_code,
      name: args.name,
      gender: args.gender,
      address: args.address,
      can_pickup: args.can_pickup,
      seats_available: args.seats_available,
      phone_num: args.phone_num,
      confirmed: false,
    });

    const created = await ctx.db.get(id);
    return created ? [created] : [];
  },
});

export const editParticipant = mutation({
  args: {
    event_code: v.string(),
    edit_code: v.string(),
    name: v.optional(v.string()),
    gender: v.optional(gender),
    address: v.optional(v.string()),
    can_pickup: v.optional(v.boolean()),
    seats_available: v.optional(v.number()),
    phone_num: v.optional(v.string()),
    confirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_event_code_edit_code", (q) =>
        q.eq("event_code", args.event_code).eq("edit_code", args.edit_code)
      )
      .first();

    if (!participant) {
      return [];
    }

    const patch: Record<string, unknown> = {};

    if (args.name !== undefined) patch.name = args.name;
    if (args.gender !== undefined) patch.gender = args.gender;
    if (args.address !== undefined) patch.address = args.address;
    if (args.can_pickup !== undefined) patch.can_pickup = args.can_pickup;
    if (args.seats_available !== undefined) patch.seats_available = args.seats_available;
    if (args.phone_num !== undefined) patch.phone_num = args.phone_num;
    if (args.confirmed !== undefined) patch.confirmed = args.confirmed;

    await ctx.db.patch(participant._id, patch);

    const updated = await ctx.db.get(participant._id);
    return updated ? [updated] : [];
  },
});

export const removeParticipant = mutation({
  args: {
    event_code: v.string(),
    edit_code: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_event_code_edit_code", (q) =>
        q.eq("event_code", args.event_code).eq("edit_code", args.edit_code)
      )
      .first();

    if (!participant) {
      return 0;
    }

    await ctx.db.delete(participant._id);
    return 1;
  },
});
