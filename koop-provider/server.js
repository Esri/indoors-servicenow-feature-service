/* Copyright 2019 Esri
 *
 * Licensed under the Apache License Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// clean shutdown on `cntrl + c`
process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))

// Initialize Koop
const Koop = require('koop')
const koop = new Koop()

// Install the Provider
const provider = require('./')
koop.register(provider)

if (process.env.DEPLOY === 'export') {
  module.exports = koop.server
} else {
  // Start listening for HTTP traffic
  const config = require('config')
  // Set port for configuration or fall back to default
  const port = process.env.PORT || config.port || 8080
  koop.server.listen(port)

  const message = `

  Koop Provider listening on ${port}
  For more docs visit: https://koopjs.github.io/docs/usage/provider
  To find providers visit: https://www.npmjs.com/search?q=koop+provider

  Try it out in your browser: http://localhost:${port}/${provider.name}/FeatureServer/0/query
  Or on the command line: curl --silent http://localhost:${port}/${provider.name}/FeatureServer/0/query?returnCountOnly=true

  Press control + c to exit
  `
  console.log(message)
}
