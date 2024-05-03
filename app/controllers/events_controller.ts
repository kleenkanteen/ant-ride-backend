import { createEventValidator } from '#validators/event'
import type { HttpContext } from '@adonisjs/core/http'

import { supabase } from '#start/supabase'
import { nanoid } from 'nanoid'

export default class CarpoolsController {
  async create({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createEventValidator)
    const event_code = nanoid(5)
    const event_edit_code = nanoid(5)
    const { error } = await supabase
      .from('events')
      .insert({
        name: payload.name,
        address: payload.address,
        date_time: payload.date_time,
        event_code: event_code,
        event_edit_code: event_edit_code
      })

    if (error) {
      return response.internalServerError({
        message: `Unable to create event, full message: ${error.message}`,
      })
    } else {
      return response.ok({ message: 'Event created successfully!' })
    }
  }
}
