# Koop Provider for ServiceNow

Koop is a Node.js web-server that is used to transform ServiceNow location information to a point feature layer, which can be used to provide ServiceNow incidents and requests location on an ArcGIS platform.

For more information on system requirements, see [What is Koop?](https://koopjs.github.io/docs/basics/what-is-koop)

Koop uses ServiceNow table API to perform read operations on the tables. For more information on capabilities and supported operations, see [Table API](https://docs.servicenow.com/bundle/madrid-application-development/page/integrate/inbound-rest/concept/c_TableAPI.html).

## Configure your ServiceNow instance

Clone the indoors-servicenow-feature-service repository from GitHub on your machine and edit the following properties in koop-provider/config/default.json

  | Name                   | Type        | Summary                                                                                                                                                                                                                                                                                                                                                           |
|------------------------|-------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `url`                      | `String`    | URL of the ServiceNow instance. |
| `cacheTimeToLiveSeconds`   | `Integer`   | (Optional) Time duration in seconds to keep the cached feature layer data in memory. The default value is 600.|
| `maxFeaturesToCache`       | `Integer`   | (Optional) Maximum features which can be cached in the memory. The default value is 10000. |
| `idField`                  | `String`    | (Optional) Unique ID field name for an ArcGIS feature layer. The default value is OBJECTID if trackObjectIds is True. |
| `trackObjectIds`           | `Boolean`   | (Optional) Indicates whether to assign a Unique ID for each unique sys_id. Mapping will be tracked for the life of the Node process. Subsequent requests for the same ServiceNow records will return consistent Unique IDs. The default value is False. |
| `username`                 | `String`    | The ServiceNow username. |
| `password`                 | `String`    | The ServiceNow password |

Following tables in ServiceNow are supported through a feature service. The location field on incident and request forms is a referenced field to the cmn_location table from where the location coordinates are fetched through rest API.

  - `For Incidents: incident`
  - `For Requests: sc_request`

## Deploy the ServiceNow feature service

Open a command prompt and change the working directory to newly cloned koop-provider folder.
- `cd koop-provider`

Install dependencies.
- `npm install`

Start the server
- `npm start`

### Examples

Feature service:
- `localhost:8080/servicenow/rest/services/incidents/FeatureServer`
- `localhost:8080/servicenow/rest/services/requests/FeatureServer`

Example API querys:
- `localhost:8080/servicenow/rest/services/incidents/FeatureServer/0/query`
- `localhost:8080/servicenow/rest/services/requests/FeatureServer/0/query`

If the HTTPS protocol is required for your organization, IIS web server can be used to enable HTTPS and re-direct the requests from node.js server to HTTPS using the IIS URL Rewrite Module. For more information on how to install and configure the URL rewrite property on IIS web server, see [Creating Rewrite Rules for the URL Rewrite Module](https://docs.microsoft.com/en-us/iis/extensions/url-rewrite-module/creating-rewrite-rules-for-the-url-rewrite-module).

## Licensing

Copyright 2019 Esri
Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

A copy of the license is available in the repository's LICENSE.txt file.
