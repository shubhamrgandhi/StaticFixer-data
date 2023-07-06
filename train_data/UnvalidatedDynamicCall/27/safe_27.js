var express = require('express');
var app = express();

var actions = new Map();
actions.put("play", function play(data) {
  // ...
});
actions.put("pause", function pause(data) {
  // ...
});

app.get('/perform/:action/:payload', function (req, res) {
	if (actions.has(req.params.action)) {
	if (typeof actions.get(req.params.action) === 'function') {
	let action = actions.get(req.params.action);
	res.end(action(req.params.payload));
}

}

});
