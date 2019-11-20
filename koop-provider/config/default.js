/*

For the password, you can set it directly in the json structure below:
    "password": "mypassword",

// Or obtain it from an environment variable
let password = process.env.SERVICENOW_PASSWORD;

// Or from a text file
const fs = require("fs");
let password = fs.readFileSync("/myfile.txt");

// Or from a json file
let password = JSON.parse(fs.readFileSync("/myfile.json")).password;

Then in the json structure below use:
    "password": password,

*/

const config = {

  "servicenow": {
    "url": "https://example.service-now.com",
    "username": "",
    "password": "",
    "portalTokenAuthentication": {
      "portalUrl": "",
      "tokenServicesUrl": ""
    },
    "cacheTimeToLiveSeconds": 10,
    "maxFeaturesToCache": 10000,
    "idField": null,
    "trackObjectIds": true,
    "incidents": {
      "renderer": {
        "type": "simple",
        "symbol": {
          "color": [45, 172, 128, 161],
          "outline": {
            "color": [190, 190, 190, 105],
            "width": 0.5,
            "type": "esriSLS",
            "style": "esriSLSSolid"
          },
          "size": 7.5,
          "type": "esriSMS",
          "style": "esriSMSCircle"
        }
      }
    },
    "requests": {
      "renderer": {
        "type": "simple",
        "symbol": {
          "color": [45, 172, 128, 161],
          "outline": {
            "color": [190, 190, 190, 105],
            "width": 0.5,
            "type": "esriSLS",
            "style": "esriSLSSolid"
          },
          "size": 7.5,
          "type": "esriSMS",
          "style": "esriSMSCircle"
        }
      }
    }
  }

};

module.exports = config;
