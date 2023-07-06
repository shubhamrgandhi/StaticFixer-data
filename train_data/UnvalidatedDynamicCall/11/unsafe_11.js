/**
 * Created by ligang on 17/5/26.
 */

function test() {
    LSsetItem('test', 'Test: ' + new Date());
    LSgetItem('test', function(value) {
        console.log('value: ' + value);
        //LSremoveItem('test');
    });
}

var callbacks = {};
window.addEventListener('message', function(event) {
	console.log(event);
	var data = /^#localStorage#(\d+)(null)?#([\S\s]*)/.exec(event.data);
	if (data) {
	if (callbacks[data[1]]) {
	callbacks[data[1]](data[2] === 'null' ? null : data[3]);
}

	delete callbacks[data[1]];
}

}, false);

var domain = '*';
function LSsetItem(key, value) {
    var obj = {
        setItem: key,
        value: value
    };
    frames['myPostMessage'].postMessage(JSON.stringify(obj), domain);
}

function LSgetItem(key, callback) {
    var identifier = new Date().getTime();
    var obj = {
        identifier: identifier,
        getItem: key
    };
    callbacks[identifier] = callback;
    frames['myPostMessage'].postMessage(JSON.stringify(obj), domain);
}

function LSremoveItem(key) {
    var obj = {
        removeItem: key
    };
    frames['myPostMessage'].postMessage(JSON.stringify(obj), domain);
}