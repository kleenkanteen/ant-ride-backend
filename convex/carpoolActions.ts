"use node";

import { v } from "convex/values";
import twilio from "twilio";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getCronSchedule(date: Date): string {
  const minutes = String(date.getUTCMinutes());
  const hours = String(date.getUTCHours());
  const dayOfMonth = String(date.getUTCDate());
  const month = String(date.getUTCMonth() + 1);

  return `${minutes} ${hours} ${dayOfMonth} ${month} *`;
}

function formatDateToCronExpiresAt(date: Date): number {
  const pad = (num: number): string => num.toString().padStart(2, "0");

  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());

  return Number(`${year}${month}${day}${hours}${minutes}${seconds}`);
}

function resolvePhoneNumber(to: string): string {
  const mode = requireEnv("MODE");
  if (mode === "DEV") {
    return requireEnv("PERSONAL_NUMBER");
  }
  return `+1${to}`;
}

async function sendSms(message: string, to: string): Promise<void> {
  const accountSid = requireEnv("TWILIO_ACCOUNT_SID");
  const authToken = requireEnv("TWILIO_AUTH_TOKEN");
  const twilioNumber = requireEnv("TWILIO_NUMBER");

  const client = twilio(accountSid, authToken);

  await client.messages.create({
    to: resolvePhoneNumber(to),
    from: twilioNumber,
    body: message,
  });
}

async function sendConfirmationSms(
  eventName: string,
  eventCode: string,
  editCode: string,
  number: string
): Promise<void> {
  await sendSms(
    `Hello from ant ride.\n\nTo confirm your participation in a carpool in the event titled "${eventName}",please open this page to indicate your intent: https://antride.ca/confirm?event_code=${eventCode}&edit_code=${editCode}`,
    number
  );
}

async function sendCarpoolsSms(
  unassignedDrivers: Record<string, any>,
  unassignedRiders: Record<string, any>,
  assignedDrivers: Record<string, any>,
  assignedRiders: Record<string, any>
): Promise<void> {
  for (const key of Object.keys(unassignedDrivers)) {
    await sendSms(
      "Hello from ant ride.\n\nUnfortunately you were not able to be matched into a ride. You will have to drive by yourself.",
      key
    );
  }

  for (const key of Object.keys(unassignedRiders)) {
    await sendSms(
      "Hello from ant ride.\n\nUnfortunately you were not able to be matched into a ride. You will have to arrange your own transport.",
      key
    );
  }

  for (const [key, value] of Object.entries(assignedDrivers)) {
    const driverDetails: any = value;
    let riderDetails = "";

    for (const rider of driverDetails.riders) {
      riderDetails += `Name: ${rider.name}\nAddress: ${rider.address}\nNumber: ${rider.number}\n\n`;
    }

    await sendSms(
      `Hello from ant ride.\n\nGood news! You were matched as a driver in a carpool. You will pickup ${Object.keys(driverDetails.riders).length} people.\n\nHere is the google maps link for the entire route: ${driverDetails.route}.\n\nHere is the name, address, and number for each of your riders:\n\n${riderDetails}`,
      key
    );
  }

  for (const [key, value] of Object.entries(assignedRiders)) {
    const driverDetails: any = (value as any).driver;
    await sendSms(
      `Hello from ant ride.\n\nGood news! You were matched as a rider in a carpool. Your driver's name is ${driverDetails.name} and their number is ${driverDetails.number}.\n\nHere is the google maps link for the entire route: ${assignedDrivers[driverDetails.number].route}.`,
      key
    );
  }
}

function fillCarpoolObjects(carpool: any) {
  const allDrivers = carpool.properties.params.agents;
  const allRiders = carpool.properties.params.jobs;
  const assignedDrivers: Record<string, any> = {};
  const assignedRiders: Record<string, any> = {};
  const unassignedDrivers: Record<string, any> = {};
  const unassignedRiders: Record<string, any> = {};

  let unassignedDriverIndexes: number[] = [];
  let unassignedRiderIndexes: number[] = [];

  if (carpool.properties?.issues?.unassigned_agents) {
    unassignedDriverIndexes = carpool.properties.issues.unassigned_agents;
  }

  if (carpool.properties?.issues?.unassigned_jobs) {
    unassignedRiderIndexes = carpool.properties.issues.unassigned_jobs;
  }

  allDrivers.forEach((driver: any, index: number) => {
    const parsed = JSON.parse(driver.description);
    const number = parsed.number;

    if (unassignedDriverIndexes.includes(index)) {
      unassignedDrivers[number] = parsed;
    } else {
      assignedDrivers[number] = parsed;
    }
  });

  allRiders.forEach((rider: any, index: number) => {
    const parsed = JSON.parse(rider.description);
    const number = parsed.number;

    if (unassignedRiderIndexes.includes(index)) {
      unassignedRiders[number] = parsed;
    } else {
      assignedRiders[number] = parsed;
    }
  });

  return {
    assigned_drivers: assignedDrivers,
    assigned_riders: assignedRiders,
    unassigned_drivers: unassignedDrivers,
    unassigned_riders: unassignedRiders,
    all_drivers: allDrivers,
    all_riders: allRiders,
  };
}

function createGoogleMapsRouteLink(
  geoapifyResponse: any,
  carpoolGroups: any,
  destination: string
) {
  const googleMapRouteLinks: string[] = [];

  geoapifyResponse.features.forEach((agent: any) => {
    const driver = JSON.parse(carpoolGroups.all_drivers[agent.properties.agent_index].description);
    const driverAddress = driver.address;
    const driverNumber = driver.number;
    const riders: any[] = [];

    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(driverAddress)}&destination=${encodeURIComponent(destination)}&travelmode=driving&waypoints=`;

    agent.properties.actions.forEach((action: any) => {
      if (action.type === "job") {
        const riderDetails = JSON.parse(carpoolGroups.all_riders[action.job_index].description);
        riders.push(riderDetails);

        const address = riderDetails.address;
        url += `${encodeURIComponent(`${address}|`)}`;

        carpoolGroups.assigned_riders[riderDetails.number].driver = driver;
      }
    });

    carpoolGroups.assigned_drivers[driverNumber].riders = riders;

    url = url.replace(/ /g, "");
    url = url.slice(0, -3);

    carpoolGroups.assigned_drivers[driverNumber].route = url;
    googleMapRouteLinks.push(url);
  });

  return googleMapRouteLinks;
}

async function geoapifyCreateOptimizedCarpools(data: any, riders: any, drivers: any) {
  const geoapifyKey = requireEnv("GEOAPIFY_KEY");

  let driversFormatted = drivers.map(async (driver: any) => {
    const splitDriverAddress = String(driver.address).split("|");
    const eventAddress = String(data[0].address).split("|");

    const waypoints =
      `${splitDriverAddress[1]},${splitDriverAddress[2]}|` +
      `${eventAddress[1]},${eventAddress[2]}`;

    let singleDriverRoute: any;
    try {
      singleDriverRoute = await fetch(
        `https://api.geoapify.com/v1/routing?waypoints=${encodeURIComponent(waypoints)}&mode=drive&format=json&apiKey=${geoapifyKey}`
      ).then((res) => res.json());
    } catch (error) {
      throw new Error(`Could not get direct routes for every driver ${String(error)}`);
    }

    const normalDrivingTime = Math.round(singleDriverRoute.results[0].time);

    return {
      start_location: [splitDriverAddress[2], splitDriverAddress[1]],
      end_location: [eventAddress[2], eventAddress[1]],
      time_windows: [[0, normalDrivingTime + 1200]],
      pickup_capacity: driver.seats_available,
      description: JSON.stringify({
        address: splitDriverAddress[0],
        number: driver.phone_num,
        name: driver.name,
      }),
    };
  });

  driversFormatted = await Promise.all(driversFormatted);

  const ridersFormatted = riders.map((rider: any) => {
    const splitAddress = String(rider.address).split("|");
    return {
      location: [splitAddress[2], splitAddress[1]],
      duration: 30,
      pickup_amount: 1,
      description: JSON.stringify({
        address: splitAddress[0],
        number: rider.phone_num,
        name: rider.name,
      }),
    };
  });

  try {
    return await fetch(
      `https://api.geoapify.com/v1/routeplanner?apiKey=${geoapifyKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "drive",
          agents: driversFormatted,
          jobs: ridersFormatted,
        }),
      }
    ).then((res) => res.json());
  } catch (error) {
    throw new Error(`Could not create optimized carpools ${String(error)}`);
  }
}

async function generateCarpoolRoutesGeojson(ctx: any, eventCode: string, carpools: any) {
  const geoapifyKey = requireEnv("GEOAPIFY_KEY");
  const geojson: Record<string, unknown> = {};

  for (const agent of carpools.features) {
    const waypoints = agent.properties.waypoints
      .map((waypoint: any) => `${waypoint.location[1]},${waypoint.location[0]}`)
      .join("|");

    const singleDriverRoute = await fetch(
      `https://api.geoapify.com/v1/routing?waypoints=${waypoints}&mode=drive&apiKey=${geoapifyKey}`
    ).then((res) => res.json());

    geojson[String(agent.properties.agent_index)] = singleDriverRoute;

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  await ctx.runMutation(api.events.setCarpoolArtifacts, {
    event_code: eventCode,
    carpool_geojson: geojson,
    jobs: carpools.properties.params.jobs,
  });
}

export const createCronJobs = action({
  args: {
    date_time: v.string(),
    event_code: v.string(),
  },
  handler: async (_ctx, args) => {
    const eventStart = new Date(args.date_time);

    const fortyEightHoursBefore = new Date(eventStart);
    fortyEightHoursBefore.setHours(fortyEightHoursBefore.getHours() - 48);

    const twentyFourHoursBefore = new Date(eventStart);
    twentyFourHoursBefore.setHours(twentyFourHoursBefore.getHours() - 24);

    const fortyEightCronArray = getCronSchedule(fortyEightHoursBefore).split(" ");
    const twentyFourCronArray = getCronSchedule(twentyFourHoursBefore).split(" ");

    const eventTime = new Date(args.date_time);
    eventTime.setHours(eventTime.getHours() + 1);

    const expiresAt = formatDateToCronExpiresAt(eventTime);

    const carpoolPassword = requireEnv("CARPOOL_PASSWORD");
    const cronJobKey = requireEnv("CRON_JOB_KEY");
    const convexSiteUrl = requireEnv("CONVEX_SITE_URL");

    const genders = ["Male", "Female"];
    const times: [string[], boolean][] = [
      [fortyEightCronArray, false],
      [twentyFourCronArray, true],
    ];

    const sendCron = async (gender: string, cronArray: string[], confirmed: boolean) => {
      const response = await fetch("https://api.cron-job.org/jobs", {
        method: "PUT",
        body: JSON.stringify({
          job: {
            url: `${convexSiteUrl}/carpools`,
            enabled: "true",
            saveResponses: true,
            schedule: {
              timezone: "America/Toronto",
              expiresAt,
              minutes: [0],
              hours: [cronArray[1]],
              mdays: [cronArray[2]],
              months: [cronArray[3]],
              wdays: [-1],
            },
            requestMethod: 1,
            extendedData: {
              body: JSON.stringify({
                event_code: args.event_code,
                password: carpoolPassword,
                confirmed,
                gender,
              }),
            },
          },
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cronJobKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error! status: ${response.status}`);
      }
    };

    for (const gender of genders) {
      for (const cronDetails of times) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await sendCron(gender, cronDetails[0], cronDetails[1]);
      }
    }
  },
});

export const sendConfirmationMessages = action({
  args: {
    event_name: v.string(),
    event_code: v.string(),
    participants: v.array(v.any()),
  },
  handler: async (_ctx, args) => {
    for (const person of args.participants) {
      await sendConfirmationSms(
        args.event_name,
        args.event_code,
        String(person.edit_code),
        String(person.phone_num)
      );
    }
  },
});

export const runConfirmedCarpoolFlow = action({
  args: {
    event_code: v.string(),
    participants: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const riders = args.participants.filter(
      (participant: any) => !participant.can_pickup
    );
    const drivers = args.participants.filter(
      (participant: any) => participant.can_pickup
    );

    const geoapifyResponse = await geoapifyCreateOptimizedCarpools(
      args.participants,
      riders,
      drivers
    );

    const carpoolGroups = fillCarpoolObjects(geoapifyResponse);
    const destination = String(args.participants[0].address).split("|")[0];

    const googleMapRouteLinks = createGoogleMapsRouteLink(
      geoapifyResponse,
      carpoolGroups,
      destination
    );

    await sendCarpoolsSms(
      carpoolGroups.unassigned_drivers,
      carpoolGroups.unassigned_riders,
      carpoolGroups.assigned_drivers,
      carpoolGroups.assigned_riders
    );

    try {
      await generateCarpoolRoutesGeojson(ctx, args.event_code, geoapifyResponse);
    } catch (_error) {
      throw new Error("Could not generate carpool routes geojson file");
    }

    return {
      google_map_route_links: googleMapRouteLinks,
    };
  },
});
