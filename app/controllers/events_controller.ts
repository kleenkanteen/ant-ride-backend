import { CreateEventValidator, EditEventValidator } from '#validators/event'
import type { HttpContext } from '@adonisjs/core/http'

import { createCronJob } from '#controllers/utils/cron-job'
import { supabase } from '#start/supabase'
import { nanoid } from 'nanoid'

export default class EventsController {
  async create({ request, response }: HttpContext) {
    const payload = await request.validateUsing(CreateEventValidator)
    const event_code = nanoid(5)
    const edit_code = nanoid(5)
    const { data, error } = await supabase
      .from('events')
      .insert({
        name: payload.name,
        address: payload.address,
        date_time: payload.date_time,
        event_code: event_code,
        edit_code: edit_code
      }).select()

    if (error) {
      return response.internalServerError({
        status: 'error',
        message: `Unable to create event, error message: ${error.message}`,
      })
    } else {
      // confirmation sms's will be sent 48 hours before carpool. optimized carpools will be made 24 hours
      createCronJob(payload.date_time, event_code)
      return response.ok({
        status: 'success',
        message: 'Event created successfully!',
        data: data
      })
    }
  }

  async edit({ request, response }: HttpContext) {
    const payload = await request.validateUsing(EditEventValidator)
    const { data, error } = await supabase
      .from('events')
      .update({
        name: payload.name,
        address: payload.address,
        date_time: payload.date_time,
      }).match({
        event_code: payload.event_code,
        edit_code: payload.edit_code
      }).select()

    if (error) {
      return response.internalServerError({
        status: 'error',
        message: `Unable to create event, full message: ${error.message}`,
      })
    } else if (data.length === 0) {
      return response.notFound({
        status: 'error',
        message: 'Event code or edit code is invalid'
      })
    }
    else {
      return response.ok({
        status: 'success',
        message: 'Event details edited!',
        data: data
      })
    }
  }
}
