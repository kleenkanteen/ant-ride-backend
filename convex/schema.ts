import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const gender = v.union(v.literal("Male"), v.literal("Female"));

export default defineSchema({
  rate_limits: defineTable({
    client_key: v.string(),
    request_count: v.number(),
    window_start_ms: v.number(),
  }).index("by_client_key", ["client_key"]),

  events: defineTable({
    name: v.string(),
    address: v.string(),
    date_time: v.string(),
    event_code: v.string(),
    edit_code: v.string(),
    carpool_geojson: v.optional(v.any()),
    jobs: v.optional(v.any()),
  })
    .index("by_event_code", ["event_code"])
    .index("by_event_code_edit_code", ["event_code", "edit_code"]),

  participants: defineTable({
    event_code: v.string(),
    edit_code: v.string(),
    name: v.string(),
    gender,
    address: v.string(),
    can_pickup: v.boolean(),
    seats_available: v.number(),
    phone_num: v.string(),
    confirmed: v.boolean(),
  })
    .index("by_event_code", ["event_code"])
    .index("by_event_code_edit_code", ["event_code", "edit_code"])
    .index("by_name_address", ["name", "address"])
    .index("by_event_code_confirmed_gender", ["event_code", "confirmed", "gender"]),
});
