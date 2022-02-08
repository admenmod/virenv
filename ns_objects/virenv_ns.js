'use strict';
let virenv_ns = new function() {
	let main = {
		symbol: new SymbolSpace(),
		access: createPrivileges({
			root: 5
		})
	};
	
	
	let PRIVATE = main.symbol('PRIVATE');
	
	
	const BASE_API = {
		NameSpace, SymbolSpace,
		Vector2, vec2, VectorN, vecN, EventEmitter, random, JSONcopy,
		
		Error,
		
		setTimeout: (cb, ...args) => setTimeout(cb.bind({}), ...args), clearTimeout: clearTimeout.bind(globalThis),
		setInterval: (cb, ...args) => setInterval(cb.bind({}), ...args), clearInterval: clearInterval.bind(globalThis),
		
		Promise, Proxy, WeakRef, FinalizationRegistry,
		console, Date, Math, JSON, Set, Map, WeakSet, WeakMap,
		Object, Array, Number, String, RegExp, BigInt, Symbol,
		
		Function: function() {
			if(main.access.present.root < 5) return function() {};
			else return new Function(...arguments);
		},
		
		ArrayBuffer, DataView, Int8Array, Uint8Array, Uint8ClampedArray,
		Int16Array, Uint16Array, Int32Array, Uint32Array,
		Float32Array, Float64Array, BigInt64Array, BigUint64Array
	};
	
	Function.prototype.constructor = BASE_API.Function;
	
	let getOwnPropertySymbols = Object.getOwnPropertySymbols;
	Object.getOwnPropertySymbols = o => {
		let arr = getOwnPropertySymbols(o);
		if(main.access.present.root < 5) return arr.filter(i => !(i === PRIVATE || o[PRIVATE].includes(i)));
		return arr;
	};
	
	
	let delay = (cb, time = 0, ...args) => new Promise(res => {
		let t = setTimeout(() => {
			clearTimeout(t);
			res(cb(...args));
		}, time);
	});
	
	// CONSTANTS
	const MODE_BLOB    = 0x000001;
	const MODE_TREE    = 0x000002;
	const MODE_SYMLINK = 0x000003;
	
	const MODE_EXEC    = 0x000010;
	const MODE_ROOT    = 0x000020;
	
	
	const TYPE_BLOB = 'blob';
	const TYPE_TREE = 'tree';
	
	const INDEX_MODE = 0;
	const INDEX_TYPE = 1;
	const INDEX_ID = 2;
	const INDEX_FILENAME = 3;
	
	
	let generateID = () => Number(String(Math.random()).replace('0.', '')).toString(16).padStart(14, '0');
	
	
	let Path = class extends Array {
		constructor(src) {
			super();
			this.src = src;
		}
		
		get src() { return this._src; }
		set src(src) {
			this.splice(0, this.length, ...Path.parse(src));
			
			this.isAbsolute = Path.isAbsolute(src);
			this.isRelative = Path.isRelative(src);
			this.isPassive = Path.isPassive(src);
			this.isDirectory = Path.isDirectory(src);
			
			this.input = src;
			this._src = this.toSource();
			
			this.isNormalize = Path.isNormalize(this.src);
			
			Object.assign(this, Path.file(this));
		}
		
		toSource() { return Path.toSource(this); }
		
		normalize() { return Path.normalize(this, true); }
		
		valueOf() { return this.toSource(); }
		toString() { return this.toSource(); }
		[Symbol.toPrimitive]() { return this.toSource(); }
		
		
		static _cache = [];
		
		static dirExp = /\/+/;
		static fileExp = /\.(?!.*\.)/;
		
		// NOTE: относительный путь, учет ".../", "..."
		static isAbsolute(src) { return src.startsWith('/'); }
		static isRelative(src) { return src === '.' || src === '..' || src.startsWith('./') || src.startsWith('../'); }
		static isPassive(src) { return !(Path.isAbsolute(src) || Path.isRelative(src)); }
		static isDirectory(src) { return src.endsWith('/'); }
		static isNormalize(src) { return !Path.parse(src).some(i => i === '.' || i === '..'); }
		
		static parse(src) { return src.split(Path.dirExp).filter(Boolean); }
		static toPath(src) { return typeof src === 'string' ? new Path(src) : src; }
		
		static toSource(path, body = path) {
			return (path.isAbsolute ? '/':'')+body.join('/')+(body.length && path.isDirectory ? '/':'');
		}
		
		static file(src) {
			let path = Path.toPath(src);
			if(path.isDirectory) return null;
			
			let data = { dirpath: '', filename: '', name: '', exp: '' };
			
			let arr = [...path];
			data.filename = arr.pop();
			data.dirpath = Path.toSource({
				isAbsolute: path.isAbsolute,
				isDirectory: true
			}, arr);
			
			let [name, exp] = data.filename.split(Path.fileExp);
			data.name = name;
			data.exp = exp;
			
			return data;
		}
		
		static normalize(src, f = typeof src === 'string') {
			let path = Path.toPath(src);
			if(path.isNormalize) return path;
			
			let arr = [];
			for(let i of path) {
				if(i === '..') arr.pop();
				else if(i === '.') continue;
				else arr.push(i);
			};
			
			let newsrc = Path.toSource(path, arr);
			
			if(f) {
				path.src = newsrc;
				return path;
			} else return new Path(newsrc);
		}
		
	//	not forget: host, port, protocol
		static relative(...dirs) {
			let l = dirs.findIndex(src => Path.isAbsolute(src.toString()));
			dirs = dirs.slice(0, ~l ? l+1 : dirs.length).reverse();
			
			return new Path(Path.toSource({
				isAbsolute: Path.isAbsolute(dirs[0].toString()),
				isDirectory: Path.isDirectory(dirs[dirs.length-1].toString())
			}, dirs));
		}
		
		static get [Symbol.species]() { return Array; }
	};
	
	
	/*
	let proot = new Path('/');
	let pfile = new Path('./dir/subdir/file.md/');
	let pfile2 = new Path('./dir/subdir/file.md');
	let pfile3 = new Path('dir/file.md');
	let pdir = new Path('/dir/');
	
	
	let nnn = Path.relative('main.sys', '/work/dir/', '/root/exe');
	console.log(nnn.normalize(), nnn.normalize() === nnn);
	//*/
	
	/*	TODO:
	 *	BUG:
	 *	NOTE:
		
		FS Protocol* // meta
		FS Storage // физический файл | бинарные данные
		FS Virtual View // виртуальное представление FS в оперативной памяти
		FS SystemInfo (data) // информация о экземпляре файловой системы
	*/

	let FileSystem = class extends EventEmitter {
		constructor(id) {
			super();
			
			if(!String(id)) throw Error(`invalid id "${id}"`);
			
			this._id = id;
			this.rootId = generateID();
			
			if(FileSystem._cacheStorage[this.id]) {
				this._storage = FileSystem._cacheStorage[this.id];
			} else {
				this._storage = FileSystem.getcache?.(this.id) || { [this.rootId]: '' };
				
				FileSystem._cacheStorage[this.id] = this._storage;
				FileSystem.oncreate?.(this.id, this._storage);
			};
		}
		
		get id() { return this._id; }
		
		_getStorage() {}
		
	//	getJSONtoPath(src) {}
		getDirFiles(id) { return this._storage[id].split('\n').filter(Boolean).map(i => i.split(' ')); }
		
		getDataFile(src) {
			let path = Path.normalize(src);
			let [fileId, dirId] = this.getIdByPath(path);
			
			return this.getDirFiles(dirId).find(file => file[INDEX_FILENAME] === path.filename);
		}
		
		getIdByPath(src) {
			let path = Path.normalize(src);
			
			let prevId = null;
			let nextId = this.rootId;
			
			for(let i = 0; i < path.length; i++) {
				if(nextId === null) return [nextId, prevId];
				
				prevId = nextId;
				
				let file = this.getDirFiles(nextId).find(file => file[INDEX_FILENAME] === path[i]);
				
				nextId = file ? file[INDEX_ID] : null;
			};
			
			return [nextId, prevId];
		}
		
		removeFileSync(src, error = null) {
			if(typeof error !== 'function') throw Error('no error handler passed');
			
			let path = Path.normalize(src);
			let [fileId, dirId] = this.getIdByPath(path);
			
			if(!fileId) return void error(Error(`this path does not point to anything "${src}"`));
			
			
			let files = this.getDirFiles(dirId);
			
			let l = files.findIndex(file => {
				return file[INDEX_ID] === fileId && file[INDEX_TYPE] === TYPE_BLOB;
			});
			
			if(!~l) return void error(Error(`пока что нельзя удалять директории`));
			files.splice(l, 1);
			
			this._storage[dirId] = files.forEach(i => files[i] = i.join(' ')).join('\n');
			delete this._storage[fileId];
			
			return true;
		}
		
		removeFile(src) {
			return new Promise((res, rej) => res(this.removeFileSync(src, rej)));
		}
		
		hasFileSync(src) { return Boolean(this.getIdByPath(src)[0]); }
		hasFile(src) {
			return new Promise((res, rej) => res(this.hasFileSync(src)));
		}
		
		readFileSync(src, error = null) {
			if(typeof error !== 'function') throw Error('no error handler passed');
			
			let path = Path.normalize(src);
			let [fileId, dirId] = this.getIdByPath(path);
			
			if(!fileId) return void error(Error(`this path does not point to anything "${src}"`));
			return this._storage[fileId];
		}
		
		readFile(src) {
			return new Promise((res, rej) => res(this.readFileSync(src, rej)));
		}
		
		writeFileSync(src, data = '', error = null) {
			if(typeof error !== 'function') throw Error('no error handler passed');
			if(!data || typeof data !== 'string') return void error(Error('data is not a string'));
			
			let path = Path.normalize(src);
			let [fileId, dirId] = this.getIdByPath(path);
			
			if(!dirId) return void error(Error(`path does not exist "${path}"`));
			if(!path.filename) return void error(Error(`invalid path "${src}"`));
			
			let blobId = generateID();
			if(!fileId) {
				this._storage[dirId] += FileSystem.generateFile(MODE_BLOB, TYPE_BLOB, blobId, path.filename);
			};
			
			this._storage[blobId] = data;
			
			return true;
		}
		
		writeFile(src, data = '') {
			return new Promise((res, rej) => res(this.writeFileSync(src, data, rej)));
		}
		
		appendFileSync(src, data = '', error = null) {
			if(typeof error !== 'function') throw Error('no error handler passed');
			if(typeof data !== 'string') return void error(Error('data is not a string'));
			
			let path = Path.normalize(src);
			let [fileId, dirId] = this.getIdByPath(path);
			
			if(!fileId) return void error(Error(`path is empty "${src}"`));
			
			
			let files = this.getDirFiles(dirId);
			let isFound = files.some(i => {
				let data = i.split(' ');
				return data[INDEX_ID] === fileId && data[INDEX_TYPE] === TYPE_BLOB;
			});
			
			if(!isFound) error(Error(`path points to a tree "${src}"`));
			
			this._storage[fileId] += data;
			
			return true;
		}
		
		appendFile(src, data = '') {
			return new Promise((res, rej) => res(this.appendFileSync(src, data, rej)));
		}
		
		readDirSync(src, error = null) {
			if(typeof error !== 'function') throw Error('no error handler passed');
			
			let res = [];
			
			let [dirId] = this.getIdByPath(src);
			if(!dirId) return false;
			
			
			let files = this.getDirFiles(dirId);
			
			for(let file of files) {
				let data = file.split(' ');
				res.push(data[INDEX_FILENAME]);
			};
			
			return res;
		}
		
		readDir(src, error) {
			return new Promise((res, rej) => res(this.readDirSync(src, rej)));
		}
		
		
		mkdirSync(src, error = null) {
			if(typeof error !== 'function') throw Error('no error handler passed');
			
			let path = Path.normalize(src);
			let [fileId, dirId] = this.getIdByPath(path);
			
			if(fileId) return void error(Error(`cannot create directory "${src}": File exists`));
			if(!dirId) return void error(Error(`path does not exist "${path}"`));
			if(!path.filename) return void error(Error(`invalid path "${src}"`));
			
			let blobId = generateID();
			this._storage[dirId] += FileSystem.generateFile(MODE_TREE, TYPE_TREE, blobId, path.filename);
			this._storage[blobId] = '';
			
			return true;
		}
		
		mkdir(src) {
			return new Promise((res, rej) => res(this.mkdirSync(src, rej)));
		}
		
		
		static generateFile(mode, type, id, filename) {
			mode = String(mode.toString(16)).padStart(6, '0');
			return `${mode} ${type} ${id} ${filename}\n`;
		}
		
		static oncreate = null;
		static getcache = null;
		static _cacheStorage = {};
	};
	
	
	FileSystem.getcache = id => window.localStorage.getItem(id);
	
	FileSystem.oncreate = (id, storage) => {
		window.addEventListener('beforeunload', e => {
			window.localStorage.setItem(id, JSON.stringify(storage));
		});
	};
	
	
	let Debugger = class extends EventEmitter {
		constructor(_console = console) {
			super();
			
			this.console = {
				log: (...args) => {
					_console.log(...args);
					this.emit('log', ...args);
				},
				warn: (...args) => {
					_console.warn(...args);
					this.emit('warn', ...args);
				},
				error: (...args) => {
					_console.error(...args);
					this.emit('error', ...args);
				},
			};
		}
	};
	
	
	let executeCode = (code, api, p = {}) => {
		try {
			main.access.addPrivilege(codeShell(code, api, p), {
				root: 1
			}).call(api);
		} catch(err) {
			let arrStack = err.stack.split(/\n\s{4}at\s/);
			let end = arrStack.findIndex(i => i.startsWith('eval'));
			let res = arrStack.slice(0, end + 1).join('\n    at ');
			
			err.stack = res;
			
			if(p.debugger) p.debugger.console.error(err);
			else console.error(err);
		};
	};
	
	
	class Session {
		constructor(virenv) {
			this.namespace = new NameSpace();
			this.currentPath = new Path('/');
			
			this.namespace.PATH = this.currentPath.toString();
			this.on('changedir', (next, prev) => this.namespace.PATH = `${next}`);
		}
	};
	
	
	class Process extends EventEmitter {
		constructor(virenv, additionalApi) {
			super();
			
			this.namespace = new NameSpace(virenv.namespace);
			this.path = new Path(virenv.currentPath.toString());
			
			this.api = {
				...additionalApi,
				
				process: {
					env: this.namespace,
					execPath: this.path.toString()
				}
			};
			Object.defineProperty(this.api, 'global', { value: this.api });
			
			
			Object.assign(this.api, {
				...BASE_API,
				console: { ...virenv.debugger.console }
			});
			
			
			this.require = (src, dir = '', cache = {}) => {
				let module = null;
				let path = Path.relative(src, dir);
				
				if(cache[path]) module = cache[path];
				else if(module = virenv.getModule(src)) module = module(this.api);
				else if(virenv.fs.hasFileSync(path)) module = this.execute(path);
				
				if(!module) virenv.debugger.console.error(Error(`module "${path}" not found`));
				cache[path] = module;
				
				return module.exports || module;
			};
			
			
			this.execute = src => {
				let path = Path.relative(src, this.path, virenv.currentPath).normalize();
				
				if(path.isDirectory) {
					return void virenv.debugger.console.error(Error(`directory cannot be executed "${path}"`));
				};
				
				let data = virenv.fs.readFileSync(path, virenv.debugger.console.error);
				
				
				switch(path.exp) {
					case 'json': return JSON.parse(data)
					
					case 'js': {
						let cache = {};
						let api = this.api;
						
						api.require = src => this.require(src, path.dirpath, cache);
						api.require.cache = cache;
						
						api.module = {
							exports: {},
							filename: path.toString()
						};
						
						executeCode(data, this.api, {
							debugger: virenv.debugger,
							source: path.toString()
						})
						
						return api.module;
					}
					
					default: return data
				};
			};
		}
	};
	
	
	let VirtualEnv = this.VirtualEnv = class extends EventEmitter {
		constructor(fsId = 'fs_storage', p = {}) {
			super();
			
			this.fs = new FileSystem(fsId);
			
			this.debugger = new Debugger(console);
			
			
			this.coreModules = {};
			this.globalModules = {};
			this.nativeModules = {};
			
			this._appendModule('fs', global => ({ exports: this.fs, filename: 'fs' }), 'core');
			this._appendModule('path', global => ({ exports: Path, filename: 'path' }), 'core');
		}
		
		_appendModule(name, module, type) {
			return this[type+'Modules'][name] = module;
		}
		
		appendModule(name, module) { return this._appendModule(name, module, 'native'); }
		
		getModule(path) {
			this.namespace = new NameSpace();
			
			return this.coreModules[path] || this.globalModules[path] || this.nativeModules[path];
		}
		
		newSession() {
			return new Session(this);
		}
		
		createProcess(additionalApi = {}) {
			let process = new Process(this, additionalApi);
		//	console.log(process);
			
			return process;
		}
		/*
		createProcess(additionalApi = {}) {
			let execPath = new Path(this.currentPath.toString());
			
			let process = {
				env: new NameSpace(this.namespace),
				filename: execPath.toString()
			};
			
			
			let require = (src, dir = '') => {
				let module = null;
				let path = Path.relative(src, dir);
				
				if(api.require.cache[path]) module = api.require.cache[path];
				else if(module = this.getModule(src)) module = module(api);
				else if(this.fs.hasFileSync(path)) module = execute(path);
				
				if(!module) this.debugger.console.error(Error(`module "${path}" not found`));
				api.require.cache[path] = module;
				
				return module.exports || module;
			};
			
			
			let api = {
				...additionalApi,
				
				process,
				
				...BASE_API,
				console: { ...this.debugger.console }
			};
			Object.defineProperty(api, 'global', { value: api });
			
			
			let execute = src => {
				let path = Path.relative(src, execPath, this.currentPath).normalize();
				if(path.isDirectory) return void this.debugger.console.error(Error(`directory cannot be executed "${path}"`));
				
				let { dirpath, exp } = Path.file(path);
				
				let code = this.fs.readFileSync(path, this.debugger.console.error);
				
				if(exp === 'js') {
					api.require = src => require(src, dirpath);
					api.require.cache = {};
					
					api.module = {
						exports: {},
						filename: path.toString()
					};
					
					executeCode(code, api, {
						source: path.toString(),
						debugger: this.debugger
					});
					
					return api.module;
				} else if(exp === 'json') return JSON.parse(code);
				
				return code;
			};
			
			
			return execute;
		}
		*/
		
		/*
			root: корневой католог
			current: текущий католог
			execute: католог в котором был создан process
			path: каталог в котором запущен текущий файл
			
			чтобы получить пути до
				root = Path.relative('/')
				current = Path.relative({cd path}, root)
				execute = Path.relative(current.now, root)
				path = Path.relative(src, execute, root)
		*/
		
		
		cd(src) {
			let prev = this.currentPath.toString();
			let next = Path.relative(src, this.currentPath).normalize().toString();
			
			this.currentPath.src = next;
			this.emit('changedir', next, prev);
		}
		
		run(src) {
			return this.createProcess().execute(src);
		}
		
		cmd(code) {
			if(this.cmd_process) return executeCode(code, this.cmd_process.api, {
				source: 'console',
				debugger: this.debugger
			});
			
			this.cmd_process = this.createProcess({
				Path, fs: this.fs,
				
				cd: (...args) => this.cd(...args),
				run: (...args) => this.run(...args),
			});
			
			this.cmd(code);
		}
	};
	
	
	//*
	EventEmitter[main.symbol('private pole')] = 'hhh';
	EventEmitter[main.symbol('private 2 pole')] = 'hhdkkedh';
	EventEmitter[main.symbol('private 3 pole')] = 'kssmdjw93938339ndjwjedjd0h';
	
	EventEmitter[PRIVATE] = [main.symbol('private pole')];
	
	let virenv = new VirtualEnv('ve');
//	console.log(virenv.fs._storage);
	//*
	virenv.fs.mkdirSync('root', console.error);
	virenv.fs.mkdirSync('root/dir', console.error);
	virenv.fs.writeFileSync('root/dir/dd.json', '{ "jsondata": "bigdata" }', console.error);
	
	virenv.fs.writeFileSync('root/main.js', `
//	let ff = function() {};
//	let rr = new ff.__proto__.constructor('console.log(this);');
//	console.log(rr, rr());
	
//	console.log(Object.getOwnPropertySymbols(EventEmitter).map(i => i.description));
	
//	console.log(process);
	
	let dd = require('dir/dd.json');
	console.log(dd);
	`, console.error);
	//*/
//	console.log(virenv.fs._storage);
	
	virenv.cmd('console.log(this)');
	
	virenv.cd('root');
//	virenv.run('main.js');
	
	
//	virenv.run('root/main.js');
	//*/
};

