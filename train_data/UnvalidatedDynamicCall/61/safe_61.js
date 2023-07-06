
/*
 * GET home page.
 */

exports.index = function (request, response) {
    response.render('index', { title: 'This is my First Express program' });
};

exports.Test = function (request, response) {
	var url_properties = String(request.params.url_properties);
	var url_properties = url_properties.split(';');
	var url_syntax_message = ': Syntax http://localhost:1337/test/<file name>;<function name>;<parameter1>,<parameter2>,...';
	if (Object.prototype.toString.call(url_properties) !== '[object Array]') {
	response.end('Wrong Syntax(' + Object.prototype.toString.call(url_syntax_message) + ')' + url_syntax_message);
	return ;
}

	var module_name = '';
	var function_name = '';
	var function_parameters = '';
	switch (url_properties.length) {
        case 3:
            function_parameters = String(url_properties[2]);
        case 2:
            function_name = String(url_properties[1]);
        case 1:
            module_name = String(url_properties[0]);
            break;
        default:
            response.end('Wrong Syntax( Array size = ' + url_properties.length.toString() + '). Are you putting an additional ";"?' + url_syntax_message);
            return;            
    }
	var module;
	try {
        var module = require('./' + module_name);
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            response.end('Unkonwn Module(' + module_name + ')' + url_syntax_message);
            return;
        }
    }
	if (typeof module[function_name] !== 'function') {
	response.end('Unkonwn Function(' + function_name + ')' + url_syntax_message);
	return ;
}

	function_parameters = function_parameters.split(',');
	module[function_name](request, response, function_parameters);
}

exports.Parameters = function (request, response) {
    //exp = require('express');
    //request = exp.request;
    //request.
    response.end(request.params.name);
}

exports.SendHtml = function (request, response) {
    response.send('This is an automated created HTML page <br> When using the send function, the responseponse goes directly to the Brownser.<br>When using the render function, the responseponse can be rendered into an HTML code.');
}

exports.SendJason = function (request, response) {
    response.send({ name: 'JasonObject', title: 'This is a Jason object!' });
}

exports.Wait5SecsToRespond = function (request, response) {
    response.writeHead(200);
    response.write('Imediate Response');
    setTimeout(function () {
        response.write('Response after 5 seconds');
        response.end();
    }, 5000);
  
}