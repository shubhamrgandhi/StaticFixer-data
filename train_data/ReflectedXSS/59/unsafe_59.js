var app = require('express')();

app.get('/user/:id', function(req, res) {
	let id = req.params.id;
	let userHtml = `<div data-id=" ${id} "> ${getUserName(id) || "Unknown name"} </div>`;
	res.send(prefix + userHtml + suffix);
});
