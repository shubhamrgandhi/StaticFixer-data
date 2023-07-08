const express = require('express');
const router = express.Router();
const db = require("../controllers");
const EventEmitter = require('events');
const auth = require("../auth");
const {timingSafeEqual} = require("crypto");

let io;
const {REPLICATION_PASSWORD:repPass} = require("../loadConfig");

class socketIO extends EventEmitter {
  join(c){
    console.log("API joined room:",c);
  }
}

router.post("/api/:method",(req, res, next) => {
  console.log("Loaded API route")
  ;(async ()=>{
	if (! io) {
	io = require("../app").io;
}

	const socket = new socketIO();
	const {method} = req.params;
	socket.on("uncaughtError", err=>{
      let code;
      if(err.toString().includes("Please check if the homework you want to")){
        code = 409;
        console.log({err});
      }else{
        code = err.code || 500;
      }
      res.status(code).end(err.toString().replace("Error: ",""));
    });
	try{
      if(db.getNumTables()===0){
        await db.init();
      }
      if(repPass){
        const providedPassword = req.body.replication ? req.body.replication.password : "";
        if(providedPassword.length===repPass.length){
          if(timingSafeEqual(Buffer.from(providedPassword),Buffer.from(repPass))){
            socket.userData = {
              name:"replication_user",
              preferred_username:req.body.replication.user || "repuser@nushigh.edu.sg"
            };
            socket.username = req.body.replication.user || "repuser@nushigh.edu.sg";
          }else{
            throw new Error("Replication password incorrect");
          }
        }else{
          throw new Error("Replication password incorrect");
        }
      }else{
        const token = req.signedCookies.token;
        const tokenClaims = await auth.verifyToken(token);
        socket.userData = tokenClaims;
      }
    }catch(e){
      console.log(e);
      //Problem with token, perhaps spoofed token?
      //Anyway get rid of this socket
      console.log("Forced disconnect");
      return res.status(403).end("Auth error");
    }
	const specialMethods = ["setChannelData", "getLastUpdated"];
	const replicationMethods = ["addChannel"].concat(specialMethods);
	const methods = ["whoami", "textMessage", "dataReq", "editReq", "deleteReq", "addReq", "homeworkSubjectData", "homeworkDayData", "channelDataReq"];
	methods.push(...(socket.userData.name === "replication_user" ? replicationMethods : []));
	if (! methods.includes(method)) {
	return next() ;
}

	if (specialMethods.includes(method)) {
	const result = await db.replication[method](req.body);
	if (method === "setChannelData") {
	io.to(req.body.name).emit("channelData", {
req.body.name : req.body 
});
}

	return res.end(JSON.stringify(result)) ;
}

	require("../websocket-routes/admin")(socket, io);
	require("../websocket-routes/homework")(socket, io);
	require("../websocket-routes/analytics")(socket);
	require("../websocket-routes/tests")(socket);
	socket.emit(method, req.body, function (err, results){
	if (err) {
	throw err
}

	return res.end(JSON.stringify(results)) ;
});
})()
    .catch(err=>{
      let code;
      if(err.toString().includes("Please check if the homework you want to")){
        code = 409;
        console.log({err});
      }else{
        code = err.code || 500;
      }
      res.status(code).end(err.toString().replace("Error: ",""));
    });
});

module.exports = router;