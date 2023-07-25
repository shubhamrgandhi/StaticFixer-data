var request = require('superagent');
var querystring = require("querystring")
var jsforce = require('jsforce');
var express = require('express');
var router = express.Router();
var debug = require("debug")('development');

var login = require('./login');

router.all("/:objectName/:id?", function(req,res){ new Api(req,res) });

module.exports = router;


function Api(req, res){
  this.req= req;
  this.res = res;
  if(!login.getConnection(req, res)) return;

  var api = this.getOperation();
  if ( !api ) return this.onError({error_code: 21, message: this.req.params.name + " is not implemented in Proxy"});
  
  if( api == "query" ) this.query();
  else if( api == "sobject" ) this.sobject();
  else if( api == "apex" ) this.apex();
  else return this.onError({error_code: 21, message: api + " is not implemented in Proxy"});
}

Api.prototype.query = function(){
  if(this.req.query.query) this.queryWithString();
  else return this.onError("Provide a query QUERY_STRING");
}

Api.prototype.sobject = function(){
  var _this = this;
  var action = ""
  var body = this.req.body;
  var id = this.req.params.id;
  var method = this.req.query.gettify || this.req.method;

  //For Testing and non-cors Only usage
  if(this.req.query.gettify){ body = this.req.query; delete body.gettify; }

  if(id) body.Id = id;
  
  console.log(method);

  if(method == "GET"){ action = "retrieve"; body= id; }
  else if(method == "POST") action = "create";
  //else if(method == "put" && body.ExternalId ) action = this.req.conn.upsert;
  else if(method == "PUT") action = "update";
  else if(method == "DELETE"){ action = "destroy"; body= id; }

  this.req.conn.sobject(this.req.params.objectName)[action]( body, function(err, result){
    if(err && method == "GET" && JSON.stringify(err).indexOf("NOT_FOUND") > -1) return _this.onError( err, "404", 404 );
    if(err) return _this.onError( err );

    delete result.success;
    delete result.errors
    if(result.id){
      result.Id = result.id;
      delete result.id;
    }

    _this.onSuccess( result );
  })

}


Api.prototype.apex = function(){
  var _this = this;
  var body = req.body;
  var method = this.req.query.gettify || this.req.route.stack[0].method;
  
  if(this.req.query.gettify){ body = this.req.query; delete body.gettify; }

  if(method == "get") conn.apex[method]("/" + req.params.id + "/", response);
  else conn.apex[method]("/" + req.params.id + "/", body, response);

  function response(err, res) {
    if(err) return _this.onError( err );
    _this.onSuccess( res );
  }
}


Api.prototype.queryWithString = function(){
  var _this = this;
  var records = [];
  this.req.conn.query(this.req.query.query)
    .on("record", function(record) {
      records.push(record);
    })
    .on("end", function(query) {
      _this.onSuccess( records, { total: query.totalSize, fetched: query.totalFetched } );
    })
    .on("error", function(err) {
      _this.onError(err);
    })
    .run({ autoFetch : this.req.query.autoFetch || false, maxFetch : this.req.query.maxFetch || 200 });

}

Api.prototype.getInfo = function( options ){
  this.req.conn.limitInfo.other = options;
  return this.req.conn.limitInfo;
}

Api.prototype.onSuccess = function(result, infoOptions) {
  this.res.set("SalesforcerApi", this.getInfo( infoOptions ) );
  this.res.send(result);
}


Api.prototype.onError = function(err, code, status) {
  var error;
  status = status || 501;
  if(err.error_code || err.code || err.ERROR_CODE) error = err;
  else error = { error_code: code || 0, message: err }
  
  console.dir(err);
  if(err.stack) error.stack= err.stack

 console.error("ERROR")
 console.dir(error);
 this.res.status(status);
 return this.res.send( error );
}

Api.prototype.getOperation = function(){
  var objName = this.req.params.objectName || "";
  var operation;
  var action;
  if( objName == "apex" ) action = "apex";
  else if( this.req.query.query ) action = "query";
  else if( objName.indexOf("__c") > -1 ) action = "sobject";
  else if( ["Account","Opportunity","Contact","Task","Case","Contract","Event","Idea","Lead","Note","Order","Product2","Quote","User","Territory"].indexOf( objName ) > -1 )  action = "sobject";
  else action = objName;
  
  return action;

  
}

