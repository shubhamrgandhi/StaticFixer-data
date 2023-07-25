/**
 * Created by Citrus on 2017/5/9.
 */

const ws = require('ws').Server;

const server = new ws({port:3000});
const msg = require('./msg');       //工具方法
let allSockets = [];                //客户端连接
let users = [];                     //用户信息
let rMsgs = [];                     //收到的消息


server.addListener('connection', function(socket){
    console.log('connection....');

    allSockets.push(socket);
    socket.send(msg.send('已建立连接'));
    msgToAllUser({type:'lineNum',num: allSockets.length});

    socket.addListener('message', function(resData){
        let user = msg.toObj(resData);
        //console.log(user);
        if(user.type){
            msgFuncs.reciveMsg(user);
        }else{
            console.log(user);
        }
    });

    socket.addListener('close', function(){
        let offUserIndex = 0;
        allSockets.forEach(function(n, i){
            if(socket === n){
                allSockets.splice(i, 1); //删除离开的客户端
                offUserIndex = i;
                return;
            }
        });

        //通知仍在线的客户端
        console.log(rMsgs);
        msgFuncs.offLine(offUserIndex);
    });
});

//接收消息处理
let msgFuncs = {
    reciveMsg: function(msg){
        this[msg.type](msg);
    },
    newMsg: function(msg){
        let user = msg.user;
        let sendMsg = {
            type: msg.type,
            name: user.name,
            msg : msg.msg
        };
        rMsgs.push(user);
        if(rMsgs.length > 10){
            users.splice(0, 1);
        }
        msgToAllUser(sendMsg);
    },
    onLine: function(msg){
        let user = msg.user;
        users.push(user);
        msgToAllUser({type: msg.type, userName: user.name});
    },
    offLine: function(idx){
        msgToAllUser({type:'offLine',userName: users[idx].name});
        msgToAllUser({type:'lineNum',num: allSockets.length});
        users.splice(idx, 1); //删除离开的客户端用户信息
    }
};

//推送消息给所有在线用户
function msgToAllUser(data){
    allSockets.forEach(function(n, i){
        n.send(msg.send(data));
    });
}

//推送消息给当前用户
function msgToOne(){

}

console.log('running......');