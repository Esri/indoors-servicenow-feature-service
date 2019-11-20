const config = require("config");
const os = require("os");
const request = require("request").defaults({gzip: true, json: true});
const FeatureServer = require('featureserver')

let _authOn = false;
let _portalUrl;
let _referer = os.hostname();
let _tokenExpirationMinutes = 60;
let _tokenServicesUrl;
let _useHttp = false;

function auth(options = {}) {
  let v;
  let provider = options && options.provider;
  let Controller = provider && provider.Controller;

  _authOn = false;
  let authConfig = config.servicenow.portalTokenAuthentication;
  if (authConfig) {
    _portalUrl = checkPortalUrl(authConfig.portalUrl);

    v = authConfig.tokenServicesUrl;
    if (typeof v === "string" && v.length > 0) _tokenServicesUrl = v;

    v = authConfig.referer;
    if (typeof v === "string" && v.length > 0) _referer = v;

    v = authConfig.tokenExpirationMinutes;
    if (typeof v === "number" && v > 0) _tokenExpirationMinutes = v;

    v = authConfig.useHttp;
    if (typeof v === "boolean") _useHttp = v;

    if (_portalUrl) {
      _authOn = true;
      if (provider && Controller) {
        provider.routes.push({
          path: provider.name + "/rest/info",
          methods: ["get", "post"],
          handler: "featureServerRestInfo"
        });
        Controller.prototype.featureServerRestInfo = featureServerRestInfo.bind(Controller);
      }
    }

  }

  if (_authOn) {
    return {
      type: "auth",
      authenticationSpecification,
      authenticate,
      authorize
    }
  }

}

function authenticationSpecification () {
  return {
    useHttp: _useHttp
  }
}

function authenticate(req) {
  const promise = new Promise((resolve, reject) => {
    if (!_authOn) {
      resolve();
    } else {
      let username = req && req.query && req.query.username;
      let password = req && req.query && req.query.password;
      generateToken(username,password,_referer).then(result => {
        resolve(result);
      }).catch(ex => {
        reject(ex);
      });
    }
  });
  return promise;
}

function authorize(req) {
  const promise = new Promise((resolve, reject) => {
    if (!_authOn) {
      resolve();
    } else {
      let token = (req && req.query && req.query.token);
      //if (!token) token = (req && req.headers && req.headers.authorization;
      validateToken(token).then(result => {
        resolve();
      }).catch(ex => {
        reject(ex);
      });
    }
  });
  return promise;
}

function checkPortalUrl(url) {
  if (typeof url === "string") {
    url = url.trim();
    if (url.substr(url.length - 1) === "/") {
      url = url.substr(0, url.length - 1);
    }
    if (url.substr(url.length - 13) === "/sharing/rest") {
      url = url.substr(0, url.length - 13);
    }
    if (url.length > 0) return url;
  }
  return null;
}

// /rest/json response
function featureServerRestInfo(req, res) {

   if (!_authOn) {
     // default behavior from https://github.com/koopjs/koop-output-geoservices/blob/master/index.js
     let authInfo = {}
     let authSpec = this.model.authenticationSpecification
     authInfo.isTokenBasedSecurity = true
     // Use https by default, unless KOOP_AUTH_HTTP or authSpec.useHttp are defined and set to true
     let protocol = (authSpec.useHttp === true || process.env.KOOP_AUTH_HTTP === 'true') ? 'http' : 'https'
     authInfo.tokenServicesUrl = `${protocol}://${req.headers.host}${req.baseUrl}/${authSpec.provider}/tokens/`
     FeatureServer.route(req, res, { authInfo })
     return;
   }

   let tokenServicesUrl = _tokenServicesUrl;
   if (!tokenServicesUrl) {
     let protocol = (authSpec.useHttp === true || process.env.KOOP_AUTH_HTTP === 'true') ? 'http' : 'https'
     tokenServicesUrl = `${protocol}://${req.headers.host}${req.baseUrl}/${authSpec.provider}/tokens/`
   }
   FeatureServer.route(req, res, {
     authInfo: {
       isTokenBasedSecurity: true,
       tokenServicesUrl: tokenServicesUrl
     }
   });
}

function generateToken(username, password, referer) {
  const promise = new Promise((resolve, reject) => {
    let url = _portalUrl + "/sharing/rest//generateToken";

    const sendException = (ex => {
      let msg = "Unable to generate token";
      let err = new Error(msg)
      err.code = 500;
      reject(err);
      console.error(msg,url,ex);
    });

    const sendInvalid = (() => {
      let err = new Error("Invalid credentials.")
      err.code = 401;
      reject(err);
    });

    try {

      if (typeof username !== "string" || username.length === 0 ||
          typeof password !== "string" || password.length === 0) {
        sendInvalid("Invalid credentials.")
        return;
      }

      const options = {
        url: url,
        form: {
          f: "json",
          username: username,
          password: password,
          expiration: _tokenExpirationMinutes,
          referer: referer,
          client: referer
        },
        headers: {
          "User-Agent": "request",
          Accept: "application/json"
        }
      };

      request.post(options,(err,res,json) => {
        if (err) {
          sendException(err);
        } else if (json && json.error) {
          sendInvalid();
        } else  {
          resolve({
            token: json.token,
            expires: json.expires
          });
        }
      });

    } catch (ex) {
      sendException(ex);
    }
  });
  return promise;
}

function validateToken(token) {
  const promise = new Promise((resolve, reject) => {
    let url = _portalUrl + "/sharing/rest/portals/self";

    const sendException = (ex => {
      let msg = "Unable to validate token";
      let err = new Error(msg)
      err.code = 500;
      reject(err);
      console.error(msg,url,ex);
    });

    const sendInvalid = (() => {
      let err = new Error("Invalid token.")
      err.code = 401;
      reject(err);
    });

    const sendRequired = (() => {
      let err = new Error("Token required.")
      err.code = 401;
      reject(err);
    });

    try {

      if (typeof token !== "string" || token.length === 0) {
        sendRequired();
        return;
      }

      const options = {
        url: url,
        qs: {
          f: "json",
          token: token
        },
        headers: {
          "User-Agent": "request",
          Accept: "application/json"
        }
      };

      request.get(options,(err,res,json) => {
        if (err) {
          sendException(err);
        } else if (json && json.error) {
          // code 498 , message "Invalid token."
          sendInvalid();
        } else  {
          resolve();
        }
      });

    } catch (ex) {
      sendException(ex);
    }
  });
  return promise;
}

module.exports = auth
