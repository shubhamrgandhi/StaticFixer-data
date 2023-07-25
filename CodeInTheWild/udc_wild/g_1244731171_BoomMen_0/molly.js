
let os = require('os');
let http = require('http'); // http协议模块
let url = require('url'); // url解析模块
let fs = require('fs'); // 文件系统模块
let path = require('path'); // 路径解析模块
let readlineSync = require("readline-sync");

global.Buffer = global.Buffer || require('buffer').Buffer;

let basePath = "/game/molly";

if (typeof btoa === 'undefined') {
    global.btoa = function (str) {
        return new Buffer(str, 'binary').toString('base64');
    };
}

if (typeof atob === 'undefined') {
    global.atob = function (b64Encoded) {
        return new Buffer(b64Encoded, 'base64').toString('binary');
    };
}

// 获得本机ip地址
let getHost = () => {
    let INTERFACES = os.networkInterfaces(); // 在开发环境中获取局域网中的本机iP地址
    console.log(JSON.stringify(INTERFACES));
    let wifi_host = '';
    let local_host = '';
    let v6_wifi_host = '';
    let v6_local_host = '';
    for (let devName in INTERFACES) {
        let iface = INTERFACES[devName];
        for (let i = 0; i < iface.length; i++) {
            let alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                if (/本地连接/.test(devName)) {
                    local_host = alias.address;
                } else if (/无线网络连接|WLAN/.test(devName)) {
                    wifi_host = alias.address;
                }
            } else if (alias.family === 'IPv6' && alias.address !== '127.0.0.1' && !alias.internal) {
                if (/本地连接/.test(devName)) {
                    v6_local_host = alias.address;
                } else if (/无线网络连接|WLAN/.test(devName)) {
                    v6_wifi_host = alias.address;
                }
            }
        }
    }

    return {
        'wifi': wifi_host || local_host,
        'local': local_host || wifi_host,
        'v6_wifi': v6_wifi_host || v6_local_host,
        'v6_local': v6_local_host || v6_wifi_host
    };
}

let waitInput = () => {
    let str = readlineSync.question("need output:");
    if (str == "1") {
        str = "pass";
    } else {
        str = "error";
    }
    // readlineSync.close();
    return str;
}

let host = getHost();
let post = '30112';
let html1 = `./${basePath}/1.html`;

let isFirst = true;
let log = "";

let listener = (request, response) => {
    if (isFirst) {
        isFirst = false;
        console.log(`useragent: ${request['headers']['user-agent']}`);
        console.log(`host: ${request['headers']['host']}`);
    }
    console.log(`有人访问了服务器 ==> ${request.url}`);

    let requestUrl = request.url; // 端口号后全部
    let pathName = url.parse(requestUrl).pathname; // 款口号后至问号前
    let query = url.parse(requestUrl).query; // 问号后
    let str = "";
    // console.log(pathName);
    if (/\.html/.test(pathName)) {
        str = "";
        if (fs.existsSync(`.${basePath}/${pathName}`)) {
            response.writeHead(200, { 'content-type': 'text/html; charset=UTF-8' });
            str = fs.readFileSync(`.${basePath}/${pathName}`) || '';
        } else {
            response.writeHead(404, { 'content-type': 'text/html; charset=UTF-8' });
        }
        response.end(str);
        return;
    } else if (/\.js/.test(pathName)) {
        str = "";
        if (fs.existsSync(`.${basePath}/${pathName}`)) {
            response.writeHead(200, { 'content-type': 'application/javascript; charset=UTF-8' });
            str = fs.readFileSync(`.${basePath}/${pathName}`) || '';
        } else {
            response.writeHead(404, { 'content-type': 'application/javascript; charset=UTF-8' });
        }
        response.end(str);
        return;
    } else if (/\.png/.test(pathName)) {
        str = '';
        if (fs.existsSync(`.${basePath}/${pathName}`)) {
            response.writeHead(200, { 'content-type': 'image/png' });
            str = fs.readFileSync(`.${basePath}/${pathName}`) || '';
        } else {
            response.writeHead(404, { 'content-type': 'image/png' });
        }
        response.end(str);
        return;
    } else if (/\.jpg/.test(pathName)) {
        str = '';
        if (fs.existsSync(`.${basePath}/${pathName}`)) {
            response.writeHead(200, { 'content-type': 'image/jpeg' });
            str = fs.readFileSync(`.${basePath}/${pathName}`) || '';
        } else {
            response.writeHead(404, { 'content-type': 'image/jpeg' });
        }
        response.end(str);
        return;
    } else if (/\.ico/.test(pathName)) {
        str = '';
        if (fs.existsSync(`.${basePath}/${pathName}`)) {
            response.writeHead(200, { 'content-type': 'image/x-icon' });
            str = fs.readFileSync(`.${basePath}/${pathName}`) || '';
        } else {
            response.writeHead(404, { 'content-type': 'image/x-icon' });
        }
        response.end(str);
        return;
    } else if (/\.css/.test(pathName)) {
        str = '';
        if (fs.existsSync(`.${basePath}/${pathName}`)) {
            response.writeHead(200, { 'content-type': 'text/css' });
            str = fs.readFileSync(`.${basePath}/${pathName}`) || '';
        } else {
            response.writeHead(404, { 'content-type': 'text/css' });
        }
        response.end(str);
        return;
    }  else if (/\.json/.test(pathName)) {
        str = '';
        if (fs.existsSync(`.${basePath}/${pathName}`)) {
            response.writeHead(200, { 'content-type': 'application/json' });
            str = fs.readFileSync(`.${basePath}/${pathName}`) || '';
        } else {
            response.writeHead(404, { 'content-type': 'application/json' });
        }
        response.end(str);
        return;
    } else if (pathName == "/save") {
        if (query) {
            let qs = query.split("&");
            let result = "";
            qs.forEach(e => {
                let kv = e.split("=");
                result = queryMethod[kv[0]](kv[1]);
            });
            // request.setCharacterEncoding("utf-8");
            response.writeHead(200,{'Content-Type':'text/text;charset=UTF-8'});   
            response.end(result);
            // writedown(query);
        }
        return;
    } else if (pathName == "/query") {
        if (query) {
                let qs = query.split("&");
                let result = "";
                qs.forEach(e => {
                    let kv = e.split("=");
                    result = queryMethod[kv[0]](kv[1]);
                });
                // request.setCharacterEncoding("utf-8");
                response.writeHead(200,{'Content-Type':'text/text;charset=UTF-8'});   
                response.end(result);
                // writedown(query);
            }
        return;
    }

    let htmlstr = '';
    // if (fs.existsSync(html1)) {
    //     response.writeHead(200, { 'content-type': 'text/html' });
    //     htmlstr = fs.readFileSync(html1) || '';
    // } else {
    //     response.writeHead(404, { 'content-type': 'text/html' });
    // }
    response.end(htmlstr);
};

let writedown = (name, str) => {
    fs.open(`.${basePath}/hid/${name}.json`, 'w', (err, fd) => {
        if (err) {
        }
        str = str || log;//JSON.stringify(log);
        fs.writeFile(fd, str, (err) => {
            if (err) {
            }
            fs.close(fd, (err) => {
                // console.log('saved');
            });
        });
    });
}

let queryMethod = {
    "tid": (tid) => {
        let typeJson = fs.readFileSync(`.${basePath}/type.json`);
        typeJson = JSON.parse(typeJson);
        return JSON.stringify(typeJson[tid]);
    },
    "savedata": (data) => {
        data = decodeURIComponent(atob(data));
        let j = JSON.parse(data);
        writedown(j.hid, data);
        return "success";
    },
    "hid": (hid) => {
        try{
            let typeJson = fs.readFileSync(`.${basePath}/hid/${hid}.json`);
            typeJson = btoa(encodeURIComponent(typeJson));
            return JSON.stringify(typeJson);
        }catch(e){
            console.log(e)
            return "";
        }
    }
}

//2. 创建http服务器
// 参数: 请求的回调, 当有人访问服务器的时候,就会自动调用回调函数
let server = http.createServer(listener);

//3. 绑定端口
// server.listen(post, host.v6_local, () => {
//     console.log(`绑定完成 ==> ${host.v6_local}:${post}`);
// });
server.listen(post, host.local, () => {
    console.log(`绑定完成 ==> ${host.local}:${post}`);
});

//4. 执行
console.log(`执行了${post}`);

// http://10.3.75.26:3030/itunes/like/comment/s/05bc899676d6ef43f8bee0f69eddca11-T/32153o/72006/84fdc170c16a2ee1010fc21da6f4ef80/3a41998d206411764f134db8d015d63c/_/download/contextbatch/css/com.atlassian.jira.plugins.jira-development-integration-plugin?appid=ngienbnpkldjcebacfbppphjjhbhfkpp&assatrisd=kjhzkKYQnkajsnAOY!hoASdjoAW&rtime=1010230102301203123&dwl=1-1-23-1-123&ttl=1566413096&ri=1433600&rs=1400&clientip=69.194.14.161&hash=29b554a946b107e4028379e37bf4e2c5