'use strict';
let virenv_ns = new function() {
	const BASE_API = {
		Vector2, vec2, VectorN, vecN, EventEmitter, random, JSONcopy,
		Promise, Proxy, WeakRef,
		console, Date, Math, JSON, Set, Map, WeakSet, WeakMap,
		Object, Array, Function, Number, String, RegExp, BigInt, Symbol
	};
	
	
	let delay = (cb, time = 0) => new Promise(res => {
		let t = setTimeout(() => {
			clearTimeout(t);
			res(cb());
		}, time);
	});
	
	
	let FileSystem = class extends EventEmitter {
		constructor(id) {
			super();
			
			if(!String(id)) throw Error('invalid id');
			this.id = id;
			
			let storage = window.localStorage.getItem(this.id);
			if(storage) this.storage = JSON.parse(storage);
			else this.storage = {};
			
			if(!FileSystem._cached[this.id]) {
				window.addEventListener('beforeunload', e => window.localStorage.setItem(this.id, JSON.stringify(this.storage)));
				FileSystem._cached[this.id] = 1;
			};
		}
		
		removeFileSync(src) { return delete this.storage[src]; }
		removeFile(src) {
			return new Promise((res, rej) => res(this.removeFileSync(src)));
		}
		
		hasFileSync(src) { return src in this.storage; }
		hasFile(src) {
			return new Promise((res, rej) => res(this.hasFileSync(src)));
		}
		
		readFileSync(src) { return this.storage[src]; }
		readFile(src) {
			return new Promise((res, rej) => res(this.readFileSync(src)));
		}
		
		writeFileSync(src, content = '') {
			if(typeof content !== 'string') throw Error('content is not a string');
			return this.storage[src] = content;
		}
		writeFile(src, content = '') {
			return new Promise((res, rej) => res(this.writeFileSync(src, content)));
		}
		
		static _cached = {};
	};
	
	
	let NameSpace = class extends EventEmitter {
		constructor() {
			super();
		}
	};
	
	
	function runScript(code, global, source, thisobj = {}) {
		global.__proto__ = {
			module: {
				exports: {},
				filename: source
			}
		};
		
		codeShell(code, global, { source }).call(thisobj);
		
		return global.module;
	};
	
	
	let Process = class extends EventEmitter {
		constructor(virenv, filepath) {
			super();
			let moduleCache = {};
			
			let require = name => {
				let module = null;
				
				if(name in moduleCache) module = moduleCache[name];
				else if(name in virenv.globalModules) module = virenv.globalModules[name]();
				else if(virenv.fs.hasFileSync(name)) module = runScript(virenv.fs.readFileSync(name), global, name);
				
				if(!module) throw Error('module "'+name+'" is not found');
				
				moduleCache[name] = module;
				return module.exports;
			};
			
			
			let process = {
				env: { ...virenv.namespace }
			};
			
			let global = {
				require, process,
				
				...BASE_API
			};
			global.global = global;
			
			
			runScript(virenv.fs.readFileSync(filepath), global, filepath);
		}
	};
	
	
	let VirtualEnv = this.VirtualEnv = class extends EventEmitter {
		constructor(fs_id = 'fs_storage') {
			super();
			this.globalModules = {};
			
			let namespace = this.namespace = new NameSpace();
			namespace.PATH = '/';
			
			let fs = this.fs = new FileSystem(fs_id);
			fs.on('changedir', path => namespace.PATH = path);
			
			this.globalModules.fs = () => ({ exports: fs, filename: 'fs' });
		}
		
		run(filepath) {
			let process = new Process(this, filepath);
		}
	};
	
	
	/*
	class VirEnv(fs_id) = {
		fs = new FileSystem(fs_id);
		globalModules[name] => module;
	};
	
	
	class Process(virenv, filepath) {
		global: Object
		process: Object
		module_cache
	}
	
	function runScript(
		code,
		global_api,
		filename
	) - and module
	*/
};
