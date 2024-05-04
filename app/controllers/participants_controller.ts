import type { HttpContext } from '@adonisjs/core/http'
import { JoinParticipantsValidator } from '#validators/event'
import { EditParticipantsValidator } from '#validators/event'

import { supabase } from '#start/supabase'
import { nanoid } from 'nanoid'

export default class ParticipantsController {
  async create({ request, response }: HttpContext) {
    const payload = await request.validateUsing(JoinParticipantsValidator)

    // check if valid event code
    const { data: event_data, error: event_error } = await supabase
      .from('events')
      .select('*')
      .eq('event_code', payload.event_code)

    if (event_error) {
      return response.internalServerError({
        status: 'error',
        message: `Unable to check if event exists`,
      })
    } else if (event_data.length == 0) {
      return response.notFound({
        status: 'error',
        message: 'Event code is not valid'
      })
    }

    // check if participant exists using just their name and address
    const { data: data1, error: error1 } = await supabase
      .from('participants')
      .select('*')
      .eq('name', payload.name)
      .eq('address', payload.address)

    if (error1) {
      return response.internalServerError({
        status: 'error',
        message: `Unable to join carpool, error message: ${error1.message}`,
      })
    } else if (data1.length > 0) {
      return response.conflict({
        status: 'error',
        message: 'You are already in the carpool, use your edit code! If you do not remember it, try again with a different name.'
      })
    }

    // new participant, add them
    const edit_code = nanoid(5)
    const { data, error } = await supabase
      .from('participants')
      .insert({
        event_code: payload.event_code,
        edit_code: edit_code,
        name: payload.name,
        gender: payload.gender,
        address: payload.address,
        can_pickup: payload.can_pickup,
        seats_available: payload.seats_available,
      }).select()

    if (error) {
      return response.internalServerError({
        status: 'error',
        message: `Unable to join carpool, error message: ${error.message}`,
      })
    } else {
      return response.ok({
        status: 'success',
        message: 'Carpool joined successfully!',
        data: data
      })
    }
  }

  async edit({ request, response }: HttpContext) {
    const payload = await request.validateUsing(EditParticipantsValidator)

    // logic for removing participant
    if (payload.remove) {
      const { data, error } = await supabase
      .from('participants')
      .delete().match({
        event_code: payload.event_code,
        edit_code: payload.edit_code
      }).select()

      // bad event code or edit code
      if (error || data.length === 0) {
        return response.internalServerError({
          status: 'error',
          message: `Event code or edit code is invalid. Error message: ${error ? error.message: ''}`,
        })
      } else {
        return response.ok({
          status: 'success',
          message: 'Successfully removed you from the carpool!'
        })
      }
    }

    // data is good, update participant details
    const { data, error } = await supabase
      .from('participants')
      .update({
        name: payload.name,
        gender: payload.gender,
        address: payload.address,
        can_pickup: payload.can_pickup,
        seats_available: payload.seats_available,
      }).match({
        event_code: payload.event_code,
        edit_code: payload.edit_code
      }).select()

    if (error) {
      return response.internalServerError({
        status: 'error',
        message: `Unable to create carpool, full message: ${error.message}`,
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
        message: 'Your details were edited!',
        data: data
      })
    }
  }
}
