import { supabase } from '#start/supabase'
import { CreateCarpoolsValidator } from '#validators/event'
import type { HttpContext } from '@adonisjs/core/http'

import ky from 'ky'

export default class CarpoolsController {
  async create({ request, response }: HttpContext) {
    // first create a create-carpool endpoint that looks at supabase and pulls all the
    // participanrts for the passed in event-code. and then splits into male and female.
    // and then sends that off to the geoapify with a 1 hour time window.
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

    const { data: eventData, error: error2 } = await supabase
      .from('events')
      .select('address')
      .eq('event_code', payload.event_code)


    if (error || error2) {
      return response.internalServerError({
        status: 'error',
        message: `Unable to retrieve event participants: ${error!.message}`,
      })
    }

    if (data.length <= 1) {
      return response.notFound({
        status: 'error',
        message: 'Event has no participants',
      })
    }

    const male_riders = data.filter((participant: any) => participant.gender === 'Male' && !participant.can_pickup)
    const male_drivers = data.filter((participant: any) => participant.gender === 'Male' && participant.can_pickup)

    const female_riders = data.filter((participant: any) => participant.gender === 'Female' && !participant.can_pickup)
    const female_drivers = data.filter((participant: any) => participant.gender === 'Female' && participant.can_pickup)

    const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY

    const female_drivers_formatted = female_drivers.map((driver: any) => {
      console.log("EVENT DATA", eventData)
      console.log("EVENT DATA", driver)
      const split_driver_address = driver.address.split('|')
      // @ts-ignore
      const event_address = eventData[0].address.split('|')

      return {
        "start_location": [
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
            7200
          ]
        ],
        "pickup_capacity": driver.seats_available
      }
    })

    const female_riders_formatted = female_riders.map((driver: any) => {
      const split_address = driver.address.split('|')
      return {
        "location": [
          split_address[2],
          split_address[1]
        ],
        "duration": 60,
        "pickup_amount": 1
      }
    })

    // https://apidocs.geoapify.com/docs/route-planner/#about
    const female_carpools = await ky.post(`https://api.geoapify.com/v1/routeplanner?apiKey=${GEOAPIFY_KEY}`, {
      json:
      {
        "mode": "drive",
        "agents": female_drivers_formatted,
        "jobs": female_riders_formatted
        // make a new list of objects based on the female drivers list. make each object have a start_location that is a list of longitude and latitude. and a time_windows list that has a list of 0 and 7200
      }
    }
    ).json();

    // female_carpools has a properties object as well. any drivers that could not be assigned will be in the properties.unassignedAgents	object.
    // any riders that could not be assigned will be in the unassignedJobs object.

    return response.ok({
      status: 'success',
      message: 'Carpool created successfully!',
      data: {
        male_riders,
        male_drivers,
        female_riders,
        female_drivers,
        female_carpools
      },
    })
  }
}
