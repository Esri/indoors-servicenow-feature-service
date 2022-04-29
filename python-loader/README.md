# ServiceNow Location Loader

## Summary

Loads ServiceNow location model with coordinate locations for each facility, all
levels for each facility and all units for each level and models the hierarchy
relationship between the units, levels and facilities.

## Usage

-   The tool accepts Facilities, Levels and Units layers as input.

-   The person accessing the supplied ServiceNow rest endpoint must have
    Read/Write privileges in the ServiceNow cmn_location table.

-   The tool loads the ServiceNow location model with location name and centroid
    latitude and longitude coordinate information for the units, levels and
    facilities.

-   The Levels layer should contain a FACILITY_ID field that associates that
    level with a feature in the Facilities layer.

-   The Units layer should contain a LEVEL_ID field that associates that unit
    with a feature in the Levels layer.
    
<!---may need to remove the following two bullets or, at minimum modify them since these fields are no longer created in the Indoors model.--->
-   The tool populates the address information along with coordinates, if it is
    available in the data. 
    
    To populate address information it must be contained in fields with the following field names:
    NAME, ADDRESS, LOCALITY, PROVINCE, POSTAL_CODE, COUNTRY
    
    The tool will load the parent facility’s address for all
    the spaces contained within.
    
-   The following fields will be populated in the ServiceNow location table:
    Name, Street, City, State / Province, Zip / Postal Code, Country, Parent,
    Latitude, Longitude. 

-   ServiceNow is expecting coordinates in a geographic coordinate system. Data
    in other coordinate systems will be projected to Geographic by the tool.

## Syntax

ServiceNowLocationLoader (in_facility_layer, in_level_layer, in_unit_layer,
{keepDuplicates}, in_servicenow_url, {in_username}, {in_password})

| Parameter                 | Explanation                                                                                                                | Data Type     |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------|---------------|
| in_facility_layer         | Facilities Layer of the ArcGIS Indoors Information Model.                                                                  | Feature Layer |
| in_level_layer            | Levels Layer of the ArcGIS Indoors Information Model.                                                                      | Feature Layer |
| in_unit_layer             | Units Layer of the ArcGIS Indoors Information Model.                                                                       | Feature Layer |
| keepDuplicates (Optional) | Specifies whether to load duplicate locations in ServiceNow location model or overwrite existing locations.                | Boolean       |
| | - KEEP_DUPLICATE_VALUES - Duplicates are loaded if location already exists in ServiceNow |
| | - NO_DUPLICATE_VALUES - Updates the location if already exists in ServiceNow |
| in_servicenow_url         | URL of the ServiceNow REST Table API endpoint. Note: The tool has been certified against the Madrid version of ServiceNow. | String        |
| in_username (Optional)    | User ID as required by ServiceNow Rest endpoint.                                                                           | String        |
| in_password (Optional)    | Password as required by ServiceNow Rest endpoint.                                                                          | String Hidden |

## Code samples

### ServiceNowLocationLoader example 1 (Python window)

The following code sample demonstrates how to use the tool to load data in
ServiceNow location model with duplicates.

```
import arcpy
arcpy.ImportToolbox("C:\\Projects\\GitHub\\arcgis-indoors\\integrations\\servicenow\\Python Tool\\ServiceNow.pyt")
arcpy.ServiceNow.ServiceNowLocationLoader("Facilities", "Levels", "Units",
"KEEP_DUPLICATE_VALUES", "https://servicenow-server.com/api/now/table/cmn_location", "userid", "*****")
```

### ServiceNowLocationLoader example 2 (stand-alone script)  
The following stand-alone script demonstrates how to use the tool to load data
in ServiceNow location model without duplicates.

```
# Name: ServiceNowLocationLoader_example2.py
# Description: The following stand-alone script demonstrates the usage of the tool to load data in ServiceNow location model without duplicates.

# Imports
import arcpy
arcpy.ImportToolbox("C:/Projects/GitHub/arcgis-indoors/integrations/servicenow/Python Tool/ServiceNow.pyt")

# Set variables
in_facility_layer = "C:/Indoors/AIIM_1_0_v1.gdb/AIIM/Facilities"
in_level_layer = "C:/Indoors/AIIM_1_0_v1.gdb/AIIM/Levels"
in_unit_layer = "C:/Indoors/AIIM_1_0_v1.gdb/AIIM/Units"
keepDuplicates = "NO_DUPLICATE_VALUES"
in_servicenow_url = "https://servicenow-server.com/api/now/table/cmn_location"
in_username = "userid"
in_password = "*****"

# Execute ServiceNowLocationLoader
arcpy.ServiceNow.ServiceNowLocationLoader(in_facility_layer, in_level_layer, in_unit_layer, keepDuplicates, in_servicenow_url, in_username, in_password)
```

## Environments

This tool does not use any geoprocessing environments.

## How to deploy tool into ArcGIS Pro
1. Download tool from GitHub repo.
2. See [Connect to a toolbox](https://pro.arcgis.com/en/pro-app/help/projects/connect-to-a-toolbox.htm) and follow the steps to either "Access a toolbox in a folder" or "Add a toolbox directly to the project":


-----

