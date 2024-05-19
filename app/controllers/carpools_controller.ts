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

    if (error) {
      return response.internalServerError({
        status: 'error',
        message: `Unable to retrieve event participants: ${error.message}`,
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

    const json = await ky.get('https://jsonplaceholder.typicode.com/todos/1').json()
    console.log(json)

    const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY

    const female_drivers_formatted = female_drivers.map((driver: any) => {
      const split_address = driver.address.split('|')
      return {
        "start_location": [
          split_address[0],
          split_address[1]
        ],
        "end_location": [
          split_address[0],
          split_address[1]
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
          split_address[0],
          split_address[1]
        ],
        "duration": 60
      }
    })

    const female_carpools = await ky.post(`https://api.geoapify.com/v1/routeplanner?apiKey=${GEOAPIFY_KEY}`, {
      json:
      {
        "mode": "drive",
        "agents": female_drivers_formatted,
        // make a new list of objects based on the female drivers list. make each object have a start_location that is a list of longitude and latitude. and a time_windows list that has a list of 0 and 7200

        "shipments": [
          {
            "id": "order_1",
            "pickup": {
              "location_index": 0,
              "duration": 120
            },
            "delivery": {
              "location": [
                13.381175446198714,
                52.50929975
              ],
              "duration": 120
            }
          },
        ],
        "locations": [
          {
            "id": "warehouse-0",
            "location": [
              13.3465209,
              52.5245064
            ]
          }
        ]
      }
    }
    ).json();

    return response.ok({
      status: 'success',
      message: 'Carpool created successfully!',
      data: {
        male_riders,
        male_drivers,
        female_riders,
        female_drivers,
      },
    })
  }
}
