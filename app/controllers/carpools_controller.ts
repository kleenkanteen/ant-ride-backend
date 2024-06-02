import { CreateCarpoolsValidator } from '#validators/event'
import type { HttpContext } from '@adonisjs/core/http'

import { init_twilio_client, send_carpools_sms, send_confirmation_sms } from '#controllers/utils/twilio'
import { supabase } from '#start/supabase'
import { create_google_maps_route_link, fill_carpool_objects, generate_carpool_routes_geojson, geoapify_create_optimized_carpools } from './utils/carpool.js'

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
        // TODO: send sms to everyone saying they have to drive themselves because of lack of participants
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

    init_twilio_client()

    // initial check whether to just send confirmation messages 48h prior
    if (!payload.confirmed) {
      for (const person of data) {
        send_confirmation_sms(event_data![0].name, payload.event_code, person.edit_code, person.phone_num)
      }

      return response.ok({
        status: 'success',
        message: 'Confirmation SMS messages sent successfully',
      })
    }

    let geoapify_response: any = await geoapify_create_optimized_carpools(data, riders, drivers)
    console.log("GEOAPIFY", geoapify_response)

    let carpool_groups: any = fill_carpool_objects(geoapify_response)

    let destination = data![0].address.split("|")[0]
    let google_map_route_links: any = create_google_maps_route_link(geoapify_response, carpool_groups, destination)

    send_carpools_sms(carpool_groups.unassigned_drivers, carpool_groups.unassigned_riders, carpool_groups.assigned_drivers, carpool_groups.assigned_riders)

    try {
      generate_carpool_routes_geojson(payload.event_code, geoapify_response)
    }
    catch (error) {
      return response.internalServerError({
        status: 'error',
        message: 'Could not generate carpool routes geojson file'
      })
    }

    return response.ok({
      status: 'success',
      message: 'Carpool created successfully!',
      data: {
        google_map_route_links
      },
    })
  }

  async get({ request, response }: HttpContext) {
    let event_code = request.qs()["event-code"]

    // check if valid event code
    const { data, error } = await supabase
      .from('events')
      .select('carpool_geojson, jobs')
      .eq('event_code', event_code)

    if (error || data?.length == 0) {
      return response.notFound({
        status: 'error',
        message: 'Event code is not valid',
      })
    }

    return response.ok({
      status: 'success',
      message: 'Carpool created successfully!',
      data: data[0]
    })
  }
}
