/*global require, JSON, DP, process */
var http = require('http');
var net = require('net');
var sys = require('sys');
var io = require('socket.io');
var fs = require('fs');
var cs = require('../client_and_server/client_and_server');

var ws, replay_path;
var is_replay = false;
if (process.argv[2] === '-w') {
	ws = fs.createWriteStream(process.argv[3]);
} else if (process.argv[2] === '-r') {
	is_replay = true;
	replay_path = process.argv[3];
}

// send to Browser
var server = http.createServer(function(in_req, in_res){
    in_res.writeHeader(200, {'Content-Type': 'text/html'});
    in_res.writeBody('<h1>Hello world</h1>');
    in_res.finish();
});
var socket = io.listen(server);

socket.on("connection", function(in_client){
	in_client.on("message", function(in_message){
		sys.log("message: " + in_message);
	});
	in_client.on("disconnect", function(){
	});
});
server.listen(cs.DEVICE_PORT);

// receive from OpenNI
var handleData = (function(){
	return function(in_buff, in_data){
		var mess = (in_buff + in_data.toString()).split('!');
		var len = mess.length;
		var new_buff = mess[len - 1];
		for (var i = 0; i < len - 1; i++) {
			socket.broadcast(mess[i]);
			if (ws) {
				ws.write(mess[i] + '!');
			}
		}
		return new_buff;
	};
})();
if (is_replay) {
	fs.open(replay_path, 'r', undefined, function(in_status, in_fd){
		if (in_status !== null) {
			process.exit();
		}
		var pos = 0;
		var READ_SIZE = 500;
		var buff = '';
		setInterval(function(){
			var data = fs.readSync(in_fd, READ_SIZE, pos, 'utf8');
			pos += READ_SIZE;
			if (data[1] !== READ_SIZE) {
				pos = 0;
			}
			buff = handleData(buff, data[0]);
		}, 40);
	});
}
net.createServer(function(in_socket){
	var buff = '';
	in_socket.on("data", function(in_data){
		buff = handleData(buff, in_data);
	});
	in_socket.on('error', function (in_exc) {
		sys.log("ignoring exception: " + in_exc);
	});
}).listen(8821, "127.0.0.1");
