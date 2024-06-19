import { drivers } from '@adonisjs/core/hash';
import Env from '#start/env';
import { supabase } from '#start/supabase';
import ky from 'ky';

export function fill_carpool_objects(carpool: any) {
  let all_drivers = carpool.properties.params.agents
  let all_riders = carpool.properties.params.jobs
  let assigned_drivers = {}
  let assigned_riders = {}
  let unassigned_drivers = {}
  let unassigned_riders = {}
  let unassigned_drivers_indexes = []
  let unassigned_riders_indexes = []

  // any drivers that could not be assigned will be in the properties.unassignedAgents object. and unassigned riders in unassignedJobs.
  if (carpool.properties?.issues?.unassigned_agents) {
    unassigned_drivers_indexes = carpool.properties.issues.unassigned_agents
  }

  if (carpool.properties?.issues?.unassigned_jobs) {
    unassigned_riders_indexes = carpool.properties.issues.unassigned_jobs
  }

  all_drivers.forEach((driver: any, index: number) => {
    if (unassigned_drivers_indexes.includes(index)) {
      let number = JSON.parse(driver.description).number
      // @ts-expect-error type
      unassigned_drivers[number] = JSON.parse(driver.description)
    }
    else {
      let number = JSON.parse(driver.description).number
      // @ts-expect-error type
      assigned_drivers[number] = JSON.parse(driver.description)
    }
  })

  all_riders.forEach((rider: any, index: number) => {
    if (unassigned_riders_indexes.includes(index)) {
      let number = JSON.parse(rider.description).number
      // @ts-expect-error type
      unassigned_riders[number] = JSON.parse(rider.description)
    }
    else {
      let number = JSON.parse(rider.description).number
      // @ts-expect-error type
      assigned_riders[number] = JSON.parse(rider.description)
    }
  })
  return {
    assigned_drivers,
    assigned_riders,
    unassigned_drivers,
    unassigned_riders,
    unassigned_drivers_indexes,
    unassigned_riders_indexes,
    all_drivers,
    all_riders
  };
}

export function create_google_maps_route_link(geoapify_response: any,
  carpool_groups: any,
  destination: string) {
  let google_map_route_links: any = []
  // https://developers.google.com/maps/documentation/urls/get-started
  // route through each driver (aka agent)
  geoapify_response.features.forEach((agent: any) => {
    let driver = JSON.parse(carpool_groups.all_drivers[agent.properties.agent_index].description)
    let driver_address = driver.address
    let driver_number = driver.number
    let riders: any = []

    let url = `https://www.google.com/maps/dir/?api=1&\
      origin=${encodeURIComponent(driver_address)}&\
      destination=${encodeURIComponent(destination)}&\
      travelmode=driving&\
      waypoints=`

    agent.properties.actions.forEach((action: any) => {
      if (action.type === "job") {
        // add rider details to each driver
        let rider_details = JSON.parse(carpool_groups.all_riders[action.job_index].description)
        riders.push(rider_details)

        // add stop to route
        let address = rider_details.address
        url += `${encodeURIComponent(`${address}|`)}`

        // add driver details to each rider
        carpool_groups.assigned_riders[rider_details.number].driver = driver

        // TODO: in supabase make the driver and every rider matched = true. not necessary but nice to store as stats
      }
    })

    carpool_groups.assigned_drivers[driver_number].riders = riders

    // clean up url, remove empty spaces and the last encoded "|" which takes up 3 chars
    url = url.replace(/ /g, '')
    url = url.slice(0, -3)
    carpool_groups.assigned_drivers[driver_number].route = url

    google_map_route_links.push(url)
  })

  return google_map_route_links
}

export async function geoapify_create_optimized_carpools(data: any, riders: any, drivers: any) {
  // confirmed participants only, time to make carpools
  let drivers_formatted = drivers.map(async (driver: any) => {
    const split_driver_address = driver.address.split('|')
    const event_address = data[0].address.split('|')

    // create a pipe separated string of lat, long for each pickup point for a driver, in order of pickup
    const GEOAPIFY_KEY = Env.get("GEOAPIFY_KEY")
    let waypoints = split_driver_address[1] + ',' + split_driver_address[2] + '|' + event_address[1] + ',' + event_address[2]
    let single_driver_route: any
    try {
      single_driver_route = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${encodeURIComponent(waypoints)}&mode=drive&format=json&apiKey=${GEOAPIFY_KEY}`).then(res => res.json())
    } catch (error) {
      throw new Error(`Could not get direct routes for every driver ${error}`)
    }
    // // rount single_driver_route.results[0].time to nearest second
    let normal_driving_time = Math.round(single_driver_route.results[0].time)
    return {
      "start_location": [
        // for some reason geoapify orders it as long, lat, which is backwards form the norm of lat, long
        split_driver_address[2],
        split_driver_address[1]
      ],
      "end_location": [
        event_address[2],
        event_address[1]
      ],
      "time_windows": [
        [
          0,
          // add 20 mins on top of normal driving time
          normal_driving_time + 1200
        ]
      ],
      "pickup_capacity": driver.seats_available,
      "description": JSON.stringify({
        address: split_driver_address[0],
        number: driver.phone_num,
        name: driver.name
      })
    }
  })
  drivers_formatted = await Promise.all(drivers_formatted)

  const riders_formatted = riders.map((rider: any) => {
    const split_address = rider.address.split('|')
    return {
      "location": [
        split_address[2],
        split_address[1]
      ],
      "duration": 30,
      "pickup_amount": 1,
      "description": JSON.stringify({
        address: split_address[0],
        number: rider.phone_num,
        name: rider.name
      })
    }
  })

  // docs: https://apidocs.geoapify.com/docs/route-planner/#about
  // example of using route planner api: https://www.geoapify.com/route-and-schedule-optimization-for-workers-with-route-planner-api
  const GEOAPIFY_KEY = Env.get("GEOAPIFY_KEY")
  let res: any
  try {
    res = await ky.post(`https://api.geoapify.com/v1/routeplanner?apiKey=${GEOAPIFY_KEY}`, {
    json:
    {
      "mode": "drive",
      "agents": drivers_formatted,
      "jobs": riders_formatted
    }
  }
  ).json()
  } catch (error) {
    throw new Error(`Could not create optimized carpools ${error}`)
  }
  return res
}

export async function generate_carpool_routes_geojson(event_code: string, carpools: any) {
  const GEOAPIFY_KEY = Env.get("GEOAPIFY_KEY")
  let geojson: any = {}

  for (const agent of carpools.features) {
    // create a pipe separated string of lat, long for each pickup point for a driver, in order of pickup
    let waypoints = agent.properties.waypoints.map((waypoint: any) => waypoint.location[1] + ',' + waypoint.location[0]).join('|')

    const single_driver_route: any = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${waypoints}&mode=drive&apiKey=${GEOAPIFY_KEY}`).then(res => res.json())
    geojson[agent.properties.agent_index] = single_driver_route
    // to workaround the rate limit of 5 requests/second
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  const { error } = await supabase
    .from('events')
    .update({
      carpool_geojson: geojson,
      jobs: carpools.properties.params.jobs
    })
    .eq('event_code', event_code)

  if (error) {
    throw new Error(`Could not save geojson in supabase ${error.message}`)
  }
}
