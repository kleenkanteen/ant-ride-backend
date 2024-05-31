import vine from '@vinejs/vine'

export const CreateEventValidator = vine.compile(
  vine.object({
    name: vine.string().maxLength(50),
    address: vine.string().maxLength(100),
    date_time: vine.string().maxLength(50),
  })
)

export const EditEventValidator = vine.compile(
  vine.object({
    event_code: vine.string().minLength(5).maxLength(5),
    edit_code: vine.string().minLength(5).maxLength(5),
    name: vine.string().maxLength(50),
    address: vine.string().maxLength(100),
    date_time: vine.string().maxLength(50),
  })
)

export const JoinParticipantsValidator = vine.compile(
  vine.object({
    event_code: vine.string().minLength(5).maxLength(5),
    name: vine.string().maxLength(50),
    gender: vine.enum(['Male', 'Female']),
    address: vine.string().maxLength(100),
    can_pickup: vine.boolean(),
    phone_num: vine.string().maxLength(10),
    seats_available: vine.number().withoutDecimals().min(0).max(7),
  })
)

export const EditParticipantsValidator = vine.compile(
  vine.object({
    event_code: vine.string().minLength(5).maxLength(5),
    edit_code: vine.string().minLength(5).maxLength(5),
    remove: vine.boolean(),
    name: vine.string().maxLength(100),
    phone_num: vine.string().maxLength(15),
    gender: vine.enum(['Male', 'Female']),
    address: vine.string().maxLength(100),
    can_pickup: vine.boolean(),
    seats_available: vine.number().withoutDecimals().min(0).max(7),
  })
)

export const CreateCarpoolsValidator = vine.compile(
  vine.object({
    event_code: vine.string().minLength(5).maxLength(5),
    password: vine.string().maxLength(100),
    gender: vine.enum(['Male', 'Female']),
    confirmed: vine.boolean(),
  })
)
