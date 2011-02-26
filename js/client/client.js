/*global DP, Proxy, JSON, io, cs, SceneJS, ASSERT, DPD, LOG, inherit, superClass, BlenderExport */
/*global Enemy */
(function(){
var DEBUG = true;
var isStoppingWorld = false;
var useVR920 = false;

var kinect_proxy, field, player, indexPool;

var FPS = 20;
var jointBaseY = 0;

var SCALE = 0.008;
var FIELD_X_WIDTH = 100.0;
var FIELD_Z_WIDTH = 100.0;
var FIELD_Y_WIDTH = 30.0;
var ENEMY_SIZE = 10;
var EYE_Z = 70;	// todo: check SCALE
var LOOK_AT_EYE = { x: 0.0, y: 10, z: EYE_Z };

// util
// todo: create objects
function setNodeXYZ(in_id, in_pos){
	var node = SceneJS.withNode(in_id);
	node.set('x', in_pos.x);
	node.set('y', in_pos.y);
	node.set('z', in_pos.z);	
}

function normalize(in_pos){
	var l = Math.sqrt(Math.pow(in_pos.x, 2) + Math.pow(in_pos.y, 2) + Math.pow(in_pos.z, 2));
	var normalized = cs.deepCopy(in_pos);
	normalized.x = normalized.x / l;
	normalized.y = normalized.y / l;
	normalized.z = normalized.z / l;
	return normalized;
}

function calcAngle(in_edge1, in_edge2, in_edge_point){
	var edge_point_base_edge1 = {x: in_edge1.x - in_edge_point.x, y: in_edge1.y - in_edge_point.y, z: in_edge1.z - in_edge_point.z};
	var edge_point_base_edge2 = {x: in_edge2.x - in_edge_point.x, y: in_edge2.y - in_edge_point.y, z: in_edge2.z - in_edge_point.z};
	var normalized_edge1 = normalize(edge_point_base_edge1);
	var normalized_edge2 = normalize(edge_point_base_edge2);
	return Math.acos(normalized_edge1.x * normalized_edge2.x +
		normalized_edge1.y * normalized_edge2.y +
		normalized_edge1.z * normalized_edge2.z
	) * 180 / Math.PI;
	
}
function isOverlapped(in_pos1, in_r1, in_pos2, in_r2){
	if (Math.pow(in_pos1.x - in_pos2.x, 2) + Math.pow(in_pos1.y - in_pos2.y, 2) + Math.pow(in_pos1.z - in_pos2.z, 2) < Math.pow(in_r1 + in_r2, 2)) {
		return true;
	}
	return false;
}
function calcDistance(in_pos1, in_pos2){
	return Math.sqrt(Math.pow(in_pos1.x - in_pos2.x, 2) + Math.pow(in_pos1.y - in_pos2.y, 2) + Math.pow(in_pos1.z - in_pos2.z, 2));
}
function createAndMountNodes(in_node, in_id){
	SceneJS.Message.sendMessage({
		command: 'create',
		nodes: [{
			type: 'node',
			id: in_id,
			nodes: in_node
		}]
	});
	SceneJS.Message.sendMessage({
		command: 'update',
		target: 'mount-node',
		add: {
			node: in_id
		}
	});
}

function displayMessage(in_message){
	var ele = document.getElementById('message');
	if (!ele) {
		var canvas = document.getElementById('main_canvas');
		var bound_rect = canvas.getBoundingClientRect();
	
		ele = document.createElement('div');
		ele.id = 'message';
		ele.style.top =  bound_rect.top + window.scrollY + bound_rect.height / 3 + 'px';
		ele.style.left =  bound_rect.left + window.scrollX + bound_rect.width / 3 + 'px';
		ele.style.height =  bound_rect.height / 3 + 'px';
		ele.style.width =  bound_rect.width / 3 + 'px';
		document.documentElement.appendChild(ele);
	}
	ele.innerHTML = in_message;
}

var stopTimer = -1;
function stopWorld(){
	if (stopTimer === -1) {
		isStoppingWorld = !isStoppingWorld;
	}
	stopTimer = setTimeout(function(){
		stopTimer = -1;
	}, 3000);
}

// Field
function Field(in_aspect){
	this._idMap = {};

	SceneJS.createNode({
		type: "scene",
		id: "the-scene",
		canvasId: "main_canvas",
		loggingElementId: "theLoggingDiv",
		nodes: [{
			type: "lookAt",
			eye : LOOK_AT_EYE, 
			look : { x:0, y:0, z:0 },
			up : { y: 1.0 },
			id: "player_eye",
			nodes: [{
				type: "camera",
				optics: {
					type: "perspective",
					fovy : 25.0,
					aspect : in_aspect,
					near : 0.10,
					far : 300.0
				},
				nodes: [{
					type: "light",
					mode: "dir",
					color: { r: 0.9, g: 0.9, b: 0.9 },
					diffuse: true,
					specular: true,
					dir: { x: 0.0, y: 10.0, z: 0.0 },
					pos: { x: 0.0, y: 0.0, z: 0.0}
				},
				{
					type: "light",
					mode: "dir",
					color: { r: 0.3, g: 0.3, b: 0.3 },
					diffuse: true,
					specular: true,
					dir: { x: 0.0, y: 0.0, z: EYE_Z - 1 },
					pos: { x: 0.0, y: 10.0, z: EYE_Z }
				},
				{
				    type: "material",
				    id: "floor",
				    baseColor: { r: 0.2, g: 0.2, b: 0.2 },
				    shine: 6.0,
				    nodes: [{
			            type: "texture",
			            layers: [{
		                    uri: "img/wall.png",
		                    minFilter: "linearMipMapLinear",
		                    wrapS: "repeat",
		                    wrapT: "repeat",
		                    scale : { x: 100.0, y: 100.0, z: 10.0 }
			            }],
			            nodes: [{
							type: "translate",
							y: -1,
							nodes: [{
			                    type: "scale",
			                    x: FIELD_X_WIDTH / 2,
			                    y: 1.0,
			                    z : FIELD_Z_WIDTH / 2,
			                    nodes: [{
			                    	type: "cube"
			                    }]
							}]
			            }]
				    }]
				},
				/*
				{
		            type: "cube",	// base cube
					xSize: 0.1,
					ySize : 0.1,
					zSize : 0.1
				},
				*/
				{
					type: "node",
					id: "mount-node"
				}]
			}]
		}]
	});
}
Field.prototype.getPiece = function(in_id){
	return this._idMap[in_id];
};
Field.prototype.addPiece = function(in_piece, in_id){
	ASSERT(!this._idMap[in_id]);
	this._idMap[in_id] = in_piece;
};
Field.prototype.removePiece = function(in_id){
	ASSERT(this._idMap[in_id]);
	delete this._idMap[in_id];
};
Field.prototype.getPiecesByType = function(in_type){
	var pieces = [];
	for (var id in this._idMap) {
		var piece = this._idMap[id];
		if (piece.type === in_type) {
			pieces.push(piece);
		}
	}
	return pieces;
};
Field.prototype.initEnemies = function(){
	for (var i = 0; i < 10; i++) {
		var x = Math.random() * 50 - 25;
		var y = ENEMY_SIZE / 2 - 1;
		var z = -40 + (Math.random() * 30 - 15);
		new Enemy({x: x, y: y, z: z});
	}
};

// Piece
function Piece(in_point, in_type){
	this.heldIndex = indexPool.hold();
	this.id = in_type + this.heldIndex;
	this.pos = in_point;
	this.type = in_type;
	field.addPiece(this, this.id);
}
Piece.prototype.destroy = function(){
	field.removePiece(this.id);
	indexPool.release(this.heldIndex);
	SceneJS.Message.sendMessage({
		command: "update",
		target: 'mount-node',
		remove: {
			node: this.id
		}
	});
};
Piece.prototype._createNode = function(in_node){
	var nodes = [];

	nodes.push({
		type: 'translate',
		id: this.id + '-translate',
		x: this.pos.x,
		y: this.pos.y,
		z: this.pos.z,
		nodes: [{
			type: 'rotate',
			id: this.id + '-rotate-y',
			angle: 0.0,
			y: 1.0,
			nodes: [{
				type: 'rotate',
				id: this.id + '-rotate-x',
				angle: 0.0, 
				x: 1.0,
				nodes: [{
					type: 'rotate',
					id: this.id + '-rotate-z',
					angle: 0.0,
					z: 1.0,
					nodes: [{
						type: 'scale',
						id: this.id + '-scale',
						nodes: [ in_node ]
					}]
				}]
			}]
		}]
	});
	
	createAndMountNodes(nodes, this.id);
};
Piece.prototype.updateScale = function(in_x, in_y, in_z) {
	var scale = SceneJS.withNode(this.id + '-scale');
	scale.set('x', in_x);	
	scale.set('y', in_y);	
	scale.set('z', in_z);
};
Piece.prototype.updatePosition = function(in_pos) {
	this.pos = in_pos;
	var translate = SceneJS.withNode(this.id + '-translate');
	translate.set('x', in_pos.x);	
	translate.set('y', in_pos.y);	
	translate.set('z', in_pos.z);
};

// Movable Object
function MovableObject(in_point, in_type, in_speed, in_handle_dir){
	superClass(MovableObject).constructor.apply(this, [in_point, in_type]);
	this.handleDir = in_handle_dir;
	this.speed = in_speed;
	var self = this;
	this.moveTimer = setInterval(function(){
		if (isStoppingWorld) {
			return;
		}
		var new_pos = {};
		new_pos.x = self.pos.x + self.handleDir.x * self.speed;
		new_pos.y = self.pos.y + self.handleDir.y * self.speed;
		new_pos.z = self.pos.z + self.handleDir.z * self.speed;
		var old_pos = cs.deepCopy(self.pos);
		self.updatePosition(new_pos);
		if(!self.moving(old_pos)) {
			clearInterval(self.moveTimer);
			self.moveTimer = -1;
		}
	}, MovableObject.TIMER_INTERVAL); 
}
MovableObject.TIMER_INTERVAL = 100;
inherit(MovableObject, Piece);
MovableObject.prototype.destroy = function(){
	if (this.moveTimer !== -1) {
		clearInterval(this.moveTimer);
	}
	superClass(MovableObject).destroy.apply(this, []);
};
MovableObject.prototype.moving = function(in_old_pos){
	return true;
};

// Bullet
function Bullet(in_point, in_speed, in_handle_dir, in_owner_type){
	superClass(Bullet).constructor.apply(this, [in_point, 'bullet', in_speed, in_handle_dir]);
	this.ownerType = in_owner_type;
	this._createNode();
}
inherit(Bullet, MovableObject);
Bullet.type = {
	enemy: {
		color: { r: 0.0, g: 0.0, b: 1.0 },
		r: 0.3
	},
	player: {
		color: { r: 1.0, g: 1.0, b: 1.0 },
		r: 0.5
	}
};
Bullet.calcDir = function(in_start, in_end, in_vibration){	// todo: fix to use angle as direction
	ASSERT(0 <= in_vibration && in_vibration <= 1);
	var normalized = normalize({
		x: in_end.x - in_start.x,
		y: in_end.y - in_start.y,
		z: in_end.z - in_start.z
	});
	if (in_vibration !== 0) {
		normalized.x += Math.floor(Math.random() * (in_vibration * 100)) / 100 - in_vibration / 2;
		normalized.y += Math.floor(Math.random() * (in_vibration * 100)) / 100 - in_vibration / 2;
		normalized.z += Math.floor(Math.random() * (in_vibration * 100)) / 100 - in_vibration / 2;
	}
	return normalized;
};
Bullet.prototype._createNode = function(){
	superClass(Bullet)._createNode.apply(this, [{
		type: "material",
		baseColor: Bullet.type[this.ownerType].color,
		shine:          4.0,
		opacity:        1.0,
        nodes: [{
        	type: "sphere"
        }]
	}]);
	var r = Bullet.type[this.ownerType].r;
	this.updateScale(r, r, r);
};
Bullet.POWER = 10;
Bullet.prototype.moving = function(in_old_pos){
	superClass(Bullet).moving.apply(this, []);
	var r = Bullet.type[this.ownerType].r;
	if (this.pos.x + r * 2 < -FIELD_X_WIDTH / 2 || this.pos.x - r * 2 > FIELD_X_WIDTH / 2 ||
		this.pos.y + r * 2 < 0 || this.pos.y - r * 2 > FIELD_Y_WIDTH ||
		this.pos.z + r * 2 < -FIELD_Z_WIDTH / 2 || this.pos.z - r * 2 > FIELD_Z_WIDTH / 2) {
		this.destroy();
		return false;
	}
	if (this.ownerType === 'enemy') {
		if (player.checkShieldCollision(this.pos, Bullet.type[this.ownerType].r)) {
			this.destroy();
			return false;
		}
		if (player.checkDamageCollision(this.pos, Bullet.type[this.ownerType].r)) {
			player.setDamege(Bullet.POWER);
			this.destroy();
			return false;
		}
	} else {
		ASSERT(this.ownerType === 'player');
		var enemies = field.getPiecesByType('enemy');
		var len = enemies.length;
		for (var i = 0; i < len; i++) {
			var enemy = enemies[i];
			if (enemy.checkCollision(this.pos, Bullet.type[this.ownerType].r)) {
				enemy.setDamege(Bullet.POWER);
				this.destroy();
				return false;
			}
		}
	}
	return true;
};

// Enemy
function Enemy(in_point){
	superClass(Enemy).constructor.apply(this, [in_point, 'enemy']);
	var self = this;
	this.throwTimer = setInterval(function(){
		if (isStoppingWorld) {
			return;
		}
		if (Math.floor(Math.random() * 10) !== 1) {
			return;
		}
		var player_pos = player.getRandomJointPosition();
		if (!player_pos) {
			return;
		}
		var VIBRATION = 0.04;
		var dir = Bullet.calcDir(self.pos, player_pos, VIBRATION);
		new Bullet(self.pos, 2, dir, 'enemy');
	}, 2000);
//	}, 100);
	this._createNode();
}
inherit(Enemy, Piece);
Enemy.X_ANGLE_BASE = 270.0;
Enemy.prototype.destroy = function(){
	if (this.throwTimer !== -1) {
		clearInterval(this.throwTimer);
	}
	superClass(Enemy).destroy.apply(this, []);
};
Enemy.prototype._createNode = function(){
	superClass(Enemy)._createNode.apply(this, [{
		type: "material",
		baseColor: { r: 1.0, g: 1.0, b: 1.0 },
		nodes: [{
			type: "texture",
			layers: [{
				uri: BlenderExport.enemy.textureUri,
				blendMode: "multiply"
			}],
			nodes: [{
				type: "geometry",
				primitive: "triangles",			
				positions: BlenderExport.enemy.vertices,
				uv: BlenderExport.enemy.texCoords,
				indices: BlenderExport.enemy.indices
			}]
		}]
	}]);
	SceneJS.withNode(this.id + '-rotate-x').set('angle', Enemy.X_ANGLE_BASE); 
	this.updateScale(ENEMY_SIZE, ENEMY_SIZE, ENEMY_SIZE);
};
Enemy.prototype.checkCollision = function(in_pos, in_r){
	if (isOverlapped(this.pos, ENEMY_SIZE, in_pos, in_r)) {
		return true;
	}
	return false;
};
Enemy.prototype.setDamege = function(in_damege){
	this.destroy();
	var enemies = field.getPiecesByType('enemy');
	if (enemies.length === 0) {
		displayMessage('You win.');
	}
};

// Joint
function Joint(in_type, in_player){
	function createEdge(in_id) {
		return {
			type: "translate",
			id: in_id,
			nodes: [{
				type: "material",
				baseColor: { r: 1.0, g: 0.0, b: 0.0 },
				shine: 1.0,
				opacity: 1.0,
				nodes: [{
					type : "cube",
					xSize: Joint.H_SIZE,
					ySize: Joint.H_SIZE,
					zSize: Joint.H_SIZE
				}]
			}]
		};
	}
	function createShield(in_id) {
		return {
			type: "translate",
			id: in_id,
			nodes: [{
			    type: "material",
			    baseColor: { r: 0.2, g: 0.2, b: 0.2 },
			    shine: 6.0,
				opacity: 0.9,
			    nodes: [{
		            type: "texture",
		            layers: [{
	                    uri: "img/shield.png",
	                    minFilter: "linearMipMapLinear",
	                    wrapS: "repeat",
	                    wrapT: "repeat",
	                    scale : { x: 1.0, y: 1.0, z: 1.0 }
		            }],
					nodes: [{
	                    type: "scale",
	                    x: Joint.LEFT_SIELD_H_SIZE,
	                    y: Joint.LEFT_SIELD_H_SIZE,
	                    z: 0.1,
	                    nodes: [{
	                    	type: "cube"
	                    }]
		            }]
			    }]
			}]
		};
	}

	this.type = in_type;
	this.pos = null;
	this.heldIndex = indexPool.hold();
	this.id = this.type + this.heldIndex;

	if (this.type === 'LEFT_HAND') {
		this.harfSize =  Joint.LEFT_SIELD_H_SIZE;
		this._createNode(createShield);
	} else {
		this.harfSize =  Joint.H_SIZE;
		this._createNode(createEdge);
	}
	
}
Joint.H_SIZE = 0.3;
Joint.LEFT_SIELD_H_SIZE = 1.5;
Joint.types = [
	'HEAD',
	'NECK',
	'LEFT_SHOULDER',
	'RIGHT_SHOULDER', 
	'LEFT_ELBOW',
	'RIGHT_ELBOW',
	'LEFT_HAND',
	'RIGHT_HAND',	
	'TORSO',
	'LEFT_HIP',
	'RIGHT_HIP',	
	'LEFT_KNEE',
	'RIGHT_KNEE',
	'LEFT_FOOT',
	'RIGHT_FOOT'
];
Joint.prototype.destroy = function(){
	ASSERT(false);	// release index, destroy node
};
Joint.prototype._createNode = function(in_factory){
	var nodes = [];

	nodes.push(in_factory(this.id + '-translate'));

	createAndMountNodes(nodes, this.id);
};
Joint.prototype.setPosition = function(in_pos){
	this.pos = in_pos;
	setNodeXYZ(this.id + '-translate', this.pos);
};
Joint.prototype.checkCollision = function(in_pos, in_r){
	if (!this.pos) {
		return false;
	}
	if (isOverlapped(this.pos, this.harfSize, in_pos, in_r)) {
		return true;
	}
	return false;
};
Joint.prototype.getPosition = function(){
	var node = SceneJS.withNode(this.id + '-translate');
	return {x: node.get('x'), y: node.get('y'), z: node.get('z')};
};

// EdgePoint
function EdgePoints(in_type){
	this.type = in_type;
	this.poss = [];
	this.heldIndex = indexPool.hold();
	this.id = this.type + this.heldIndex;
	this._createNode();
}
EdgePoints.types = [
	'HEAD-NECK',
	'NECK-LEFT_SHOULDER',
	'LEFT_SHOULDER-LEFT_ELBOW',
	'LEFT_ELBOW-LEFT_HAND',
	'NECK-RIGHT_SHOULDER',
	'RIGHT_SHOULDER-RIGHT_ELBOW',
	'RIGHT_ELBOW-RIGHT_HAND',
	'LEFT_SHOULDER-TORSO',
	'RIGHT_SHOULDER-TORSO',
	'TORSO-LEFT_HIP',
	'LEFT_HIP-LEFT_KNEE',
	'LEFT_KNEE-LEFT_FOOT',
	'TORSO-RIGHT_HIP',
	'RIGHT_HIP-RIGHT_KNEE',
	'RIGHT_KNEE-RIGHT_FOOT',
	'LEFT_HIP-RIGHT_HIP'
];
EdgePoints.H_SIZE = 0.05;
EdgePoints.NUM = 2;
EdgePoints.prototype.destroy = function(){
	ASSERT(false);	// release index, destroy node
};
EdgePoints.prototype._createNode = function(){
	var nodes = [];
	for (var i = 0; i < EdgePoints.NUM; i++) {
		nodes.push({
			type: "translate",
			id: this.id + '-' + i + '-translate',
			nodes: [{
				type: "material",
				baseColor:	  { r: 1.0, g: 0.0, b: 0.0 },
				shine:          4.0,
				opacity:        1.0,
				nodes: [{
					type : "cube",
					xSize: EdgePoints.H_SIZE,
					ySize : EdgePoints.H_SIZE,
					zSize : EdgePoints.H_SIZE
				}]
			}]
		});
	}
	createAndMountNodes(nodes, this.id);
};
EdgePoints.calcPosition = function(in_from_pos, in_to_pos, in_index){
	return {
		x: in_from_pos.x + (in_to_pos.x - in_from_pos.x) / (EdgePoints.NUM + 1) * (in_index + 1),
		y: in_from_pos.y + (in_to_pos.y - in_from_pos.y) / (EdgePoints.NUM + 1) * (in_index + 1),
		z: in_from_pos.z + (in_to_pos.z - in_from_pos.z) / (EdgePoints.NUM + 1) * (in_index + 1)
	};
};
EdgePoints.prototype.setPosition = function(in_from_pos, in_to_pos){
	for (var i = 0; i < EdgePoints.NUM; i++) {
		var pos = EdgePoints.calcPosition(in_from_pos, in_to_pos, i);
		this.poss[i] = pos;
		setNodeXYZ(this.id + '-' + i + '-translate', pos);
	}
};
EdgePoints.prototype.checkCollision = function(in_pos, in_r){
	for (var i = 0; i < EdgePoints.NUM; i++) {
		if (this.poss[i]) {
			if (isOverlapped(this.poss[i], EdgePoints.H_SIZE, in_pos, in_r)) {
				return true;
			}
		}
	}
	return false;
};


// GestureManager
// todo: refactoring
function GestureManager(in_player){
	this.player = in_player;
	this.positionSnapshots = [];
	this.twistArm = {left: false, right: false};
	var self = this;
	this.timer = setInterval(function(){
		self.storeSnapShot();
		self.DetectAction();
	}, GestureManager.INTERVAL);
}
GestureManager.INTERVAL = 100;
GestureManager.SNAPSHOT_NUM_MAX = 30;
GestureManager.prototype.destroy = function(){
	if (this.timer !== -1) {
		clearInterval(this.timer);
	}
};
GestureManager.prototype.storeSnapShot = function(){
	var len = Joint.types.length;
	var snapshot = {};
	for (var i = 0; i < len; i++) {
		var id = Joint.types[i];
		var joint = this.player.joints[id];
		if (joint.pos) {
			snapshot[joint.type] = cs.deepCopy(joint.pos);
		}
	}
	this.positionSnapshots.push(snapshot);
	if (this.positionSnapshots.length > GestureManager.SNAPSHOT_NUM_MAX) {
		this.positionSnapshots.shift();
	}
	ASSERT(this.positionSnapshots.length <= GestureManager.SNAPSHOT_NUM_MAX);
};
GestureManager.prototype.DetectAction = function(){
	var self = this;
	function checkStraightArm(in_shoulder, in_hand, in_old_hand, in_elbow, in_dir){
		var angle = calcAngle(in_shoulder, in_hand, in_elbow);
		if (angle >= 150) {
			if (self.twistArm[in_dir] === true) {
				var speed = calcDistance(in_hand, in_old_hand);
				self.twistArm[in_dir] = false;
				var dir = Bullet.calcDir(in_shoulder, in_hand, 0);
				new Bullet(in_hand, speed * 4, dir, 'player');
			}
		} else if (angle <= 90) {
			self.twistArm[in_dir] = true;
		}
	}
	function checkStopingWorld(in_left_shoulder, in_left_elbow, in_left_hand, in_right_hand, in_head){
		var angle = calcAngle(in_left_shoulder, in_left_hand, in_left_elbow);
		var distance = calcDistance(in_right_hand, in_head);
		if (angle < 170 && distance < 2) {
			return true;
		} else {
			return false;
		}
	}
	
	if (self.positionSnapshots.length === 0) {
		return;
	}
	var snapshot = self.positionSnapshots[self.positionSnapshots.length - 1];
	var old_snapshot3 = self.positionSnapshots[self.positionSnapshots.length - 3];
	var old_snapshot10 = self.positionSnapshots[self.positionSnapshots.length - 20];
	if (!snapshot || !old_snapshot3) {
		return;
	}
	if (snapshot['RIGHT_SHOULDER'] && snapshot['RIGHT_HAND'] && snapshot['RIGHT_ELBOW'] && old_snapshot3['RIGHT_HAND']) {
		checkStraightArm(snapshot['RIGHT_SHOULDER'], snapshot['RIGHT_HAND'], old_snapshot3['RIGHT_HAND'], snapshot['RIGHT_ELBOW'], 'right');
	}
	if (old_snapshot10) {
		if (snapshot['LEFT_SHOULDER'] && snapshot['LEFT_ELBOW'] && snapshot['LEFT_HAND'] && snapshot['RIGHT_HAND'] && snapshot['HEAD'] &&
			old_snapshot10['LEFT_SHOULDER'] && old_snapshot10['LEFT_ELBOW'] && old_snapshot10['LEFT_HAND'] && old_snapshot10['RIGHT_HAND'] && old_snapshot10['HEAD']) {
			if (checkStopingWorld(snapshot['LEFT_SHOULDER'], snapshot['LEFT_ELBOW'], snapshot['LEFT_HAND'], snapshot['RIGHT_HAND'], snapshot['HEAD']) && 
				checkStopingWorld(old_snapshot10['LEFT_SHOULDER'], old_snapshot10['LEFT_ELBOW'], old_snapshot10['LEFT_HAND'], old_snapshot10['RIGHT_HAND'], old_snapshot10['HEAD'])) {
				stopWorld();
			}
		}		
	}
};

// Player
function Player(){
	this.id = 'player';
	this.life = Player.LIFE_MAX;

	this.joints = {};
	var len = Joint.types.length;
	for (var i = 0; i < len; i++) {
		var type = Joint.types[i];
		this.joints[type] = new Joint(type, this);
	}
	this.edge_points = {};
	len = EdgePoints.types.length;
	for (i = 0; i < len; i++) {
		type = EdgePoints.types[i];
		this.edge_points[type] = new EdgePoints(type);
	}
	this._gestureManager = new GestureManager(this);
}
Player.prototype.destroy = function(){
	ASSERT(false);	// todo: remove scene.js nodes
	this._gestureManager.destroy();
};
Player.LIFE_MAX = 200;
Player.prototype.setJointPosition = function(in_update){
	this.joints[in_update.from.name].setPosition(in_update.from);
	this.joints[in_update.to.name].setPosition(in_update.to);
	this.edge_points[in_update.from.name + '-' + in_update.to.name].setPosition(in_update.from, in_update.to);
};
Player.prototype.getRandomJointPosition = function(){
	return this.joints[Joint.types[Math.floor(Math.random() * Joint.types.length)]].pos;
};
Player.prototype.debugString = function(){
	var pos = this.joints['HEAD'].getPosition();
	return JSON.stringify(pos);
};

Player.prototype.checkShieldCollision = function(in_pos, in_r){
	return this.joints['LEFT_HAND'].checkCollision(in_pos, in_r);
};

Player.prototype.checkDamageCollision = function(in_pos, in_r){
	for (var k in this.joints) {
		if (k === 'LEFT_HAND') {	// todo: 'shield' attribute must be attribute of each joint.
			continue;
		}
		var joint = this.joints[k];
		if (joint.checkCollision(in_pos, in_r)) {
			return true;
		}
	}
	for (k in this.edge_points) {
		var edge_point = this.edge_points[k];
		if (edge_point.checkCollision(in_pos, in_r)) {
			return true;
		}
	}
	return false;
};
Player.prototype.setDamege = function(in_damege){
	this.life -= in_damege;
	this.life = (this.life < 0) ? 0: this.life;
	document.getElementById('life_bar_life').style.width = this.life * (100 / Player.LIFE_MAX) + '%';

	if (this.life === 0 && !DEBUG) {
		displayMessage('You lose. Press F5 to retry.');
	}
};

// Proxy
function Proxy(in_port, in_open_proc, in_message_proc, in_close_proc){
	var full_domain = location.href.split('/')[2].split(':')[0];
	this.socket = new io.Socket(full_domain, {port: in_port}); 
	this.socket.connect();

	this.socket.on('connect', function(){ in_open_proc(); });
	this.socket.on('message', function(in_data){ in_message_proc(in_data); });
	this.socket.on('disconnect', function(){ in_close_proc(); });
}
Proxy.prototype.send = function(in_message){
//	LOG('Proxy.prototype.send: ' + in_message);
	this.socket.send(in_message);
};
Proxy.prototype.close = function(){
	LOG('Proxy.prototype.close');
	this.socket.close();
};

// global methods
var oldFootY = {
	LEFT_FOOT: 0,
	RIGHT_FOOT: 0
};
var handleDeviceMessage = function(in_data){
//	DP(in_data);
	var data = JSON.parse(in_data);
	switch (data.type) {
	case 'kinect_joint_postion':
		data.arg.from.x *= SCALE; data.arg.from.y *= SCALE;	data.arg.from.z *= SCALE;
		data.arg.to.x *= SCALE; data.arg.to.y *= SCALE;	data.arg.to.z *= SCALE;
		
		if (data.arg.to.name === 'LEFT_FOOT' || data.arg.to.name === 'RIGHT_FOOT') {
			oldFootY[data.arg.to.name] = data.arg.to.y;
		}
		jointBaseY = -Math.min(oldFootY['LEFT_FOOT'] - Joint.H_SIZE, oldFootY['RIGHT_FOOT'] - Joint.H_SIZE);
	
		data.arg.from.y += jointBaseY;
		data.arg.to.y += jointBaseY;
		if (useVR920 && data.arg.from.name === 'HEAD') {
			SceneJS.withNode('player_eye').set('eye', {x: data.arg.from.x, y: data.arg.from.y, z: data.arg.from.z - (Joint.H_SIZE + 0.1)});
		}
		player.setJointPosition(data.arg);
		break;
	case 'vr920':
		if (!useVR920) {
			break;
		}
		var angle_y = data.arg.yaw * (180.0 / 32768) + 180;
		var angle_x = data.arg.pitch * (90.0 / 16384);
		var angle_z = data.arg.roll * (180.0 / 32768);
		
		var pos = cs.calcRoatatePosition({x: angle_x, y: angle_y, z: angle_z}, 10);
	
		var new_look_pos = {x:0, y:0, z:0};
		new_look_pos.x += pos[0];
		new_look_pos.y += pos[1];
		new_look_pos.z += pos[2];
		
		var player_eye = SceneJS.withNode('player_eye');
		var eye = player_eye.get('eye');
		
		new_look_pos.x += eye.x;
		new_look_pos.y += eye.y;
		new_look_pos.z += eye.z;
		
		player_eye.set('look', new_look_pos);
		break;
	}
};

var fpsCount = 0; 
function render() {
	fpsCount++;
	if (DEBUG) {
		var object_count = 0;
		for (var k in field._idMap) {
			object_count++;
		}
	//	document.getElementById('output').innerHTML = object_count;
	}
	SceneJS.withNode("the-scene").render();
}

function switchEyeMode(){
	if (useVR920) {
		SceneJS.withNode('player_eye').set('eye', LOOK_AT_EYE);
		this.innerHTML = 'VR920 on';
	} else {
		this.innerHTML = 'VR920 off';
	}
	useVR920 = !useVR920;
}

function handleLoad(in_e){
	var canvas = document.getElementById('main_canvas');
	canvas.width = document.body.clientWidth;
	canvas.height = document.body.clientHeight;

	var canvas_bound_rect = canvas.getBoundingClientRect();

	var life_bar = document.getElementById('life_bar');
	life_bar.style.width = (canvas_bound_rect.width - 20) + 'px';
	life_bar.style.left = canvas_bound_rect.left + window.scrollX + 10 + 'px';
	life_bar.style.top = canvas_bound_rect.top + window.scrollY + 10 + 'px';

	var fps = document.getElementById('fps');
	fps.style.left = canvas_bound_rect.left + window.scrollX + 10 + 'px';
	fps.style.top = canvas_bound_rect.top + window.scrollY + 30 + 'px';
	
	indexPool = new cs.IndexPool(0, 3000);

	document.getElementById('swith_VR920_mode').addEventListener('click', switchEyeMode, false);
	
	field = new Field(canvas.width / canvas.height);
	player = new Player();
	kinect_proxy = new Proxy(
		cs.DEVICE_PORT,
		function(in_e){
			LOG('open');
		},
		handleDeviceMessage,
		function(in_e){
			LOG('close');
		}
	);
	field.initEnemies();

	setInterval(function(){ render(); }, 1000 / FPS);
	setInterval(function(){
		document.getElementById('fps').innerHTML = fpsCount + 'FPS';
		fpsCount = 0;
	}, 1000);
}
window.addEventListener('load', handleLoad, false);

})();

