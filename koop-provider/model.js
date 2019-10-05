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

let COUNTER = 0;
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

  // works
  // task.geojson.metadata.fields = [{
  //   "name": "OBJECTID",
  //   "type": "esriFieldTypeOID",
  //   "alias": "OBJECTID",
  //   "sqlType": "sqlTypeInteger",
  //   "domain": null,
  //   "defaultValue": null
  // }, {
  //   "name": "parent",
  //   "type": "esriFieldTypeString",
  //   "alias": "parent",
  //   "sqlType": "sqlTypeOther",
  //   "domain": null,
  //   "defaultValue": null,
  //   "length": 136
  // }];

  // doesn't work
  // task.geojson.metadata.drawingInfo = {
  //   "renderer": {
  //       "type": "simple",
  //       "symbol": {
  //           "color": [25, 172, 128, 161],
  //           "outline": {
  //               "color": [190, 190, 190, 105],
  //               "width": 0.5,
  //               "type": "esriSLS",
  //               "style": "esriSLSSolid"
  //           },
  //           "size": 7.5,
  //           "type": "esriSMS",
  //           "style": "esriSMSCircle"
  //       }
  //   },
  //   "labelingInfo": null
  // };

  // works
  // task.geojson.metadata.renderer = {
  //   "type": "simple",
  //   "symbol": {
  //       "color": [25, 172, 128, 161],
  //       "outline": {
  //           "color": [190, 190, 190, 105],
  //           "width": 0.5,
  //           "type": "esriSLS",
  //           "style": "esriSLSSolid"
  //       },
  //       "size": 7.5,
  //       "type": "esriSMS",
  //       "style": "esriSMSCircle"
  //   }
  // };

  execute(task).then(() => {
    let nFeatures = task.geojson.features.length;
    let nTotal = task.featureItems.length;
    let msg = "ServiceNow:"+task.table+" "+nFeatures+" (with location) out of "+nTotal;
    console.log(msg);
    callback(null,task.geojson);
  }).catch(ex => {
    console.error("Model::getData failed",ex);
    callback(ex);
  });
};

function appendFeatureItems(task,records) {
  // "sys_updated_on": "sys_created_on"
  const dateFields = ["sys_created_on","sys_updated_on","closed_at","opened_at",
    "resolved_at","due_date"]
  const numericFields = ["location.latitude","location.longitude","state",
    "impact","urgency","priority","severity","incident_state","sys_mod_count",
    "reopen_count"];
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

  records.forEach(record => {
    const properties = {};
    if (task.trackObjectIds) {
      Object.keys(record).some(key => {
        let v = record[key];
        if (key === "sys_id") {
          let objectId = task.objectIdsPerSysId[v];
          if (typeof objectId !== "number") {
            objectId = COUNTER++;
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
      let ok = true;

      let info = task.fieldsByName[key];
      if (info && info.internalType === "domain_id") {
        console.log(info.internalType,key,typeof v,v);
      }

      if (f === "location.name") {
        f = "location_name";
        v = loc;
      } else if (f === "location.parent.name") {
        ok = false;
      } else if (f === "location.parent.parent.name") {
        ok = false;
      }

      if (ok) {
        if (numericFields.indexOf(f) !== -1) {
          if (typeof v === "string") {
            if (v.length > 0) {
              v = Number(v);
            } else {
              v = null;
            }
          }
        } else if (dateFields.indexOf(f) !== -1) {
          if (typeof v === "string") {
            if (v.length > 0) {
              // Koop will transform
            } else {
              v = null;
            }
          }
        }

        f = f.replace(/\./g,"_");
        if (v && typeof v === "object" && v.link) {
          // f = f + "_key";
          // v = v.value || "";
          // properties[f] = v;
          properties[f] = "";
        } else {
          properties[f] = v;
          if (f === "location_name") {
            properties["location_unit_name"] = locUnit;
            properties["location_level_name"] = locLevel;
            properties["location_facility_name"] = locFacility;
          } else if (f === "state") {
            properties["state_label"] = codedValues.state[v] || "";
          } else if (f === "priority") {
            properties["priority_label"] = codedValues.priority[v] || "";
          }
        }
      }

    });

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

function collectFields(task,record) {
  const fieldNames = [], secondary = [];
  Object.keys(record).some(key => {
    fieldNames.push(key);
    let info = task.fieldsByName[key];
    if (info) {
      if (info.supported) {
        fieldNames.push(key);
      } else {
        //console.log("Field type not supported",key,info.alias,info.internalType);
      }
    } else {
      //console.log("No schema info for field:",key);
    }
    if (key === "location") {
      fieldNames.push("location.latitude");
      fieldNames.push("location.longitude");
      fieldNames.push("location.elevation");
      fieldNames.push("location.name");
      fieldNames.push("location.parent.name");
      fieldNames.push("location.parent.parent.name");
    } else if (key === "assigned_to") {
      fieldNames.push("assigned_to.name");
    } else if (key === "opened_by") {
      fieldNames.push("opened_by.name");
    } else if (key === "caller_id") {
      fieldNames.push("caller_id.name");
    }
  });
  task.sysparm_fields = fieldNames.join(",");
}

function execute(task) {
  const promise = new Promise((resolve,reject) => {
    readSchema(task).then(() => {
      return readFirstRecord(task);
    }).then(hasFirst => {
      if (hasFirst) return queryTable(task);
    }).then(() => {
      processFeatureItems(task);
      resolve();
    }).catch(ex => {
      reject(ex);
    })
  });
  return promise;
}

function makeEsriField(name,alias,type) {
  let field = {
    "name": name,
    "alias": alias,
    "type": type,
    "sqlType": "sqlTypeOther",
    "domain": null,
    "defaultValue": null
  };
  if (type === "esriFieldTypeString") {
    field.length = 128; // TODO?
  } else if (type === "esriFieldTypeDate") {
    field.length = 36; // TODO?
  }
  // "esriFieldTypeDouble" location.longitude/latitude/elevation
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

function readFirstRecord(task) {
  const promise = new Promise((resolve,reject) => {
    let url = task.servicenowUrl;
    if (!url.endsWith("/")) url += "/";
    url += "api/now/table/" + task.table;
    url += "?sysparm_limit=1&sysparm_offset=0";
    sendServiceNowGet(task,url).then(result => {
      let hasFirst = false;
      if (Array.isArray(result) && result.length > 0) {
        hasFirst = true;
        collectFields(task,result[0]);
      }
      resolve(hasFirst);
    }).catch(ex => {
      reject(ex);
    });
  });
  return promise;
}

function readSchema(task) {
  const promise = new Promise((resolve,reject) => {
    let url = task.servicenowUrl;
    if (!url.endsWith("/")) url += "/";
    url += "api/now/table/sys_dictionary";
    url += "?sysparm_query=name="+task.table+"^ORname=task"; // ^ORname=location";
    url += "&sysparm_fields=name,element,column_label,internal_type";
    sendServiceNowGet(task,url).then(result => {
      if (!result) console.error("Unable to read schema from",url);
      let fieldsByName = {};
      if (Array.isArray(result)) {
        result.forEach(row => {
          let table = row.name;
          let field = row.element;
          let alias = row.column_label;
          let internalType = row.internal_type && row.internal_type.value;
          let info = {
            table: table,
            field: field,
            alias: alias,
            internalType: internalType,
            supported: false
          };
          fieldsByName[field]= info;
          if (internalType === "glide_date_time") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"esriFieldTypeDate");
          } else if (internalType === "string") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"esriFieldTypeString");
          } else if (internalType === "integer") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"esriFieldTypeInteger");
          } else if (internalType === "GUID") {
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"esriFieldTypeString");
          } else if (internalType === "sys_class_name") {
            // values returned from the rest api are strings
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"esriFieldTypeString");
          } else if (internalType === "boolean") {
            // TODO? values returned from the rest api are strings
            info.supported = true;
            info.esriField = makeEsriField(field,alias,"esriFieldTypeString");
          } else if (internalType === "due_date") {
            info.supported = true;
            console.log("****",field,internalType);
            
          } else if (internalType === "domain_id") { // sys_domain
            // n/a
          } else if (internalType === "domain_path") { // sys_domain_path
            console.log("****",field,internalType);
          } else if (internalType === "reference") {
          } else if (internalType === "collection") {
          } else if (internalType === "glide_list") {
          } else if (internalType === "glide_duration") {
          } else if (internalType === "journal") {
          } else if (internalType === "journal_list") {
          } else if (internalType === "journal_input") {
          } else if (internalType === "timer") {
          } else if (internalType === "variables") {
          } else if (internalType === "user_input") {
          } else {
            console.log(row.name,row.element,internalType);
          }
        });
        //console.log(aliasesByFieldName);
      }
      task.fieldsByName = fieldsByName;
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
