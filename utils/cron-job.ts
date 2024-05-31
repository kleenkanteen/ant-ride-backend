export function createCronJob(date_time: any, event_code: any) {
const getCronSchedule = (date: Date): string => {
    const minutes = String(date.getUTCMinutes())
    const hours = String(date.getUTCHours())
    const dayOfMonth = String(date.getUTCDate())
    const month = String(date.getUTCMonth() + 1) // Months are zero-indexed
    const dayOfWeek = String(date.getUTCDay()) // Sunday - Saturday : 0 - 6
  
    // Cron format: minute hour dayOfMonth month dayOfWeek
    //return [minutes, hours, dayOfMonth, month, '*'].join(' ')
    return `${minutes} ${hours} ${dayOfMonth} ${month} *`
  }
  const formatDateToCronExpiresAt = (date: Date): string => {
    const pad = (num: number): string => num.toString().padStart(2, '0')
    
    const year = date.getUTCFullYear()
    const month = pad(date.getUTCMonth() + 1)
    const day = pad(date.getUTCDate())
    const hours = pad(date.getUTCHours())
    const minutes = pad(date.getUTCMinutes())
    const seconds = pad(date.getUTCSeconds())
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`
  }
  async function createCronJob() {
    const event_start = new Date(date_time) // not from supabase?
      // console.log("event start is", event_start)
      
      const forty_eight_hrs_before = new Date(event_start)
      forty_eight_hrs_before.setHours(forty_eight_hrs_before.getHours() - 48)
      // console.log("48 hrs before is", forty_eight_hrs_before)

      const twenty_four_hrs_before = new Date(event_start)
      twenty_four_hrs_before.setHours(twenty_four_hrs_before.getHours() - 24)
      // console.log("24 hrs before is", twenty_four_hrs_before)

      const forty_eight_hrs_before_cron = getCronSchedule(forty_eight_hrs_before)
      const twenty_four_hrs_before_cron = getCronSchedule(twenty_four_hrs_before)
    
      var forty_eight_hrs_before_cron_array = forty_eight_hrs_before_cron.split(" ")
      var twenty_four_hrs_before_cron_array = twenty_four_hrs_before_cron.split(" ")

    const t = new Date(date_time)
    t.setHours(t.getHours() + 1)
    const expiresAt = formatDateToCronExpiresAt(t)
    const numExpiresAt = parseInt(expiresAt)
// ====================================== response: 48 hrs male confirmed false
    try {
      const response = await fetch('https://api.cron-job.org/jobs', {
        method: 'PUT',
        body: JSON.stringify({
          'job': {
            'url': 'https://www.antride.ca/carpools',
            'enabled': 'true',
            'saveResponses': true,
            "schedule":{"timezone":"America/Toronto","expiresAt": numExpiresAt,
            "minutes":[0],
            "hours":[0],
            "mdays":[forty_eight_hrs_before_cron_array[2]],
            "months":[forty_eight_hrs_before_cron_array[3]],"wdays":[-1]},
            'requestMethod': 1,


            'extendedData': {
              'body': JSON.stringify({
               // TO DO
              'event_code': event_code,
              'password': '928dcfaaf338f43baac2de274e683c73cfa67de87a235ac55fafc55b09bc25d5', // event_code, password from the sample body
              'confirmed': false,
            'gender': 'Male'})}}
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer GDfDgvqyxL3A8BqVnGPsHm/pIQvcvJgPmo/0oMTzA/o='
        },
      })
  
      if (!response.ok) {
        throw new Error(`Error! status: ${response.status}`)
      }
  
      // const result: UpdateUserResponse
      const result = (await response.json())
  
      console.log('result is: ', JSON.stringify(result, null, 4))
  
      // return result;
    } catch (error) {
      if (error instanceof Error) {
        console.log('error message: ', error.message)
        return error.message
      } else {
        console.log('unexpected error: ', error)
        return 'An unexpected error occurred'
      }
    }
    // =========================================== response2: 48 hours female confirmed false
    try {
    const response2 = await fetch('https://api.cron-job.org/jobs', {
        method: 'PUT',
        body: JSON.stringify({
          'job': {
            'url': 'https://www.antride.ca/carpools',
            'enabled': 'true',
            'saveResponses': true,
            "schedule":{"timezone":"America/Toronto","expiresAt": numExpiresAt,
            "minutes":[0],
            "hours":[0],
            "mdays":[forty_eight_hrs_before_cron_array[2]],
            "months":[forty_eight_hrs_before_cron_array[3]],"wdays":[-1]},
            'requestMethod': 1,


            'extendedData': {
              'body': JSON.stringify({
               // TO DO
              'event_code': event_code,
              'password': '928dcfaaf338f43baac2de274e683c73cfa67de87a235ac55fafc55b09bc25d5', // event_code, password from the sample body
              'confirmed': false,
            'gender': 'Female'})}}
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer GDfDgvqyxL3A8BqVnGPsHm/pIQvcvJgPmo/0oMTzA/o='
        },
      })
  
      if (!response2.ok) {
        throw new Error(`Error! status: ${response2.status}`)
      }
  
      // const result: UpdateUserResponse
      const result = (await response2.json())
  
      console.log('result is: ', JSON.stringify(result, null, 4))
  
      // return result;
    } catch (error2) {
      if (error2 instanceof Error) {
        console.log('error message: ', error2.message)
        return error2.message
      } else {
        console.log('unexpected error: ', error2)
        return 'An unexpected error occurred'
      }
    }
    // =========================================== response3: 24 hrs male confirmed true
    try {
      const response3 = await fetch('https://api.cron-job.org/jobs', {
          method: 'PUT',
          body: JSON.stringify({
            'job': {
              'url': 'https://www.antride.ca/carpools',
              'enabled': 'true',
              'saveResponses': true,
              "schedule":{"timezone":"America/Toronto","expiresAt": numExpiresAt,
              "minutes":[0],
              "hours":[0],
              "mdays":[twenty_four_hrs_before_cron_array[2]],
              "months":[twenty_four_hrs_before_cron_array[3]],"wdays":[-1]},
              'requestMethod': 1,
  
  
              'extendedData': {
                'body': JSON.stringify({
                 // TO DO
                'event_code': event_code,
                'password': '928dcfaaf338f43baac2de274e683c73cfa67de87a235ac55fafc55b09bc25d5', // event_code, password from the sample body
                'confirmed': true,
              'gender': 'Male'})}}
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer GDfDgvqyxL3A8BqVnGPsHm/pIQvcvJgPmo/0oMTzA/o='
          },
        })
    
        if (!response3.ok) {
          throw new Error(`Error! status: ${response3.status}`)
        }
    
        // const result: UpdateUserResponse
        const result = (await response3.json())
    
        console.log('result is: ', JSON.stringify(result, null, 4))
    
        // return result;
      } catch (error3) {
        if (error3 instanceof Error) {
          console.log('error message: ', error3.message)
          return error3.message
        } else {
          console.log('unexpected error: ', error3)
          return 'An unexpected error occurred'
        }
      }

    // ================================================== response4: 24 hrs female confirmed true
    try {
      const response4 = await fetch('https://api.cron-job.org/jobs', {
          method: 'PUT',
          body: JSON.stringify({
            'job': {
              'url': 'https://www.antride.ca/carpools',
              'enabled': 'true',
              'saveResponses': true,
              "schedule":{"timezone":"America/Toronto","expiresAt": numExpiresAt,
              "minutes":[0],
              "hours":[0],
              "mdays":[twenty_four_hrs_before_cron_array[2]],
              "months":[twenty_four_hrs_before_cron_array[3]],"wdays":[-1]},
              'requestMethod': 1,
  
  
              'extendedData': {
                'body': JSON.stringify({
                 // TO DO
                'event_code': event_code,
                'password': '928dcfaaf338f43baac2de274e683c73cfa67de87a235ac55fafc55b09bc25d5', // event_code, password from the sample body
                'confirmed': true,
              'gender': 'Female'})}}
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer GDfDgvqyxL3A8BqVnGPsHm/pIQvcvJgPmo/0oMTzA/o='
          },
        })
    
        if (!response4.ok) {
          throw new Error(`Error! status: ${response4.status}`)
        }
    
        // const result: UpdateUserResponse
        const result = (await response4.json())
    
        console.log('result is: ', JSON.stringify(result, null, 4))
    
        // return result;
      } catch (error4) {
        if (error4 instanceof Error) {
          console.log('error message: ', error4.message)
          return error4.message
        } else {
          console.log('unexpected error: ', error4)
          return 'An unexpected error occurred'
        }
      }
  }
  createCronJob()

}
