'use strict';
Scene.create('main', function() {
	let { netmap, CameraMoveingObject } = global_ns;
	
	let cameraMoveingObject = new CameraMoveingObject(main.camera);
	cvs.on('resize', e => netmap.size.set(cvs.size));
	
	
	let virenv = new virenv_ns.VirtualEnv();
	
	let loadScr = filepath => fetch('virenv/'+filepath)
		.then(data => data.text())
		.then(data => virenv.fs.writeFileSync(filepath, data, console.error));
	
	
	Promise.all([
		loadScr('main.js'),
		loadScr('module1.js'),
		loadScr('module2.js')
	]).then(() => {
	//	virenv.run('main.js');
	});


	//===============update===============//
	this.update = function(dt) {
		//=======prePROCES=======//--vs--//=======EVENTS=======//
		cameraMoveingObject.update(touches, main.camera);
		//==================================================//


		//=======PROCES=======//--vs--//=======UPDATE=======//
		
		//==================================================//


		//==========DRAW==========//--vs--//==========RENDER==========//
		main.ctx.clearRect(0, 0, cvs.width, cvs.height);
		
		netmap.draw(main);
		
		main.ctx.save();
		main.ctx.fillStyle = '#eeeeee';
		main.ctx.font = '15px Arial';
		main.ctx.fillText(Math.floor(1000/dt), 20, 20);
		main.ctx.restore();
	}; //==============================//
});

Scene.run('main');
