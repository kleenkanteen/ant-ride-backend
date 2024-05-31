/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),
  SUPABASE_URL: Env.schema.string(),
  SUPABASE_SERVICE_ROLE_KEY: Env.schema.string(),
  CARPOOL_PASSWORD: Env.schema.string(),
  GEOAPIFY_KEY: Env.schema.string(),
  TWILIO_ACCOUNT_SID: Env.schema.string(),
  TWILIO_AUTH_TOKEN: Env.schema.string(),
  MODE: Env.schema.enum(['DEV', 'PROD'] as const),
  PERSONAL_NUMBER: Env.schema.string(),
  TWILIO_NUMBER: Env.schema.string(),
  CRON_JOB_KEY: Env.schema.string(),
})
