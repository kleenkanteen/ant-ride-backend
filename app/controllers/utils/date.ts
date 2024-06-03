export function getCronSchedule(date: Date): string {
  const minutes = String(date.getUTCMinutes())
  const hours = String(date.getUTCHours())
  const dayOfMonth = String(date.getUTCDate())
  const month = String(date.getUTCMonth() + 1) // Months are zero-indexed

  // Cron format: minute hour dayOfMonth month dayOfWeek
  return `${minutes} ${hours} ${dayOfMonth} ${month} *`
}

export function formatDateToCronExpiresAt(date: Date): string {
  const pad = (num: number): string => num.toString().padStart(2, '0')

  const year = date.getUTCFullYear()
  const month = pad(date.getUTCMonth() + 1)
  const day = pad(date.getUTCDate())
  const hours = pad(date.getUTCHours())
  const minutes = pad(date.getUTCMinutes())
  const seconds = pad(date.getUTCSeconds())

  return `${year}${month}${day}${hours}${minutes}${seconds}`
}
