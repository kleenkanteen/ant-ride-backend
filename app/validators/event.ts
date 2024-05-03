import vine from '@vinejs/vine'

export const createEventValidator = vine.compile(
  vine.object({
    name: vine.string(),
    address: vine.string(),
    date_time: vine.string(),
  })
)
