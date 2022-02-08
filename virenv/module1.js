let module2 = require('module2.js');

let prv1 = 39;


module.exports.loop = function() {
	console.log('loop');
};

module.exports = {
	prv1,
	pub1: 30
}

console.log('inited module1');