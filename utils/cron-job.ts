import env from '#start/env'
import { formatDateToCronExpiresAt, getCronSchedule } from "./date.js"

export async function createCronJob(date_time: any, event_code: string) {
  const event_start = new Date(date_time)

  const forty_eight_hrs_before = new Date(event_start)
  forty_eight_hrs_before.setHours(forty_eight_hrs_before.getHours() - 48)

  const twenty_four_hrs_before = new Date(event_start)
  twenty_four_hrs_before.setHours(twenty_four_hrs_before.getHours() - 24)

  const forty_eight_hrs_before_cron_array = getCronSchedule(forty_eight_hrs_before).split(" ")
  const twenty_four_hrs_before_cron_array = getCronSchedule(twenty_four_hrs_before).split(" ")

  const event_time = new Date(date_time)
  event_time.setHours(event_time.getHours() + 1)
  const expiresAt = formatDateToCronExpiresAt(event_time)
  const numExpiresAt = parseInt(expiresAt)
  const CARPOOL_PASSWORD = env.get('CARPOOL_PASSWORD')
  const CRON_JOB_KEY = env.get('CRON_JOB_KEY')

  // 4 cases:
  // confirmation sms 48 hrs before for males and females separately. confirmed=false
  // final carpool notification for males and females separately. confirmed=true
  const genders = ["Male", "Female"]
  const times: [string[], boolean][] = [[forty_eight_hrs_before_cron_array, false], [twenty_four_hrs_before_cron_array, true]]

  async function sendCron(gender: string, cron_array: string[], confirmed: boolean) {
    try {
      const response = await fetch('https://api.cron-job.org/jobs', {
        method: 'PUT',
        body: JSON.stringify({
          'job': {
            'url': 'https://www.antride.ca/carpools',
            'enabled': 'true',
            'saveResponses': true,
            "schedule": {
              "timezone": "America/Toronto", "expiresAt": numExpiresAt,
              "minutes": [0],
              "hours": [cron_array[1]],
              "mdays": [cron_array[2]],
              "months": [cron_array[3]], "wdays": [-1]
            },
            'requestMethod': 1,
            'extendedData': {
              'body': JSON.stringify({
                'event_code': event_code,
                'password': CARPOOL_PASSWORD,
                'confirmed': confirmed,
                'gender': gender
              })
            }
          }
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CRON_JOB_KEY}`
        },
      })

      if (!response.ok) {
        throw new Error(`Error! status: ${response.status}`)
      }

    } catch (error) {
      if (error instanceof Error) {
        console.log('error message: ', error.message)
        return error.message
      } else {
        console.log('unexpected error: ', error)
        return 'An unexpected error occurred'
      }
    }
  }

  for (const gender of genders) {
    for (const cronDetails of times) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log("CRON JOB SENT FOR", gender);
      await sendCron(gender, cronDetails[0], cronDetails[1]);
    }
  }

}
