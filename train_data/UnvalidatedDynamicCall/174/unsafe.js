/**
 * Created by Jack.L on 2017/5/4.
 */
var url = require('url');
var crypto = require('crypto');
var urlEncode = require('urlencode');
var qs        = require('qs');
var xml2js    = require('xml2js')

var common = require('./common');
var alioss = require('./alioss');
var httpRequest = require('./HttpRequest');

var system  = require('./serverSystem');
var sysLogin = require('./sysLogin')(system);

var protocal = require('./protocal');
var config   = require('./config');
var base64   = require('./base64');
var wxRobot  = require('./wxRobot');

////////
function sha1(str){
    var md5sum = crypto.createHash("sha1");
    md5sum.update(str);
    str = md5sum.digest("hex");
    return str;
}

const STR_TOKEN = "Jack.L's World";
function getToken()
{
    var _result = "";
    var s = (new Buffer(STR_TOKEN)).toString('base64');

    for(var i=0;i<s.length;i++)
    {
        var p = s.charAt(i);

        if( (p >= 'a' && p <= 'z') ||
            (p >= 'A' && p <= 'Z') ||
            (p >= '0' && p <= '9')
        )
        {
            _result = _result + p.toString();
        }
    }

    return _result;
};

module.exports =
{
    TOKEN_VALUE:getToken(),
    APP_ID:config.WX_CONFIG.APP_ID,
    APP_SECRET:config.WX_CONFIG.APP_SECRET,
    CUR_URL:"http://huyukongjian.cn/app",
    WX_TOKEN:"",
    WX_TOKEN_INVALID_TIME:0,
    WX_SYS:null,
    buildXML:function(dataArray)
        {
            var _result = "<xml>";

            for( var key in dataArray )
            {
                const _data = dataArray[key];

                if( typeof _data == "string" )
                {
                    _result += "<" + key + "><![CDATA[" + dataArray[key].toString() + "]]></" + key + ">";
                }
                else
                {
                    _result += "<" + key + ">" + dataArray[key].toString() + "</" + key + ">";
                }
            }

            _result += "</xml>"
            return _result;
        },
    getImage:function(req, res)
    {
        var img_url = req.query.img;

        if( img_url && common.checkURLInvalid(img_url) )
        {
            common.getImageFromURL(
                img_url,
                function(data, err)
                {
                    if( err )
                    {
                        res.send("Jack.L's error:" + err.message);
                    }
                    else
                    {
                        ////
                        var image =  data;

                        if( image == "" )
                        {
                            res.send("Jack.L's tell you there is nothing");
                        }
                        else
                        {
                            ////
                            alioss.upload('account_wx_img/test.jpeg', image);

                            res.writeHead('200',{'Content-Type':'image/jpeg'});
                            res.end(image, 'base64');
                        }
                    }

                }
            );
        }
        else
        {
            res.send('You must have correct IMG parament, my firend');
        }
    },
    validateToken:function(req, res)
    {
        var query = url.parse(req.url,true).query;
        var signature = query.signature;
        var echostr = query.echostr;
        var timestamp = query['timestamp'];
        var nonce = query.nonce;
        var oriArray = new Array();
        oriArray[0] = nonce;
        oriArray[1] = timestamp;
        oriArray[2] = this.TOKEN_VALUE;//"*********";//这里是你在微信开发者中心页面里填的token，而不是****
        oriArray.sort();
        var original = oriArray.join('');
        console.log("Original str : " + original);
        console.log("Signature : " + signature );
        var scyptoString = sha1(original);
        if(signature == scyptoString){
            res.end(echostr);
            console.log("Confirm and send echo back");
        }else {
            res.end("Welcome to Jack.L's World!");
            console.log("Failed!");
        }
    },
    getClientIP:function(req)
    {
        return req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;
    },
    getWXAPPUrl:function()
    {
        const ENCODE_URL = urlEncode.encode(this.CUR_URL);
        const APP_URL =
            "https://open.weixin.qq.com/connect/oauth2/authorize?" +
            "appid=" + this.APP_ID + "&redirect_uri=" + ENCODE_URL +
            "&response_type=code&scope=snsapi_userinfo&state=0#wechat_redirect";

        return APP_URL;
    },
    getWXTokenURL:function()
    {
        const TOKEN_URL =
            "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid="+
            this.APP_ID +
            "&secret=" +
            this.APP_SECRET;

        return TOKEN_URL;
    },
    getWXAccess_TokenURL:function(code)
    {
        const TOKEN_URL =
            "https://api.weixin.qq.com/sns/oauth2/access_token?appid=" + this.APP_ID +
            "&secret=" + this.APP_SECRET +
            "&code=" + code +
            "&grant_type=authorization_code";

        return TOKEN_URL;
    },
    getWXTicket:function(access_token)
    {
        const _URL =
            //"https://qyapi.weixin.qq.com/cgi-bin/get_jsapi_ticket?access_token=" + access_token + "";
            "https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=" + access_token + "&type=jsapi";

        return _URL;
    },
    getWXRefresh_Access_TokenURL:function()
    {
        const TOKEN_URL =
            "https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=" + this.APP_ID +
            "&grant_type=refresh_token&refresh_token=REFRESH_TOKEN";

        return TOKEN_URL;
    },
    getWXUserInfoURL:function(_openid, _access_token)
    {
        const _URL = "https://api.weixin.qq.com/sns/userinfo?";
        const params =
        {
            access_token:_access_token,
            openid:_openid,
            lang:'zh_CN'
        };

        const options =
        {
            method:'get',
            url:_URL + qs.stringify(params)
        };

        return options;
    },
    getWXMenuURL:function()
    {
        const _URL = "https://api.weixin.qq.com/cgi-bin/menu/create?access_token="+this.WX_TOKEN;
        return _URL;
    },
    requestWXMenu:function()
    {
        var SELF    = this;
        const URL   = this.getWXMenuURL();
        const _menu = config.WX_MENU;

        httpRequest.https_request_url(URL,_menu,
            function(data)
            {
                var object = data;
                console.log('WX MENU RECV:' + JSON.stringify(object));

                return;
            },
            function(error)
            {
                console.log('WX MENU ERROR RECV:' + error);

                return;
            }
        );

    },
    requestWXToken:function (callback)
    {
        httpRequest.https_get(this.getWXTokenURL(),
            function(data)
            {
                if( callback )
                {
                    callback(data, null);
                }
            },
            function(error)
            {
                if( callback )
                {
                    callback(null, error);
                }
            }
        );

    },
    taskTokenRefresh:function()
    {
        var SELF = this;

        var times = [];
        for(var i=1; i<60; i++){
            times.push(i);
        }

        var schedule = require('node-schedule');
        var taskRule = new schedule.RecurrenceRule();
        taskRule.second = times;
        //taskRule.minute = 60;

        var callback_refresh =
            function( data, error )
            {
                if( error == null && data != null && data.access_token != null )
                {
                    console.log("token value:" + data.access_token);

                    ////////
                    SELF.WX_TOKEN = data.access_token;
                    setTimeout(
                        function()
                        {
                            SELF.requestWXMenu();
                        },
                        1000
                    );

                    ////////
                    const _ticket_url = SELF.getWXTicket(SELF.WX_TOKEN);
                    httpRequest.https_get(_ticket_url,
                        function(ticket_data)
                        {
                            console.log(JSON.stringify(ticket_data));

                            const _rand_flag = Math.floor( Math.random() * 123456).toString();

                            SELF.WX_TICKET = {};
                            SELF.WX_TICKET.jsapi_ticket = ticket_data.ticket;
                            SELF.WX_TICKET.noncestr = "Jack.L's_Signature_" + _rand_flag;
                            SELF.WX_TICKET.timestamp = Math.floor( (new Date()).getTime() / 1000).toString();
                            SELF.WX_TICKET.url = "http://huyukongjian.cn";

                            var _string1 =
                                "jsapi_ticket="+SELF.WX_TICKET.jsapi_ticket+"&"+
                                "noncestr="+SELF.WX_TICKET.noncestr+"&"+
                                "timestamp="+SELF.WX_TICKET.timestamp+"&"+
                                "url="+SELF.WX_TICKET.url;

                            var sha1 = crypto.createHash('sha1');
                            sha1.update(_string1);

                            SELF.WX_signature =  sha1.digest('hex');

                            SELF.signature =
                                function(req)
                                {
                                    const _rand_flag = Math.floor( Math.random() * 123456).toString();

                                    const WX_TICKET =
                                    {
                                        jsapi_ticket:SELF.WX_TICKET.jsapi_ticket,
                                        noncestr:"Jack.L's_Signature_" + _rand_flag,
                                        timestamp:Math.floor( (new Date()).getTime() / 1000).toString(),
                                        url:"http://huyukongjian.cn/gameapp"
                                    };

                                    var _string1 =
                                        "jsapi_ticket="+WX_TICKET.jsapi_ticket+"&"+
                                        "noncestr="+WX_TICKET.noncestr+"&"+
                                        "timestamp="+WX_TICKET.timestamp+"&"+
                                        "url="+WX_TICKET.url;

                                    var sha1 = crypto.createHash('sha1');
                                    sha1.update(_string1);

                                    const _signature =  sha1.digest('hex');

                                    ////////
                                    const _config_data =
                                    {
                                        debug:false,
                                        appId:SELF.APP_ID,
                                        timestamp:WX_TICKET.timestamp,
                                        nonceStr:WX_TICKET.noncestr,
                                        signature:_signature,
                                        jsApiList:[
                                            "onMenuShareTimeline",
                                            "onMenuShareAppMessage",
                                            'checkJsApi',
                                            'hideMenuItems',
                                            'showMenuItems',
                                            'hideOptionMenu',
                                            'showOptionMenu',
                                            'hideAllNonBaseMenuItem',
                                            'showAllNonBaseMenuItem',
                                            'closeWindow',

                                        ]
                                    };

                                    return _config_data;
                                };

                            return;
                        },
                        function(ticket_error)
                        {
                            return;
                        }
                    );

                }
                else
                {

                }
            };

        var task = schedule.scheduleJob(taskRule,
            function()
            {
                const _currentTime = Math.floor((new Date()).getTime() * 0.001);

                if( _currentTime - SELF.WX_TOKEN_INVALID_TIME > 3600 )
                {
                    SELF.WX_TOKEN_INVALID_TIME = _currentTime;
                    console.log('Task refrsh Token from WX');
                    SELF.requestWXToken(callback_refresh);
                }
            }
        );
    },
    processCodeAndState:function(req, res)
    {
        var SELF  = this;

        var request  = req;
        var response = res;

        var query = req.query;

        ////////
        if( query.code && query.state )
        {
            httpRequest.https_get(this.getWXAccess_TokenURL(query.code),
                function(data)
                {
                    var _resultObj = data;

                    if( _resultObj.errcode )
                    {
                        ////
                        res.writeHead(302,{'Location':'/auth'});
                        res.end();
                    }
                    else
                    {
                        ////success
                        console.log('wx token:' + _resultObj.access_token);
                        console.log('open id:' + _resultObj.openid);

                        const _app_name = req.session.APP_NAME;
                        const _app_id   = req.session.APP_ID;

                        const _requestURL = SELF.getWXUserInfoURL(_resultObj.openid, _resultObj.access_token);
                        const _open_id = _resultObj.openid;

                        httpRequest.https_get(_requestURL.url,
                            function(data)
                            {
                                //response.send("Welcome to Jack's APP");

                                ////////
                                var callback_login =
                                    function()
                                    {
                                        sysLogin.login_by_wx(request, response, _open_id,
                                            function(req, res, accountdata)
                                            {
                                                ////////
                                                const _account = accountdata;

                                                var _wx_data =
                                                {
                                                    UID:_account.UID,
                                                    access_token: _resultObj.access_token,

                                                    city:_account.wx_userinfo.city,
                                                    province:_account.wx_userinfo.province,
                                                    country:_account.wx_userinfo.country,
                                                    nickname:_account.wx_userinfo.nickname,
                                                    headimgurl:_account.wx_userinfo.headimgurl,
                                                    sex:_account.wx_userinfo.sex,

                                                    ID:_account.ID,
                                                    PWD:_account.PWD
                                                };

                                                SELF.uploadImgToOSS(_wx_data.headimgurl, _wx_data.UID);

                                                req.session.wx_data = _wx_data;

                                                ////////
                                                console.log('APP NAME:' + _app_name +', APP ID:' + _app_id);

                                                if( _app_name )
                                                {
                                                    res.writeHead(302,{'Location':'gameapp'});
                                                    res.end();
                                                }
                                                else
                                                {
                                                    res.clearCookie();
                                                    res.end("Jack.L's Server is Funny, you can refresh the PAGE ^_^");
                                                }
                                            }
                                        );
                                    };

                                sysLogin.regist_by_wx(response, _open_id, data,
                                    callback_login,
                                    callback_login
                                );

                            },
                            function(error)
                            {
                                response.send("There is some error in Jack's Server");
                            }
                        );
                    }

                },
                function(error)
                {
                    response.send("There is some error in Jack's Server");
                }
            );
        }
        else
        {

        }


    },
    uploadImgToOSS:function(_img, _id)
    {
        var img_url = _img;

        if( img_url && common.checkURLInvalid(img_url) )
        {
            common.getImageFromURL(
                img_url,
                function(data, err)
                {
                    if( err )
                    {
                        ////
                    }
                    else
                    {
                        ////
                        var image =  data;

                        if( image == "" )
                        {
                            ////
                        }
                        else
                        {
                            ////
                            alioss.upload('account_wx_img/' + _id.toString(), image);
                        }
                    }

                }
            );
        }
    },
    serviceForWXServer:function( req, res )
    {
        const SELF   = this;
        const _query = req.query;
        const _xml   = req.body.xml;

        var _check = false;

        if( _query.encrypt_type == 'aes' && _query.msg_signature && _query.signature && _query.timestamp )
        {
            const check_time = (new Date()).getTime() / 1000 - _query.timestamp;

            if( check_time > 0 && check_time < 5 )
            {
                _check = true;
            }
        }

        if( _check )
        {
            ////////
            //console.log("recv wx data:" + JSON.stringify(_xml) );

            ////////
            const _requestInfo =
            {
                ToUserName:_query.openid,
                FromUserName:"huyukongjian",
                CreateTime:Math.floor((new Date()).getTime() / 1000),
                MsgType:'text',
                Content:'您好，欢迎来到互娱空间'
            };

            var xmlStr = this.buildXML(_requestInfo);
            var _robotWork = false;

            var app = null;
            if( _xml.eventkey && _xml.msgtype && _xml.msgtype[0] == "event" )
            {
                const _event_key = _xml.eventkey[0];

                var _event_key_response =
                {
                    "KEY_MAIN":function()
                    {
                        const _xmlInfo =
                        {
                            ToUserName:_query.openid,
                            FromUserName:"huyukongjian",
                            CreateTime:Math.floor((new Date()).getTime() / 1000),
                            MsgType:'text',
                            Content:'您好，欢迎来到互娱空间!'
                        };

                        xmlStr = SELF.buildXML(_xmlInfo);
                    },
                };

                app = _event_key_response[_event_key];
            }
            else
            {
                ////////
                if( _xml.msgtype == "text" && _xml.content )
                {
                    //user input
                    //console.log("user input:" + _xml.content[0]);

                    _robotWork = true;

                    wxRobot.chatToRobot(_query.openid, _xml.content[0],
                        function(data)
                        {
                            //console.log("robot:" + JSON.stringify(data));

                            if(data && data.text)
                            {
                                const _xmlInfo =
                                {
                                    ToUserName:_query.openid,
                                    FromUserName:"huyukongjian",
                                    CreateTime:Math.floor((new Date()).getTime() / 1000),
                                    MsgType:'text',
                                    Content:data.text
                                };

                                xmlStr = SELF.buildXML(_xmlInfo);
                                res.end(xmlStr);
                            }
                            else
                            {
                                const _xmlInfo =
                                {
                                    ToUserName:_query.openid,
                                    FromUserName:"huyukongjian",
                                    CreateTime:Math.floor((new Date()).getTime() / 1000),
                                    MsgType:'text',
                                    Content:'[捂脸]'
                                };

                                xmlStr = SELF.buildXML(_xmlInfo);
                                res.end(xmlStr);
                            }
                        }
                    );

                }
            }

            if( _robotWork )
            {

            }
            else if( !app )
            {
                res.end(xmlStr);
            }
            else
            {
                app();
                res.end(xmlStr);
            }

            return;
        }
        else
        {
            res.end("Verify by Jack.L's Server");
        }
    }

};
