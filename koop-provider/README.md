# Koop Provider for ServiceNow

## Configure your ServiceNow instance
- edit config/default.json , enter your ServiceNow url and credentials

## Test it out
Run server:
- `npm install`
- `npm start`

Example API Querys:
- `curl localhost:8080/servicenow/rest/services/incidents/FeatureServer/0/query`
- `curl localhost:8080/servicenow/rest/services/requests/FeatureServer/0/query`

### When registering layers with ArcGIS Online or Enterprise:
- `https://host/servicenow/rest/services/incidents/FeatureServer`
- `https://host/servicenow/rest/services/requests/FeatureServer`
