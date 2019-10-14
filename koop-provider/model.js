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
/*
  model.js

  This file is required. It must export a class with at least one public function called `getData`

  Documentation: http://koopjs.github.io/docs/usage/provider

*/
const request = require("request").defaults({gzip: true, json: true});
const config = require("config");

let COUNTER = 1;
let COUNTER_INCIDENT = 1;
let COUNTER_REQUEST = 1;
const OBJECTIDS_PER_SYSID_INCIDENT = {};
const OBJECTIDS_PER_SYSID_REQUEST = {};

function Model (koop) {};

Model.prototype.createKey = function (req) {
  let key = req.url.split('/')[1];
  if (req.params.host) key = [key, req.params.host].join('::');
  if (req.params.id) key = [key, req.params.id].join('::');
  if (typeof req.params.layer === "string" && req.params.layer.length > 0) {
    key = [key, req.params.layer].join('::');
  }
  return key;
};

// Public function to return data from the
// Return: GeoJSON FeatureCollection
//
// Config parameters (config/default.json)
// req.
//
// URL path parameters:
// req.params.host (if index.js:hosts true)
// req.params.id  (if index.js:disableIdParam false)
// req.params.layer
// req.params.method
Model.prototype.getData = function (req, callback) {
  //console.log("req.params.layer",req.params.layer,req.params);
  let v, renderer;

  let ttl = 600; // seconds
  v = config.servicenow.cacheTimeToLiveSeconds;
  if (typeof v === "number" || isFinite(v) || v >= 0) {
    ttl = v;
  }

  let maxFeaturesToCache = 10000;
  v = config.servicenow.maxFeaturesToCache;
  if (typeof v === "number" || isFinite(v) || v > 0) {
    maxFeaturesToCache = v;
  }

  let sysparm_limit = 10000;
  v = config.servicenow.sysparm_limit;
  if (typeof v === "number" || isFinite(v) || v > 0) {
    sysparm_limit = v;
  }

  let idField = null;
  let trackObjectIds = false;
  v = config.servicenow.idField;
  if (typeof v === "string" && v.length > 0) {
    idField = v;
  } else {
    v = config.servicenow.trackObjectIds;
    if (typeof v === "boolean" && v) {
      trackObjectIds = true;
      idField = "OBJECTID";
    }
  }

  const username = config.servicenow.username;
  const password = config.servicenow.password;
  const auth = {
    "username": username,
    "pass": password,
    "sendImmediately": true
  };

  const task = {
    servicenowUrl: config.servicenow.url,
    auth: auth,
    table: null,
    sysparm_limit: sysparm_limit,
    sysparm_offset: 0,
    maxFeaturesToCache: maxFeaturesToCache,
    recordCount: 0,
    featureItems: [],
    idField: idField,
    trackObjectIds: trackObjectIds,
    objectIdsPerSysId: {},
    geojson: {
      type: "FeatureCollection",
      features: [],
      ttl: ttl,
      metadata: {
        title: "Koop ServiceNow Provider",
        geometryType: "Point"
      },
    },
    resolve: null,
    reject: null
  };
  if (typeof task.idField === "string" && task.idField.length > 0) {
    task.geojson.metadata.idField = task.idField;
  }

  const reqid = req.params.id;
  if (reqid === "incidents") {
    task.table = "incident";
    task.geojson.metadata.name = "ServiceNow Incidents";
    task.geojson.metadata.description = "ServiceNow Incidents";
    task.geojson.metadata.displayField = "number";
    task.objectIdsPerSysId = OBJECTIDS_PER_SYSID_INCIDENT;
    renderer = config.servicenow.incidents && config.servicenow.incidents.renderer;
  } else if (reqid === "requests" || reqid === "sc_request") {
    task.table = "sc_request";
    task.geojson.metadata.name = "ServiceNow Requests";
    task.geojson.metadata.description = "ServiceNow Requests";
    task.geojson.metadata.displayField = "number";
    task.objectIdsPerSysId = OBJECTIDS_PER_SYSID_REQUEST;
    renderer = config.servicenow.requests && config.servicenow.requests.renderer;
  }
  if (!task.table) {
    const msg = "Only the incident and request tables are supported.";
    callback(new Error(msg));
    return;
  }
  if (renderer) task.geojson.metadata.renderer = renderer;

  execute(task).then(() => {
    let nFeatures = task.geojson.features.length;
    let nTotal = task.featureItems.length;
    //let msg = "ServiceNow:"+task.table+" "+nFeatures+" (with location) out of "+nTotal;
    //console.log(msg);
    callback(null,task.geojson);
  }).catch(ex => {
    console.error("Model::getData failed",ex);
    callback(ex);
  });
};

function appendFeatureItems(task,records) {
  const codedValues = {
    "state": {
      1: "New",
      2: "In Progress",
      3: "On Hold",
      4: "On Hold",
      5: "On Hold",
      6: "Resolved",
      7: "Closed",
      8: "Canceled"
    },
    "priority": {
      1: "Critical",
      2: "High",
      3: "Moderate",
      4: "Low",
      5: "Planning"
    }
  };
  const chkStr = (v) => {
    return (typeof v === "string" && v.length > 0);
  };

  records.forEach((record,recordIdx) => {
    const properties = {};

    if (task.trackObjectIds) {
      Object.keys(record).some(key => {
        let v = record[key];
        if (key === "sys_id") {
          let objectId = task.objectIdsPerSysId[v];
          if (typeof objectId !== "number") {
            if (task.table === "incident") {
              objectId = COUNTER_INCIDENT++;
            } else if (task.table === "sc_request") {
              objectId = COUNTER_REQUEST++;
            } else {
              objectId = COUNTER++;
            }
            task.objectIdsPerSysId[v] = objectId;
          }
          properties[task.idField] = objectId;
          return true;
        }
        return false;
      });
    }
    const geometry = makeGeometry(task,record);

    let loc = record["location.name"];
    let locP = record["location.parent.name"];
    let locPP = record["location.parent.parent.name"];
    let locUnit = locLevel = locFacility = null
    if (chkStr(loc) && chkStr(locP) && chkStr(locPP)) {
      locUnit = loc;
      locLevel = locP;
      locFacility = locPP;
    } else if (chkStr(loc) && chkStr(locP) && !chkStr(locPP)) {
      locUnit = null;
      locLevel = loc;
      locFacility = locP;
    } else if (chkStr(loc) && !chkStr(locP) && !chkStr(locPP)) {
      locUnit = null;
      locLevel = null;
      locFacility = loc;
    }

    Object.keys(record).forEach(key => {
      let f = key;
      let v = record[key];
      let info = task.fieldsByName[key];
      let ok = true;

      if (f === "location.name") {
        f = "location_name";
        properties["location_name"] = loc;
        properties["location_unit_name"] = locUnit;
        properties["location_level_name"] = locLevel;
        properties["location_facility_name"] = locFacility;
        return;
      } else if (f === "priority") {
        v = Number(v);
        if (codedValues.priority.hasOwnProperty(v)) {
          v = v + " - " + codedValues.priority[v];
        } else {
          if (isNaN(v)) v = "";
        }
        properties["priority_label"] = v;
        return;
      } else if (f === "state") {
        v = Number(v);
        if (codedValues.state.hasOwnProperty(v)) {
          v = v + " - " + codedValues.state[v];
        } else {
          if (isNaN(v)) v = "";
        }
        properties["state_label"] = v;
        return;
      }

      if (info && info.supported && info.esriField) {
        if (v === undefined) v = null;
        let t = info.internalType, et = info.esriField.type;

        if (et === "Integer" || et === "Double") {
          if (typeof v === "string") {
            v = v.trim();
            if (v.length > 0) {
              v = Number(v);
            } else {
              v = null;
            }
          } else if (typeof v !== "number") {
            v = null;
          }
          if (isNaN(v)) v = null;

        } else if (et === "Date") {
          if (typeof v === "string") {
            v = v.trim();
            if (v.length > 0) {
              if (v.length === 19) {
                v = v.replace(" ","T") + "Z";
              } else if (v.length === 10) {
                v = v + "T00:00:00Z";
              } else {
                // TODO ?
                console.log("Unexpected date format for internal_type",t," : ",v);
              }
            } else {
              v = null;
            }
          } else {
            v = null;
          }
        }

        properties[info.esriField.name] = v;
      }

    });

    if (!properties.hasOwnProperty("elevation")) properties.elevation = null;

    const featureItem = {
      feature: {
        type: "Feature",
        properties: properties,
        geometry: geometry
      }
    };
    task.featureItems.push(featureItem);
  });
}

function execute(task) {
  const promise = new Promise((resolve,reject) => {
    readSchema(task).then(() => {
      if (task.sysparm_fields) return queryTable(task);
    }).then(() => {
      processFeatureItems(task);
      resolve();
    }).catch(ex => {
      reject(ex);
    })
  });
  return promise;
}

function makeEsriField(name,alias,type,maxLength) {
  let field = {
    "name": name,
    "alias": alias,
    "type": type,
    "sqlType": "sqlTypeOther",
    "domain": null,
    "defaultValue": null,
    "editable": false,
    "nullable": true
  };
  if (type === "String") {
    field.length = 128;
    if (maxLength && maxLength > 0) field.length = maxLength;
  } else if (type === "Date") {
    field.length = 36;
  }
  return field;
}

function makeGeometry(task,record) {
  let x = record["location.longitude"];
  let y = record["location.latitude"];
  let elevation = record["location.elevation"];
  let z = 0;
  if (typeof x === "string" && x.length === 0) return null;
  if (typeof y === "string" && y.length === 0) return null;
  x = Number(x);
  y = Number(y);
  if (typeof x === "number" && isFinite(x) &&
      typeof y === "number" && isFinite(y)) {
    if (typeof elevation === "string" && elevation.length > 0) {
      elevation = Number(elevation);
    }
    if (typeof elevation === "number" && isFinite(elevation)) {
      z = elevation;
    }
    const geometry = {
      type: "Point",
      coordinates: [x,y,z]
    };
    return geometry;
  }
  return null;
}

function processFeatureItems(task) {
  task.featureItems.forEach(featureItem => {
    if (featureItem.feature.geometry) {
      task.geojson.features.push(featureItem.feature);
    }
  });
}

function queryTable(task) {
  const promise = new Promise((resolve,reject) => {
    let url = task.servicenowUrl;
    if (!url.endsWith("/")) url += "/";
    url += "api/now/table/" + task.table;
    url += "?sysparm_limit=" + task.sysparm_limit;
    url += "&sysparm_offset=" + task.sysparm_offset;
    url += "&sysparm_fields=" + encodeURIComponent(task.sysparm_fields);
    sendServiceNowGet(task,url).then(result => {
      if (Array.isArray(result) && result.length > 0) {
        let len = result.length;
        task.recordCount += len;
        appendFeatureItems(task,result);
        if (task.recordCount < task.maxFeaturesToCache && len === task.sysparm_limit) {
          task.sysparm_offset += len;
          resolve(queryTable(task));
        } else {
          resolve();
        }
      } else {
        resolve();
      }
    }).catch(ex => {
      reject(ex);
    });
  });
  return promise;
}

function readSchema(task) {
  let fields = [], fieldsByName = {};
  const addRef = (alias,name,type,esriName,esriType,fetch) => {
    let ref = makeRef(alias,name,type,esriName,esriType);
    fields.push(ref);
    fieldsByName[ref.field] = ref;
    return ref;
  };
  const makeRef = (alias,name,type,esriName,esriType,fetch) => {
    let ref = {
      table: "_ref_",
      field: name,
      alias: alias,
      internalType: type,
      supported: true,
      fetch: true
    };
    if (esriType) {
      ref.esriField = makeEsriField(esriName,alias,esriType);
    }
    if (typeof fetch === "boolean" && !fetch) ref.fetch = false;
    return ref;
  };
  const promise = new Promise((resolve,reject) => {
    let url = task.servicenowUrl;
    if (!url.endsWith("/")) url += "/";
    url += "api/now/table/sys_dictionary";
    url += "?sysparm_query=name="+task.table+"^ORname=task"; // ^ORname=imp_location";
    url += "&sysparm_fields=name,element,column_label,internal_type,max_length";
    sendServiceNowGet(task,url).then(result => {
      if (!result) console.error("Unable to read schema from",url);
      let esriStr = "String", esriDbl = "Double";
      if (Array.isArray(result)) {
        result.forEach(row => {
          let ref;
          let table = row.name;
          let field = row.element;
          let alias = row.column_label;
          let internalType = row.internal_type && row.internal_type.value;
          let maxLength = row.max_length;
          let info = {
            table: table,
            field: field,
            alias: alias,
            internalType: internalType,
            maxLength: maxLength,
            supported: false,
            fetch: true
          };
          fields.push(info);
          fieldsByName[field] = info;

          if (internalType === "boolean") {
            // TODO? values returned from the rest api are strings
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"String",maxLength);
          } else if (internalType === "currency") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"Double");
          } else if (internalType === "domain_path") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"String",maxLength);
          } else if (internalType === "due_date") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"Date");
          } else if (internalType === "glide_date") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"Date");
          } else if (internalType === "glide_date_time") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"Date");
          } else if (internalType === "GUID") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"String",maxLength);
          } else if (internalType === "integer") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"Integer");
            if (field === "priority") {
              ref = addRef(info.alias,field+"_label","string",field+"_label",esriStr);
              ref.fetch = false;
              info.esriField = null; // don't return priority, just priority_label
            } else if (field === "state") {
              ref = addRef(info.alias,field+"_label","string",field+"_label",esriStr);
              ref.fetch = false;
              info.esriField = null; // don't return state, just state_label
            }
          } else if (internalType === "journal_input") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"String",maxLength);
          } else if (internalType === "string") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"String",maxLength);
          } else if (internalType === "sys_class_name") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"String",maxLength);
          } else if (internalType === "timer") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"Date");
          } else if (internalType === "user_input") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"String",maxLength);
          } else if (internalType === "workflow") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"String",maxLength);

          } else if (internalType === "reference") {
            if (field === "location") {
              addRef(info.alias,field+".name","string",field+"_name",esriStr);
              addRef(null,field+".parent.name","string",field);
              addRef(null,field+".parent.parent.name","string");
              addRef("Unit","location_unit_name","string","location_unit_name",esriStr,false);
              addRef("Level","location_level_name","string","location_level_name",esriStr,false);
              addRef("Facility","location_facility_name","string","location_facility_name",esriStr,false);
              addRef("Latitude",field+".latitude","double","latitude",esriDbl);
              addRef("Longitude",field+".longitude","double","longitude",esriDbl);
              addRef("Elevation",field+".elevation","double","elevation",esriDbl);
            } else if (field === "assigned_to") {
              addRef(info.alias,field+".name","string",field+"_name",esriStr);
            } else if (field === "opened_by") {
              addRef(info.alias,field+".name","string",field+"_name",esriStr);
            } else if (field === "caller_id") {
              addRef(info.alias,field+".name","string",field+"_name",esriStr);
            } else {
              let refValue = row.reference && row.reference.value;
              if (refValue === "sys_user") {
                addRef(info.alias,field+".name","string",field+"_name",esriStr);
              } else {
                //console.log("Unsupported reference:",table,field,refValue);
              }
            }

          } else if (internalType === "domain_id") {
          } else if (internalType === "collection") {
          } else if (internalType === "glide_duration") {
            // some samples for business_duration:
            //   1970-01-01 08:00:00, 1970-01-20 21:55:00, 1970-01-26 13:49:12
          } else if (internalType === "glide_list") {
          } else if (internalType === "journal") {
          } else if (internalType === "journal_list") {
          } else if (internalType === "variables") {

          } else {
            console.log("Unknown internal_type:",row.name,row.element,internalType);
          }
        });
      }

      fields.sort((a,b) => {
        if (a.field < b.field) return -1;
        else if (a.field > b.field) return 1;
        else return 0;
      });

      let fieldNames = [], esriFields = [];
      if (typeof task.idField === "string" &&
          task.idField.toUpperCase() === "OBJECTID") {
        esriFields.push({
          "name": task.idField,
          "alias": task.idField,
          "type": "esriFieldTypeOID",
          "sqlType": "sqlTypeInteger",
          "domain": null,
          "defaultValue": null
        });
      }
      fields.forEach(f => {
        if (f.supported) {
          if (f.fetch) fieldNames.push(f.field);
          if (f.esriField) esriFields.push(f.esriField);
        }
      });
      task.fieldsByName = fieldsByName;
      task.sysparm_fields = fieldNames.join(",");
      task.geojson.metadata.fields = esriFields;
      resolve();
    }).catch(ex => {
      reject(ex);
    });
  });
  return promise;
}

function sendServiceNowGet(task,url) {
  const promise = new Promise((resolve,reject) => {
    const options = {
      url: url,
      auth: task.auth,
      headers: {
        "User-Agent": "request",
        "Accept": "application/json"
      }
    };
    //console.log(url);
    request.get(options,(err,res,json) => {
      //console.log("err",err)
      //console.log("res",res)
      //console.log("json",json)
      if (err) {
        reject(err);
      } else if (json && json.error) {
        console.log("Error querying ServiceNow table:",options.url);
        console.error(json.error);
        let msg = json.error.message || "Error querying table.";
        reject(new Error(msg));
      } else  {
        resolve(json && json.result);
      }
    });
  });
  return promise;
}

module.exports = Model
