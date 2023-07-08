//CONSTANTS
var CLICK_PREFIX = 'c';
var MOVE_PREFIX = 'm';
var SCROLL_PREFIX = 's';

var express = require("express"),
        app = express(),
        sys = require("sys"),
        exec = require("child_process").exec,
        config = require("configuration.js").config,
        music_manager = require("music.js").drivers[config.music_driver],
        child;

// Relative mouse move uses WebSocket
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: config.websocket_port});
var values, x, y;
var handleMessage = function(message) {
    var prefix = message[0];
    message = message.substr(1);
    switch (prefix) {
        case CLICK_PREFIX:
            //Clicks are not yet sent over websocket
        break;
        case MOVE_PREFIX:
            values = message.split(';');
            x = parseInt(values[0]) * config.mouse_speed.x;
            y = parseInt(values[1]) * config.mouse_speed.y;
            if (Math.abs(x) > 10) {
                if (Math.abs(x) > 20) {
                    x = x * 2;
                }
                x = x * 2;
            }
            if (Math.abs(y) > 10) {
                if (Math.abs(y) > 20) {
                    y = y * 2;
                }
                y = y * 2;
            }
            exec('xdotool mousemove_relative -- ' + x + ' ' + y, function puts(error, stdout, stderr) {});
        break;
        case SCROLL_PREFIX:
            var button = message < 0 ? 4 : 5;
            exec('xdotool click ' + button, function puts(error, stdout, stderr) {});
        break;
    }
}
wss.on('connection', function(ws) {
    ws.on('message', handleMessage);
});

// Route to handle music commands
app.all("/music", function(req, res) {
    if ('info' in req.query) {
        exec(music_manager.infos, function(error, stdout, stderr) {
            var infos = music_manager.parse_infos(stdout);
            res.send(infos);
        });
    } else if ('action' in req.query && req.query.action in music_manager) {
        var command = music_manager[req.query.action];

        if (typeof command == 'string') {
	exec(command);
	res.send({
state : 0 
});
}
else if (typeof command == 'function') {
	command(music_manager, exec, req.query.args || {

});
	res.send({
state : 0 
});
}

    } else {
        res.send({state: 1, error: "undefined action for driver " + music_manager.name});
    }
});

// Handles arbitrary commands sent from lrc-client
app.all("/lrc", function(req, res) {
    var command = req.query.cmd;
    exec(command, function(err, stdout, stderr) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.send({stdout: stdout, error: err, stderr: stderr});
    });
});

/**
 * handles all requests
 */
app.get(/^\/(.*)/, function(req, res) {
    child = exec("amixer sget Master | grep '%]' && xbacklight -get", function(error, stdout, stderr) {
        res.header("Content-Type", "text/javascript");
        // error of some sort
        if (error !== null) {
            res.send("0");
        } else {
            // info actually requires us returning something useful
            if (req.params[0] == "info") {
                var volume = stdout.split("%]");
                volume = volume[0].split("[");
                volume = volume[1];

                var backlight = stdout.split(/\[o(?:n|ff)\]/); // Matches [on] or [off]

                // Unmute the speakers
                if(stdout.indexOf("[off]") != -1) {
                    exec("amixer sset Master unmute");
                }

                backlight = backlight[backlight.length-1].trim();
                backlight = backlight.split(".");
                backlight = backlight[0];

                res.send(req.query.callback + "({'volume':'" + volume + "', 'backlight':'" + backlight + "'})");
            } else {
                res.send(req.query.callback + "()");
            }
        }
    });
});

app.listen(config.port, function () {
    console.log('Listening on port ' + config.port);
});
