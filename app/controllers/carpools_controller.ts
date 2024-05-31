import { supabase } from '#start/supabase'
import { CreateCarpoolsValidator } from '#validators/event'
import type { HttpContext } from '@adonisjs/core/http'
import ky from 'ky'

import { send_carpools_sms, send_confirmation_sms, twilio_client } from './twilio.js'

export default class CarpoolsController {
  async create({ request, response }: HttpContext) {
    const payload = await request.validateUsing(CreateCarpoolsValidator)

    if (payload.password !== process.env.CARPOOL_PASSWORD) {
      return response.badRequest({
        status: 'error',
        message: 'Invalid password',
      })
    }

    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('event_code', payload.event_code)
      .eq('confirmed', payload.confirmed)
      .eq('gender', payload.gender)

    if (error) {
      return response.internalServerError({
        status: 'error',
        message: `Unable to retrieve event participants: ${error!.message}`,
      })
    }

    const riders = data.filter((participant: any) => participant.gender === payload.gender && !participant.can_pickup)
    const drivers = data.filter((participant: any) => participant.gender === payload.gender && participant.can_pickup)

    if (data.length <= 1 || drivers.length === 0) {
      return response.badRequest({
        status: 'error',
        message: 'Event has 0 participants or no drivers',
        // TODO: send message to all riders saying they have to drive themselves because of lack of participants
      })
    }

    const { data: event_data, error: event_error } = await supabase
      .from('events')
      .select('*')
      .eq('event_code', payload.event_code)

    if (event_error) {
      return response.internalServerError({
        status: 'error',
        message: `Unable to retrieve event: ${event_error!.message}`,
      })
    }

    // initial check of whether to just send confirmation sms to participants
    twilio_client()
    if (!payload.confirmed) {
      for (const person of data) {
        send_confirmation_sms(event_data![0].name, payload.event_code, person.edit_code, person.phone_num)
      }

      return response.ok({
        status: 'success',
        message: 'Confirmation SMS messages sent succesfully',
      })
    }

    // confirmed participants only, time to make carpools
    const drivers_formatted = drivers.map((driver: any) => {
      const split_driver_address = driver.address.split('|')
      const event_address = data[0].address.split('|')

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
            2100
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
    const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY
    const carpool: any = await ky.post(`https://api.geoapify.com/v1/routeplanner?apiKey=${GEOAPIFY_KEY}`, {
      json:
      {
        "mode": "drive",
        "agents": drivers_formatted,
        "jobs": riders_formatted
      }
    }
    ).json()

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

    let google_map_route_links: any = []
    // https://developers.google.com/maps/documentation/urls/get-started
    // route through each driver (aka agent)
    carpool.features.forEach((agent: any) => {
      let driver = JSON.parse(all_drivers[agent.properties.agent_index].description)
      let driver_address = driver.address
      let driver_number = driver.number
      let riders: any = []

      let url = `https://www.google.com/maps/dir/?api=1&\
      origin=${encodeURIComponent(driver_address)}&\
      destination=${encodeURIComponent(data![0].address.split("|")[0])}&\
      travelmode=driving&\
      waypoints=`

      agent.properties.actions.forEach((action: any) => {
        if (action.type === "job") {
          // add rider details to each driver
          let rider_details = JSON.parse(all_riders[action.job_index].description)
          riders.push(rider_details)

          // add stop to route
          let address = rider_details.address
          url += `${encodeURIComponent(`${address}|`)}`

          // add driver details to each rider
          // @ts-expect-error type
          assigned_riders[rider_details.number].driver = driver

          // TODO: in supabase make the driver and every rider matched = true. not necessary but nice to store as stats
        }
      })

      // @ts-expect-error type
      assigned_drivers[driver_number].riders = riders

      // clean up url, remove empty spaces and the last encoded "|"
      url = url.replace(/ /g, '')
      url = url.slice(0, -3)

      google_map_route_links.push(url)
      // @ts-expect-error type
      assigned_drivers[driver_number].route = url
    })

    send_carpools_sms(unassigned_drivers, unassigned_riders, assigned_drivers, assigned_riders)

    return response.ok({
      status: 'success',
      message: 'Carpool created successfully!',
      data: {
        assigned_drivers,
        assigned_riders,
        unassigned_drivers,
        unassigned_riders,
        carpool,
        google_map_route_links
      },
    })
  }
}
