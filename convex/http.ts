import { nanoid } from "nanoid";
import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

type JsonObject = Record<string, unknown>;
type Gender = "Male" | "Female";

function corsHeaders(request: Request): Record<string, string> {
  const requestedHeaders =
    request.headers.get("access-control-request-headers") ??
    "content-type,authorization,accept";
  const requestedMethod =
    request.headers.get("access-control-request-method") ??
    "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS";

  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": requestedMethod,
    "access-control-allow-headers": requestedHeaders,
    "access-control-allow-credentials": "false",
    "access-control-max-age": "86400",
    vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
  };
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function jsonResponse(request: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(request),
    },
  });
}

async function proxyTrailingSlashRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/")) {
    return null;
  }

  const canonicalPath = url.pathname.slice(0, -1);
  if (!["/event", "/participant", "/carpools"].includes(canonicalPath)) {
    return null;
  }

  url.pathname = canonicalPath;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  const body =
    request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS"
      ? undefined
      : await request.arrayBuffer();

  return fetch(url.toString(), {
    method: request.method,
    headers,
    body,
  });
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseJsonObject(request: Request): Promise<JsonObject> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch (_error) {
    throw new HttpError(400, "Invalid JSON body");
  }

  if (!isObject(payload)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  return payload;
}

function requiredString(
  payload: JsonObject,
  key: string,
  options: { min?: number; max?: number; exact?: number } = {}
): string {
  const value = payload[key];

  if (typeof value !== "string") {
    throw new HttpError(400, `${key} must be a string`);
  }

  if (options.exact !== undefined && value.length !== options.exact) {
    throw new HttpError(400, `${key} must be exactly ${options.exact} characters`);
  }

  if (options.min !== undefined && value.length < options.min) {
    throw new HttpError(400, `${key} must be at least ${options.min} characters`);
  }

  if (options.max !== undefined && value.length > options.max) {
    throw new HttpError(400, `${key} must be at most ${options.max} characters`);
  }

  return value;
}

function optionalString(
  payload: JsonObject,
  key: string,
  options: { max?: number } = {}
): string | undefined {
  const value = payload[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, `${key} must be a string`);
  }
  if (options.max !== undefined && value.length > options.max) {
    throw new HttpError(400, `${key} must be at most ${options.max} characters`);
  }
  return value;
}

function requiredBoolean(payload: JsonObject, key: string): boolean {
  const value = payload[key];
  if (typeof value !== "boolean") {
    throw new HttpError(400, `${key} must be a boolean`);
  }
  return value;
}

function optionalBoolean(payload: JsonObject, key: string): boolean | undefined {
  const value = payload[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new HttpError(400, `${key} must be a boolean`);
  }
  return value;
}

function requiredGender(payload: JsonObject, key: string): Gender {
  const value = payload[key];
  if (value !== "Male" && value !== "Female") {
    throw new HttpError(400, `${key} must be Male or Female`);
  }
  return value;
}

function optionalGender(payload: JsonObject, key: string): Gender | undefined {
  const value = payload[key];
  if (value === undefined) {
    return undefined;
  }
  if (value !== "Male" && value !== "Female") {
    throw new HttpError(400, `${key} must be Male or Female`);
  }
  return value;
}

function requiredIntegerInRange(
  payload: JsonObject,
  key: string,
  min: number,
  max: number
): number {
  const value = payload[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new HttpError(400, `${key} must be an integer`);
  }
  if (value < min || value > max) {
    throw new HttpError(400, `${key} must be between ${min} and ${max}`);
  }
  return value;
}

function optionalIntegerInRange(
  payload: JsonObject,
  key: string,
  min: number,
  max: number
): number | undefined {
  const value = payload[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new HttpError(400, `${key} must be an integer`);
  }
  if (value < min || value > max) {
    throw new HttpError(400, `${key} must be between ${min} and ${max}`);
  }
  return value;
}

http.route({
  path: "/event",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const payload = await parseJsonObject(request);
      const name = requiredString(payload, "name", { max: 50 });
      const address = requiredString(payload, "address", { max: 100 });
      const date_time = requiredString(payload, "date_time", { max: 50 });

      const event_code = nanoid(5);
      const edit_code = nanoid(5);

      const data = await ctx.runMutation(api.events.createEvent, {
        name,
        address,
        date_time,
        event_code,
        edit_code,
      });

      void ctx
        .runAction(api.carpoolActions.createCronJobs, {
          date_time,
          event_code,
        })
        .catch((error) => {
          console.error("Failed to create cron jobs", error);
        });

      return jsonResponse(request, 200, {
        status: "success",
        message: "Event created successfully!",
        data,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse(request, error.status, {
          status: "error",
          message: error.message,
        });
      }

      return jsonResponse(request, 500, {
        status: "error",
        message: `Unable to create event, error message: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }),
});

http.route({
  path: "/event",
  method: "PUT",
  handler: httpAction(async (ctx, request) => {
    try {
      const payload = await parseJsonObject(request);
      const event_code = requiredString(payload, "event_code", { exact: 5 });
      const edit_code = requiredString(payload, "edit_code", { exact: 5 });
      const name = requiredString(payload, "name", { max: 50 });
      const address = requiredString(payload, "address", { max: 100 });
      const date_time = requiredString(payload, "date_time", { max: 50 });

      const data = await ctx.runMutation(api.events.editEvent, {
        event_code,
        edit_code,
        name,
        address,
        date_time,
      });

      if (data.length === 0) {
        return jsonResponse(request, 404, {
          status: "error",
          message: "Event code or edit code is invalid",
        });
      }

      return jsonResponse(request, 200, {
        status: "success",
        message: "Event details edited!",
        data,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse(request, error.status, {
          status: "error",
          message: error.message,
        });
      }

      return jsonResponse(request, 500, {
        status: "error",
        message: `Unable to create event, full message: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }),
});

http.route({
  path: "/participant",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const payload = await parseJsonObject(request);
      const event_code = requiredString(payload, "event_code", { exact: 5 });
      const name = requiredString(payload, "name", { max: 50 });
      const gender = requiredGender(payload, "gender");
      const address = requiredString(payload, "address", { max: 100 });
      const can_pickup = requiredBoolean(payload, "can_pickup");
      const phone_num = requiredString(payload, "phone_num", { max: 10 });
      const seats_available = requiredIntegerInRange(payload, "seats_available", 0, 7);

      const eventData = await ctx.runQuery(api.events.getEventsByCode, { event_code });
      if (eventData.length === 0) {
        return jsonResponse(request, 404, {
          status: "error",
          message: "Event code is not valid",
        });
      }

      const existing = await ctx.runQuery(api.participants.findParticipantsByNameAddress, {
        name,
        address,
      });

      if (existing.length > 0) {
        return jsonResponse(request, 409, {
          status: "error",
          message:
            "You are already in the carpool, use your edit code! If you do not remember it, try again with a different name.",
        });
      }

      const data = await ctx.runMutation(api.participants.createParticipant, {
        event_code,
        edit_code: nanoid(5),
        name,
        gender,
        address,
        can_pickup,
        seats_available,
        phone_num,
      });

      return jsonResponse(request, 200, {
        status: "success",
        message: "Carpool joined successfully!",
        data,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse(request, error.status, {
          status: "error",
          message: error.message,
        });
      }

      return jsonResponse(request, 500, {
        status: "error",
        message: `Unable to join carpool, error message: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }),
});

http.route({
  path: "/participant",
  method: "PUT",
  handler: httpAction(async (ctx, request) => {
    try {
      const payload = await parseJsonObject(request);
      const event_code = requiredString(payload, "event_code", { exact: 5 });
      const edit_code = requiredString(payload, "edit_code", { exact: 5 });
      const remove = optionalBoolean(payload, "remove");

      if (remove) {
        const deletedCount = await ctx.runMutation(api.participants.removeParticipant, {
          event_code,
          edit_code,
        });

        if (deletedCount === 0) {
          return jsonResponse(request, 500, {
            status: "error",
            message: "Event code or edit code is invalid. Error message: ",
          });
        }

        return jsonResponse(request, 200, {
          status: "success",
          message: "Successfully removed you from the carpool!",
        });
      }

      const data = await ctx.runMutation(api.participants.editParticipant, {
        event_code,
        edit_code,
        name: optionalString(payload, "name", { max: 100 }),
        gender: optionalGender(payload, "gender"),
        address: optionalString(payload, "address", { max: 50 }),
        can_pickup: optionalBoolean(payload, "can_pickup"),
        seats_available: optionalIntegerInRange(payload, "seats_available", 0, 7),
        confirmed: optionalBoolean(payload, "confirmed"),
        phone_num: optionalString(payload, "phone_num", { max: 10 }),
      });

      if (data.length === 0) {
        return jsonResponse(request, 404, {
          status: "error",
          message: "Event code or edit code is invalid",
        });
      }

      return jsonResponse(request, 200, {
        status: "success",
        message: "Your details were edited!",
        data,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse(request, error.status, {
          status: "error",
          message: error.message,
        });
      }

      return jsonResponse(request, 500, {
        status: "error",
        message: `Unable to create carpool, full message: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }),
});

http.route({
  path: "/carpools",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const payload = await parseJsonObject(request);
      const event_code = requiredString(payload, "event_code", { exact: 5 });
      const password = requiredString(payload, "password", { max: 100 });
      const gender = requiredGender(payload, "gender");
      const confirmed = requiredBoolean(payload, "confirmed");

      if (password !== process.env.CARPOOL_PASSWORD) {
        return jsonResponse(request, 400, {
          status: "error",
          message: "Invalid password",
        });
      }

      const data = await ctx.runQuery(api.participants.getParticipantsByEventConfirmedGender, {
        event_code,
        confirmed,
        gender,
      });

      const riders = data.filter((participant: any) => !participant.can_pickup);
      const drivers = data.filter((participant: any) => participant.can_pickup);

      if (data.length <= 1 || drivers.length === 0) {
        return jsonResponse(request, 400, {
          status: "error",
          message: "Event has 0 participants or no drivers",
        });
      }

      const eventData = await ctx.runQuery(api.events.getEventsByCode, { event_code });
      if (eventData.length === 0) {
        return jsonResponse(request, 500, {
          status: "error",
          message: "Unable to retrieve event: Event code is not valid",
        });
      }

      if (!confirmed) {
        await ctx.runAction(api.carpoolActions.sendConfirmationMessages, {
          event_name: eventData[0].name,
          event_code,
          participants: data,
        });

        return jsonResponse(request, 200, {
          status: "success",
          message: "Confirmation SMS messages sent successfully",
        });
      }

      const actionResult = await ctx.runAction(api.carpoolActions.runConfirmedCarpoolFlow, {
        event_code,
        participants: data,
      });

      return jsonResponse(request, 200, {
        status: "success",
        message: "Carpool created successfully!",
        data: {
          google_map_route_links: actionResult.google_map_route_links,
        },
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse(request, error.status, {
          status: "error",
          message: error.message,
        });
      }

      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Could not generate carpool routes geojson file")) {
        return jsonResponse(request, 500, {
          status: "error",
          message: "Could not generate carpool routes geojson file",
        });
      }

      return jsonResponse(request, 500, {
        status: "error",
        message: `Unable to retrieve event participants: ${message}`,
      });
    }
  }),
});

http.route({
  path: "/carpools",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const event_code = new URL(request.url).searchParams.get("event-code") ?? "";

      const data = await ctx.runQuery(api.events.getCarpoolDataByCode, {
        event_code,
      });

      if (!data) {
        return jsonResponse(request, 404, {
          status: "error",
          message: "Event code is not valid",
        });
      }

      return jsonResponse(request, 200, {
        status: "success",
        message: "Carpool created successfully!",
        data,
      });
    } catch (error) {
      return jsonResponse(request, 500, {
        status: "error",
        message: `Unable to retrieve carpool: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }),
});

http.route({
  path: "/event",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST,PUT,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Digest, Authorization, Accept",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response(null, {
        headers: new Headers(corsHeaders(request)),
      });
    }
  }),
});

http.route({
  path: "/participant",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST,PUT,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Digest, Authorization, Accept",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response(null, {
        headers: new Headers(corsHeaders(request)),
      });
    }
  }),
});

http.route({
  path: "/carpools",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Digest, Authorization, Accept",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response(null, {
        headers: new Headers(corsHeaders(request)),
      });
    }
  }),
});

for (const method of ["GET", "POST", "PUT", "OPTIONS"] as const) {
  http.route({
    pathPrefix: "/",
    method,
    handler: httpAction(async (_ctx, request) => {
      try {
        const proxied = await proxyTrailingSlashRequest(request);
        if (proxied) {
          return proxied;
        }

        return jsonResponse(request, 404, {
          status: "error",
          message: "Route not found",
        });
      } catch (error) {
        return jsonResponse(request, 500, {
          status: "error",
          message: `Unable to process request: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }),
  });
}

export default http;
