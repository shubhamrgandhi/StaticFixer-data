(function() {
  let obj = {
    foo() {}
  };

  window.addEventListener('message', (ev) => {
	let name = JSON.parse(ev.data).name;
	obj[ev.data]();
	obj[name]();
	try {
      obj[name]();  // OK: exception is caught
    } catch(e) {}
	let fn = obj[name];
	fn();
	fn();
	obj[name]();
	new fn();
	if (obj[name]) obj[name]();

	if (typeof obj[name] === 'function') obj[name]();

	if (obj.hasOwnProperty(name)) {
	obj[name]();
}

	let key = "$" + name;
	obj[key]();
	if (typeof obj[key] === 'function') obj[key]();

	if (typeof fn === 'function') {
	fn.apply(obj);
}

});

  let obj2 = Object.create(null);
  obj2.foo = function() {};

  window.addEventListener('message', (ev) => {
    let name = JSON.parse(ev.data).name;
    let fn = obj2[name];
    fn();           // NOT OK: might not be a function
    if (typeof fn == 'function')
      fn();         // OK: cannot be from prototype
  });
})();
