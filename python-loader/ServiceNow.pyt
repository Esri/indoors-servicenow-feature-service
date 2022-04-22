# -*- coding: utf-8 -*-
# Copyright 2019 Esri.
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#        http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.

import arcpy
import requests
import json
import sys
from urllib.parse import urlparse
import urllib.parse

class AuthError(Exception):
    pass

class Toolbox(object):
    def __init__(self):
        """Define the toolbox (the name of the toolbox is the name of the
        .pyt file)."""
        self.label = "ServiceNow"
        self.alias = "ServiceNow"

        # List of tool classes associated with this toolbox
        self.tools = [ServiceNowLocationLoader]

class ServiceNowLocationLoader(object):
    def __init__(self):
        """Define the tool (tool name is the name of the class)."""
        self.label = "ServiceNow Location Loader"
        self.description = "ServiceNow Location Loader"
        self.canRunInBackground = False
        self.data = {}

        # AIIM details
        self.facilities_fields = ["NAME", "ADDRESS", "LOCALITY", "PROVINCE", "POSTAL_CODE", "COUNTRY"]
        self.levels_fields = ["NAME", "FACILITY_NAME"]
        self.units_fields = ["NAME", "LEVEL_NAME", "FACILITY_NAME"]
        self.shape_fields = ["SHAPE@X", "SHAPE@Y"]
        self.facilities_fc = "Facilities"
        self.levels_fc = "Levels"
        self.units_fc = "Units"

        # Other params
        self.spatial_reference_id = 4326
        # Cursor sort by field index for facility
        self.fac_sort_index = 2
        # Cursor sort by field index for levels/units
        self.other_sort_index = 3
        self.address_list = []

        # ServiceNow parameters
        self.query_param = "sysparm_query"
        self.field_param = "sysparm_fields"
        self.limit_param = "sysparm_limit"
        self.limit_value = "10000"
        self.name_field = "name"
        self.full_name_field = "full_name"
        self.parent_field = "parent"
        self.sys_id_field = "sys_id"
        self.delimiter = "/"
        # ServiceNow cmn_location table fields
        self.longitude = "longitude"
        self.latitude = "latitude"
        self.name = "name"
        self.parent = "parent"
        self.street = "street"
        self.city = "city"
        self.state = "state"
        self.zip = "zip"
        self.country = "country"

        # Validation Messages
        self.api_error = "Unable to connect to ServiceNow Rest API"
        self.invalid_input = "Input layer or feature class does not exist"

    def getParameterInfo(self):

        """Define parameter definitions"""
        facility_layer = arcpy.Parameter(
            displayName="Facilities Layer",
            name="in_facility_layer",
            datatype="GPFeatureLayer",
            parameterType="Required",
            direction="Input"
        )
        facility_layer.filter.list = ['Polygon']
        level_layer = arcpy.Parameter(
            displayName="Levels Layer",
            name="in_level_layer",
            datatype="GPFeatureLayer",
            parameterType="Required",
            direction="Input"
        )
        level_layer.filter.list = ['Polygon']
        unit_layer = arcpy.Parameter(
            displayName="Units Layer",
            name="in_unit_layer",
            datatype="GPFeatureLayer",
            parameterType="Required",
            direction="Input"
        )
        unit_layer.filter.list = ['Polygon']
        keep_duplicate = arcpy.Parameter(
            displayName="Keep Duplicate Values",
            name="keepDuplicates",
            datatype="GPBoolean",
            parameterType="Optional",
            direction="Input"
        )
        keep_duplicate.filter.list = ['KEEP_DUPLICATE_VALUES', 'NO_DUPLICATE_VALUES']
        keep_duplicate.value = 'NO_DUPLICATE_VALUES'

        servicenow_url = arcpy.Parameter(
            displayName="ServiceNow Rest URL",
            name="in_servicenow_url",
            datatype="GPString",
            parameterType="Required",
            direction="Input"
        )
        user_id = arcpy.Parameter(
            displayName="ServiceNow Username",
            name="in_username",
            datatype="GPString",
            parameterType="Optional",
            direction="Input"
        )
        pwd = arcpy.Parameter(
            displayName="ServiceNow Password",
            name="in_password",
            datatype="GPStringHidden",
            parameterType="Optional",
            direction="Input"
        )
        return [facility_layer, level_layer, unit_layer, keep_duplicate, servicenow_url, user_id, pwd]

    def isLicensed(self):
        """Set whether tool is licensed to execute."""
        return True

    def updateParameters(self, parameters):
        """Modify the values and properties of parameters before internal
        validation is performed.  This method is called whenever a parameter
        has been changed."""
        return

    def updateMessages(self, parameters):
        """Modify the messages created by internal validation for each tool
        parameter.  This method is called after internal validation."""

        # Workspace, Feature Class, Fields and No record Validation
        facilities_layer = parameters[0].value
        if facilities_layer:
            self.validateInput(facilities_layer, parameters[0], self.facilities_fc, self.facilities_fields)

        levels_layer = parameters[1].value
        if levels_layer:
            self.validateInput(levels_layer, parameters[1], self.levels_fc, self.levels_fields)

        units_layer = parameters[2].value
        if units_layer:
            self.validateInput(units_layer, parameters[2], self.units_fc, self.units_fields)

        # ServiceNow URL validation
        servicenow_url = parameters[4].valueAsText
        if servicenow_url:
            parse_result = urlparse(servicenow_url)
            scheme = parse_result[0]
            netloc = parse_result[1]
            if not scheme or not netloc:
                parameters[4].setErrorMessage("Invalid URL")
        return

    def execute(self, parameters, messages):
        """The source code of the tool."""
        try:
            # ServiceNow Details
            servicenow_url = parameters[4].valueAsText
            user_id = parameters[5].valueAsText
            pwd = parameters[6].valueAsText

            # Overwrite/Keep duplicates
            keep_duplicate = parameters[3].value

            # Processing Facilities
            facilities_layer = parameters[0].value
            self.generateJSON(facilities_layer, self.shape_fields + self.facilities_fields, servicenow_url, user_id, pwd, keep_duplicate)

            # Processing Levels
            levels_layer = parameters[1].value
            self.generateJSON(levels_layer, self.shape_fields + self.levels_fields, servicenow_url, user_id, pwd, keep_duplicate)

            # Processing Units
            units_layer = parameters[2].value
            self.generateJSON(units_layer, self.shape_fields + self.units_fields, servicenow_url, user_id, pwd, keep_duplicate)
            return

        except Exception as ex:
            arcpy.AddError(str(ex))
            sys.exit(0)

    # To post (create records) in servicenow
    def postData(self, servicenow_url, user_id, pwd, json_data):
        try:
            # Setting Header and post request
            headers = {"Content-Type": "application/json", "Accept": "application/json"}
            response = requests.post(servicenow_url, auth=(user_id, pwd), headers=headers, data=json_data)

            if response.status_code and response.status_code != 201:
                raise AuthError
            return

        except AuthError as ex:
            pymsg = "Status: " + str(response.status_code) + "\n Error: " + str(response.json()["error"]["message"])
            arcpy.AddError(pymsg)
            sys.exit(0)
        except Exception as ex:
            arcpy.AddError(self.api_error)
            arcpy.AddError(str(ex))
            sys.exit(0)

    # To get records from servicenow api
    def getData(self, servicenow_url, user_id, pwd):
        try:
            # Setting Header and get request
            headers = {"Content-Type": "application/json", "Accept": "application/json"}
            response = requests.get(servicenow_url, auth=(user_id, pwd), headers=headers)

            if response.status_code and response.status_code != 200:
                raise AuthError
            data = response.json()
            return data

        except AuthError as ex:
            pymsg = "Status: " + str(response.status_code) + "\n Error: " + str(response.json()["error"]["message"])
            arcpy.AddError(pymsg)
            sys.exit(0)
        except Exception as ex:
            arcpy.AddError(self.api_error)
            arcpy.AddError(str(ex))
            sys.exit(0)

    # To update location in servicenow. Using PATCH request instead of PUT to avoid passing the entire payload
    def updateData(self, servicenow_url, user_id, pwd, json_data):
        try:
            # Setting Header and Patch request.
            headers = {"Content-Type": "application/json", "Accept": "application/json"}
            response = requests.patch(servicenow_url, auth=(user_id, pwd), headers=headers, data=json_data)

            if response.status_code and response.status_code != 200:
                raise AuthError
            return

        except AuthError as ex:
            pymsg = "Status: " + str(response.status_code) + "\n Error: " + str(response.json()["error"]["message"])
            arcpy.AddError(pymsg)
            sys.exit(0)
        except Exception as ex:
            arcpy.AddError(self.api_error)
            arcpy.AddError(str(ex))
            sys.exit(0)

    def generateJSON(self, layer, fields, servicenow_url, user_id, pwd, keep_duplicate):
        try:
            query_data = False
            parent_facility = ""
            parent_level = ""
            unit_full_name = ""
            desc_layer = arcpy.Describe(layer)
            arcpy.AddMessage("\nProcessing " + desc_layer.name)

            # Constructing Get Request
            # Outfields
            query_param = "?" + self.field_param + "=" + self.full_name_field + "," + self.sys_id_field + "&" + self.limit_param + "=" + self.limit_value
            # Encoding URL
            encoded_query = urllib.parse.quote(query_param, safe='?&=')
            get_data = self.getData(servicenow_url + encoded_query, user_id, pwd)
            # Returning value for result key in dict data
            get_data_result = get_data["result"]

            # Set spatial reference based on declared wkid
            spatial_reference = arcpy.SpatialReference(self.spatial_reference_id)
            with arcpy.da.SearchCursor(layer, fields, None, spatial_reference) as cursor:
                # Sorting cursor elements based on fields derived to sort
                cursor = sorted(cursor, key=lambda sort_feature: sort_feature[self.fac_sort_index] if desc_layer.name.lower() == self.facilities_fc.lower() else sort_feature[self.other_sort_index])
                if len(cursor) > 0:
                    for feature in cursor:
                        address_dict = {}

                        # Code block for Facilities
                        if desc_layer.name.lower() == self.facilities_fc.lower():
                            facility_name = feature[2]
                            street = feature[3]
                            city = feature[4]
                            state = feature[5]
                            zip_code = feature[6]
                            country = feature[7]
                            address_dict['NAME'] = facility_name
                            address_dict['ADDRESS'] = [street, city, state, zip_code, country]
                            self.address_list.append(address_dict)
                            unit_full_name = facility_name
                            arcpy.AddMessage("--Processing {0} Facility".format(unit_full_name))
                            self.data[self.parent] = ""
                            self.createDict(feature, address_dict['ADDRESS'])

                        # Code block for Levels
                        elif desc_layer.name.lower() == self.levels_fc.lower():
                            level_name = feature[2]
                            facility_name = feature[3]
                            feature_list = [facility_name, level_name]
                            parent_full_name = facility_name
                            full_name = self.delimiter.join(filter(None, feature_list[0:2]))
                            arcpy.AddMessage("--Processing {0} Level".format(full_name))
                            if not query_data:
                                # Querying ServiceNow location data
                                get_data = self.getData(servicenow_url + encoded_query, user_id, pwd)
                                # Returning value for result key in dict data
                                get_data_result = get_data["result"]
                                query_data = True
                            # Check if parent exists
                            unit_full_name = self.queryParent(level_name, facility_name, parent_full_name, full_name, get_data_result, layer)

                            # Adding Address Information
                            if self.address_list:
                                address = [item for item in self.address_list if item["NAME"] == facility_name]
                                if address:
                                    full_address = (address[0])['ADDRESS']
                                    self.createDict(feature, full_address)
                                else:
                                    self.createDict(feature, address="")
                            else:
                                self.createDict(feature, address="")

                        # Code Block for Units
                        elif desc_layer.name.lower() == self.units_fc.lower():
                            facility_name = feature[4]
                            level_name = feature[3]
                            unit_name = feature[2]
                            feature_list = [facility_name, level_name, unit_name]
                            parent_name = level_name if level_name else facility_name
                            parent_full_name = self.delimiter.join(filter(None, feature_list[0:2]))
                            full_name = self.delimiter.join(filter(None, feature_list[0:3]))

                            # Displaying processing message on facility change only
                            if facility_name and parent_facility != facility_name:
                                arcpy.AddMessage("--Processing Facility {0} Units".format(feature[4]))
                            # Displaying processing message on level change only
                            if level_name and parent_level != level_name:
                                arcpy.AddMessage("----Processing {0} Units".format(feature[3]))
                            parent_facility = facility_name
                            parent_level = level_name

                            # Get latest ServiceNow location data
                            if not query_data:
                                # Querying ServiceNow location data
                                get_data = self.getData(servicenow_url + encoded_query, user_id, pwd)
                                # Returning value for result key in dict data
                                get_data_result = get_data["result"]
                                query_data = True
                            # Check if parent exists
                            unit_full_name = self.queryParent(unit_name, parent_name, parent_full_name, full_name, get_data_result, layer)

                            # Adding Address Information
                            if self.address_list:
                                address = [item for item in self.address_list if item["NAME"] == facility_name]
                                if address:
                                    full_address = (address[0])['ADDRESS']
                                    self.createDict(feature, full_address)
                                else:
                                    self.createDict(feature, address="")
                            else:
                                self.createDict(feature, address="")

                        json_data = json.dumps(self.data)
                        if keep_duplicate is False:
                            # Adding validation for dict keys if location table is empty
                            if self.full_name_field in get_data_result[0] and self.sys_id_field in get_data_result[0]:
                                result = [item for item in get_data_result if item[self.full_name_field] == unit_full_name]
                                if result:
                                    sys_id = (result[0])["sys_id"]
                                    self.updateData(servicenow_url + "/" + sys_id, user_id, pwd, json_data)
                                else:
                                    self.postData(servicenow_url, user_id, pwd, json_data)
                            else:
                                self.postData(servicenow_url, user_id, pwd, json_data)
                        else:
                            self.postData(servicenow_url, user_id, pwd, json_data)
                    self.data = {}
                else:
                    arcpy.AddWarning("No records found in {0}".format(desc_layer.name))
            return

        except Exception as ex:
            arcpy.AddError(str(ex))
            sys.exit(0)

    # Constructing response dict
    def createDict(self, feature, address):
        self.data[self.longitude] = str(feature[0])
        self.data[self.latitude] = str(feature[1])
        self.data[self.name] = feature[2]
        if address:
            self.data[self.street] = address[0]
            self.data[self.city] = address[1]
            self.data[self.state] = address[2]
            self.data[self.zip] = address[3]
            self.data[self.country] = address[4]
        return

    # To Validate parent items to build/maintain location hierarchy in ServiceNow
    def queryParent(self, name, parent_name, parent_full_name, full_name, get_data_result, layer):
        try:
            if parent_full_name:
                # Checking if parent feature exists on ServiceNow
                if self.full_name_field in get_data_result[0]:
                    result = [item for item in get_data_result if item[self.full_name_field] == parent_full_name]
                    if result:
                        self.data[self.parent] = parent_name
                        return full_name
                    else:
                        self.data[self.parent] = ""
                        arcpy.AddWarning("{0} does not have a parent feature in ServiceNow".format(full_name))
                        return name
                else:
                    self.data[self.parent] = ""
                    arcpy.AddWarning("{0} does not have a parent feature in ServiceNow".format(full_name))
                    return name
            else:
                self.data[self.parent] = ""
                # Displaying warning if parent missing
                arcpy.AddWarning("{0} does not have a parent feature in {1} input layer".format(full_name, arcpy.Describe(layer).name))
                return name

        except Exception as ex:
            arcpy.AddError(str(ex))

    # To validate input fields
    def validateInput(self, layer, parameter, layer_fc, layer_fields):
        try:
            if arcpy.Exists(layer):
                if arcpy.Describe(layer).name.lower() == layer_fc.lower():
                    if self.fieldsExist(layer, layer_fields, parameter) is True:
                        # Setting up warning if zero records in feature layer
                        feature_count = arcpy.GetCount_management(layer)
                        if feature_count == 0:
                            parameter.setWarningMessage("No records in {0}.".format(layer_fc))
                else:
                    parameter.setErrorMessage("Input {0} layer or feature class.".format(layer_fc))
            else:
                parameter.setErrorMessage(self.invalid_input)
            return

        except Exception as ex:
            arcpy.AddError(str(ex))

    # To validate if a field exists in the supplied layer or feature class
    def fieldsExist(self, layer, field_list, parameter):
        try:
            if field_list is not None:
                fields = arcpy.ListFields(layer)
                field_names = [field.name.lower() for field in fields]
                for field_name in field_list:
                    if field_name.lower() not in field_names:
                        parameter.setErrorMessage("{0} field not found in {1}.".format(field_name, arcpy.Describe(layer).name))
                        return False
            return True
        except Exception as ex:
            arcpy.AddError(str(ex))
