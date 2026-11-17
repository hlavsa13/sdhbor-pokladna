import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

// Týdenní záloha transakcí na Google Drive – každou neděli ve 3:00 UTC (4:00/5:00 našeho času).
// Potřebuje proměnné GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
// a GOOGLE_DRIVE_FOLDER_ID; bez nich se záloha jen přeskočí a zapíše do logu.
crons.weekly(
  "zaloha-google-drive",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 },
  internal.googleDrive.syncToGoogleDrive,
  {}
)

export default crons
