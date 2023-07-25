// Get paths
let path = window.location.hash.substring(1);
let controller, action, controllerName, render = [];
$(window).on('hashchange', function() {
  path = window.location.hash.substring(1);
  loadController();
});

const loadController = () => {
	controller = path !== "" ? path.split("/")[0] : "default";
	action = path !== "" ? (path.split("/").length > 1 ? path.split("/")[1] : "index") : "index";

	// Load controller
	let Controller;
	require(["vendor/Controller"], ()=>{
		require(["controllers/" + controller + "Controller"], () => {
			define.amd[controller + "Controller"] = true;
			Controller = new LoadController(controller + "Controller");

			if (typeof Controller['action_' + action] !== "undefined")
				Controller['action_' + action](Controller);
			else {
				Controller.notFound(Controller);
			}
		});
	});
};
loadController();