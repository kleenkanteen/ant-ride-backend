import env from '#start/env'
import twilio from 'twilio';

let client: any
export function twilio_client() {
  const account_sid = env.get('TWILIO_ACCOUNT_SID')
  const auth_token = env.get('TWILIO_AUTH_TOKEN')

  client = twilio(account_sid, auth_token)
  return client
}

export async function send_sms(message: string, to?: string) {
  const twilo_number = env.get('TWILIO_NUMBER')
  const MODE = env.get('MODE')

  let phone_number
  if (MODE === 'DEV') {
    phone_number = env.get('PERSONAL_NUMBER')
  }
  if (MODE === 'PROD') {
    phone_number = "+1" + to
  }

  // https://www.twilio.com/docs/messaging/tutorials/how-to-send-sms-messages/node
  await client.messages.create({
    to: phone_number,
    from: twilo_number,
    body: message
  })
}

export async function send_confirmation_sms(event_name: string,
                                            event_code: string,
                                            edit_code: string,
                                            number: string) {
    send_sms(`Hello from ant ride.\
              \n\nTo confirm your participation in a carpool in the event titled "${event_name}",\
              please open this page to indicate your intent: https://antride.ca/confirm?event_code=${event_code}&edit_code=${edit_code}`,
              number)
}

export async function send_carpools_sms(unassigned_drivers: any,
                                        unassigned_riders: any,
                                        assigned_drivers: any,
                                        assigned_riders: any) {
  // send messages to everyone saying if they got matched or not, and all relevant details
  for (const [key, value] of Object.entries(unassigned_drivers)) {
    send_sms("Hello from ant ride.\n\nUnfortunately you were not able to be matched into a ride. You will have to drive by yourself.", key)
  }

  for (const [key, value] of Object.entries(unassigned_riders)) {
    send_sms("Hello from ant ride.\n\nUnfortunately you were not able to be matched into a ride. You will have to arrange your own transport.", key)
  }

  for (const [key, value] of Object.entries(assigned_drivers)) {
    let driver_details: any = value
    let rider_details = ""
    driver_details.riders.forEach((rider: any) => {
      rider_details += `Name: ${rider.name}\nAddress: ${rider.address}\nNumber: ${rider.number}\n\n`
    })

    send_sms(`Hello from ant ride.\n\nGood news! You were matched as a driver in a carpool. You will pickup ${Object.keys(driver_details.riders).length} people.\
              \n\nHere is the google maps link for the entire route: ${driver_details.route}.\
              \n\nHere is the name, address, and number for each of your riders:\n\n${rider_details}`, key)
  }

  for (const [key, value] of Object.entries(assigned_riders)) {
    // @ts-expect-error type
    let driver_details: any = value.driver
    send_sms(`Hello from ant ride.\
              \n\nGood news! You were matched as a rider in a carpool. Your driver's name is ${driver_details.name} and their number is ${driver_details.number}.\
              \n\nHere is the google maps link for the entire route: ${assigned_drivers[driver_details.number].route}.`, key)
  }
}
