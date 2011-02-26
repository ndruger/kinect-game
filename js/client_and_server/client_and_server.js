/*global global, console, DP, JSON, mat4, ASSERT */
if (typeof global != 'undefined') {	// node.js server
} else {	// client
	var exports = {};
}

(function(){

exports.REMOTE_PORT = 8721;
exports.DEVICE_PORT = 8889;
exports.FIELD_SIZE = 100;

exports.calcRoatatePosition = function(in_angle, in_r, oin_mat4){
	if (typeof oin_mat4 !== 'undefined') {	// todo
		mat4 = oin_mat4;
	}
	var modelView = mat4.create();
	
	mat4.identity(modelView);
	mat4.rotate(modelView, in_angle.x * (Math.PI / 180.0), [1, 0, 0]);
	mat4.rotate(modelView, in_angle.y * (Math.PI / 180.0), [0, 1, 0]);
	mat4.rotate(modelView, in_angle.z * (Math.PI / 180.0), [0, 0, 1]);

	var basePos = [0, 0, in_r];
	var newPos = [0, 0, 0];
	mat4.multiplyVec3(modelView, basePos, newPos);
	
//	DP(in_angle);
	
	return newPos;
};

// common
var DP = function(in_o){
	if (typeof console != 'undefined') {
		console.log(in_o);
	}
};
exports.DP = DP;
exports.LOG = function(in_o){
	DP(in_o);
};
exports.DPD = function(in_o){
	DP(JSON.stringify(in_o));
};
var ASSERT = function(in_exp, in_o){
	if (!in_exp) {
		if (typeof console != 'undefined') {
			debugger;
			DP('ASSERT: ' + in_o);
			//console.assert(in_exp, in_o);
		}
	}
};
exports.ASSERT = ASSERT;

exports.inherit = function(in_sub_class, in_super_class){
	for (var prop in in_super_class.prototype) {
		in_sub_class.prototype[prop] = in_super_class.prototype[prop];
	}
	in_sub_class.prototype.constructor = in_sub_class;
	in_sub_class.prototype.superClass = in_super_class;
};

exports.superClass = function(in_sub_class){
	return in_sub_class.prototype.superClass.prototype;
};

exports.deepCopy = function(in_o){
	if (in_o instanceof Array) {
		var new_array = [];
		var len = in_o.length;
		for (var i = 0; i < len; i++) {
			new_array[i] = exports.deepCopy(in_o[i]);
		}
		return new_array;
	} else if (typeof in_o === 'object') {
		var new_o = {};
		for (var k in in_o) {
			new_o[k] = exports.deepCopy(in_o[k]);
		}
		return new_o;
	} else {
		return in_o;
	}
};

// IntervalTimer
function IntervalTimer(){
	this.timer = -1;
	this.start = 0;
	this.proc = null;
}
IntervalTimer.prototype.setInterval = function(in_proc, in_limit, in_unit){
	this.start = (new Date()).getTime();
	this.proc = in_proc;
	var self = this;
	this.timer = setInterval(function(){
		var current = (new Date()).getTime();
		var progress = (current - self.start) / in_limit;
		progress = (progress > 1) ? 1: progress;
		if (!self.proc(progress) || current > self.start + in_limit) {
			clearInterval(self.timer);
			self.timer = -1;
		}
	}, in_unit);
};
IntervalTimer.prototype.IsEnd = function(){
	return (this.timer === -1);
};
IntervalTimer.prototype.clearInterval = function(in_do_last_action){
	if (in_do_last_action && this.timer !== -1) {
		this.proc(1);
	}
	clearInterval(this.timer);
	this.timer = -1;
};
exports.IntervalTimer = IntervalTimer;

// IndexPool
function IndexPool(in_start, in_end){
	this.pool = {};
	this.start = in_start;
	this.end = in_end;
	for (var i = in_start; i <= in_end; i++) {
		this.pool[i] = true;
	}
}
IndexPool.prototype.hold = function(){
	for (var k in this.pool) {
		delete this.pool[k];
		return k;
	}
	ASSERT(true);
};
IndexPool.prototype.release = function(in_index){
	ASSERT(!(in_index in this.pool));
	ASSERT(this.start <= in_index && in_index <= this.end);
	this.pool[in_index] = true;
};
exports.IndexPool = IndexPool;

})();
