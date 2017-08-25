/*
  model.js

  This file is required. It must export a class with at least one public function called `getData`

  Documentation: http://koopjs.github.io/docs/specs/provider/
*/
const request = require('request').defaults({gzip: true, json: true})
const async = require('async')
const config = require('config')
const strSub = require('string-substitute')
const geomerge = require('@mapbox/geojson-merge')
//const fs = require('fs')
//const _ = require('lodash')
const fSrvc = require('featureservice')
const terraAGS = require('terraformer-arcgis-parser')


function Model (koop) {}

// This is the only public function you need to implement
Model.prototype.getData = function (req, callback) {
  // Call the remote API with our developer key
  //

  //const key = config.trimet.key
  /*
  request(`https://developer.trimet.org/ws/v2/vehicles/onRouteOnly/false/appid/${key}`, (err, res, body) => {
    if (err) return callback(err)
    // translate the response into geojson
    const geojson = translate(body)
    // Cache data for 10 seconds at a time by setting the ttl or "Time to Live"
    geojson.ttl = 10
    // hand off the data to Koop
    callback(null, geojson)
  })
  */

    let d_fs = {
      url: 'https://services.arcgis.com/hRUr1F8lE8Jq2uJo/arcgis/rest/services/DURHAM_COUNTY_WITH_FLDS/FeatureServer',
      fieldMap: {
        state: "State",
        county: "County",
        incorporatedMunicipality: "CITY2",
        unincorpCounty: "UNINCORP",
        postalCommunityName: "SUBDIVISIO",
        zipCode: "ZIPCODE",
        streetName: "STREETNAME",
        addressNumber: "HOUSENUM",
        guid: "guid_str",
        addressType: "TYPE",
        addressPlacement: "PLACEMENT",
        addressSource: "SOURCE",
        addressAuthority: "AUTHORITY",
        dateLastUpdated: "UPDATED_DT"
      }
    }
  
    let w_fs = {
      url:'https://services.arcgis.com/bkrWlSKcjUDFDtgw/arcgis/rest/services/WAKE_COUNTY_WITH_FLDS/FeatureServer',
      map: {
        state: "STATE",
        county:  "COUNTY_NAME",
        incorporatedMunicipality: "PO_NAME",
        unincorpCounty: "COMMUNITY",
        postalCommunityName: "PO_NAME",
        zipCode: "ZIPCODE",
        streetName: "ADDR_SN",
        addressNumber: "ADDR_num",
        guid: "ENTRY_ID",
        addressType: "RES_TYPE",
        addressPlacement: "ADDR_PLCM",
        addressSource: "ADDR_SOURCE",
        addressAuthority: "ADDR_AUT",
        dateLastUpdated: "EDIT_DATE"
      }
    }
  
    async.map(
      [d_fs, w_fs], 
      getUrls,
      getFeatures
    )

    function getUrls (fs, cb) {
      let f = new fSrvc(fs.url, {layer:0})
      f.pages((err, pages)=> {
        cb(null, {pages:pages, srvc: fs})
      })
    }

    function getFeatures(err, urls) {
      // got through urls and download
      async.map(urls, getRecords, done)

    }
    
    function getRecords (n, records) {
      async.map(n.pages, (url, cb) =>  {
        request(url.req,  (err, res, bdy) => {
          if (err) callback(err)
          let gjFeature = bdy.features.map((ags_f)=>{
            return swizzleFields(terraAGS.parse(ags_f), n.srvc)
          })
          
          cb(null, {geojson: gjFeature, srvc:n.srvc})
        })
      }, (err, results)=>{
        records(null, results)
      })
    }
    
    function done (err, results) {
      var agg = {
        type: 'FeatureCollection',
        features: [],
        metadata: {
          name: 'Nationwide Address Dataset',
          description: 'Addresses proxied by http://koopjs.github.io/'
        },
        ttl: 60
      }
      results.forEach((r)=>{
        r.forEach((row)=>{
          row.geojson.forEach((g)=>{
            agg.features.push(g)
          })
        })
      })
      callback(null, agg)
    }
}

function swizzleFields (gjson, fmap) {
    var newProps = {}
    Object.keys(gjson.properties).forEach (
      (k, n) => {
        for (var p in fmap.fieldMap) {
          if (fmap[p] === k) {
            newProps[p] = gjson.properties[k]
          }
        }
      }
    )
    gjson.properties = newProps
    gjson.properties['sourceService'] = fmap.url

  return gjson;
}

function translate (input) {
  return {
    type: 'FeatureCollection',
    features: input.resultSet.vehicle.map(formatFeature)
  }
}

function formatFeature (vehicle) {
  // Most of what we need to do here is extract the longitude and latitude
  const feature = {
    type: 'Feature',
    properties: vehicle,
    geometry: {
      type: 'Point',
      coordinates: [vehicle.longitude, vehicle.latitude]
    }
  }
  // But we also want to translate a few of the date fields so they are easier to use downstream
  const dateFields = ['expires', 'serviceDate', 'time']
  dateFields.forEach(field => {
    feature.properties[field] = new Date(feature.properties[field]).toISOString()
  })
  return feature
}

module.exports = Model

/* Example raw API response
{
  "resultSet": {
  "queryTime": 1488465776220,
  "vehicle": [
    {
      "expires": 1488466246000,
      "signMessage": "Red Line to Beaverton",
      "serviceDate": 1488441600000,
      "loadPercentage": null,
      "latitude": 45.5873117,
      "nextStopSeq": 1,
      "source": "tab",
      "type": "rail",
      "blockID": 9045,
      "signMessageLong": "MAX  Red Line to City Center & Beaverton",
      "lastLocID": 10579,
      "nextLocID": 10579,
      "locationInScheduleDay": 24150,
      "newTrip": false,
      "longitude": -122.5927705,
      "direction": 1,
      "inCongestion": null,
      "routeNumber": 90,
      "bearing": 145,
      "garage": "ELMO",
      "tripID": "7144393",
      "delay": -16,
      "extraBlockID": null,
      "messageCode": 929,
      "lastStopSeq": 26,
      "vehicleID": 102,
      "time": 1488465767051,
      "offRoute": false
    }
  ]
}
*/
