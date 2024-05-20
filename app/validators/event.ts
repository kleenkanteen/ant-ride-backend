import vine from '@vinejs/vine'

export const CreateEventValidator = vine.compile(
  vine.object({
    name: vine.string().maxLength(50),
    address: vine.string().maxLength(50),
    date_time: vine.string().maxLength(50),
  })
)

export const EditEventValidator = vine.compile(
  vine.object({
    event_code: vine.string().minLength(5).maxLength(5),
    edit_code: vine.string().minLength(5).maxLength(5),
    name: vine.string().maxLength(50),
    address: vine.string().maxLength(50),
    date_time: vine.string().maxLength(50),
  })
)

export const JoinParticipantsValidator = vine.compile(
  vine.object({
    event_code: vine.string().minLength(5).maxLength(5),
    name: vine.string().maxLength(50),
    gender: vine.enum(['Male', 'Female']),
    address: vine.string().maxLength(50),
    can_pickup: vine.boolean(),
    phone_num: vine.string().maxLength(10),
    seats_available: vine.number().withoutDecimals().min(0).max(7),
  })
)

export const EditParticipantsValidator = vine.compile(
  vine.object({
    event_code: vine.string().minLength(5).maxLength(5),
    edit_code: vine.string().minLength(5).maxLength(5),
    remove: vine.boolean().optional(),
    name: vine.string().maxLength(100).optional(),
    gender: vine.enum(['Male', 'Female']).optional(),
    address: vine.string().maxLength(50).optional(),
    can_pickup: vine.boolean().optional(),
    seats_available: vine.number().withoutDecimals().min(0).max(7).optional(),
    confirmed: vine.boolean().optional(),
    phone_num: vine.string().maxLength(10).optional(),
  })
)
