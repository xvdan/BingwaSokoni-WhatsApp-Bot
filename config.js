const fs = require("fs-extra")

if (fs.existsSync(".env")) {
    require("dotenv").config({ path: __dirname + "/.env" })
}

module.exports = {

    SESSION_ID: process.env.SESSION_ID || "",

    MODE: process.env.MODE || "public",

    TIME_ZONE: process.env.TIME_ZONE || "Africa/Nairobi",

    AUTO_READ_STATUS: process.env.AUTO_READ_STATUS || "true",

    AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS || "true",

    DATABASE_URL: process.env.DATABASE_URL || ""

}