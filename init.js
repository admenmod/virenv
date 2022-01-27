'use strict';
let {
	NameSpace, SymbolSpace,
	codeShell, createPrivileges, random, JSONcopy,
	loader, loadImage, loadScript, generateImage,
	EventEmitter, Scene, Child,
	Vector2, vec2, VectorN, vecN,
	CameraImitationCanvas, CanvasLayer
} = globalThis.Ver;

let cvs = document.querySelector('#canvas');
let { main, back } = cvs.cameraImitationCanvas;

let touches = new TouchesController(cvs);

let db = {}; // resures: [images, audios]


loadScript('ns_objects/global_ns.js');
loadScript('ns_objects/virenv_ns.js');

loadScript('scenes/main.js');


//========== LoopGame ==========//
(() => {
	let prevTime = 0;
	function _update(dt) {
		if(dt-prevTime < 100) Scene.update(dt-prevTime);
		prevTime = dt;
		touches.nullify();
		requestAnimationFrame(_update);
	};
	requestAnimationFrame(_update);
})();
