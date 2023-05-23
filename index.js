var WebSocketServer = require('ws').Server,
  express = require('express'),
  http = require('http'),
  app = express(),
  server = http.createServer(app);

app.use(express.static('public'));
server.listen(8123);

var wss = new WebSocketServer({ server: server, path: '/ws' });
users = {};

function sendTo(conn, message) {
  conn.send(JSON.stringify(message));
}

wss.on('connection', function (socket) {
  console.log('User connected');

  socket.on('message', function (message) {
    var data;

    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log('Error Parsing JSON.');
      data = {};
    }

    switch (data.type) {
      // { "type": "login", "name": "User1" }
      // { "type": "login", "name": "User2" }
      case 'login':
        console.log('User logged in as', data.name);
        if (users[data.name]) {
          sendTo(socket, {
            type: 'login',
            success: false,
          });
        } else {
          users[data.name] = socket;
          socket.name = data.name;
          sendTo(socket, {
            type: 'login',
            success: true,
          });
        }
        break;

      // { "type": "offer", "name": "User2", "offer": "Hello, User2!" }
      // offer가 reciever의 ID를 적어서 보냄 -> 서버는 ID를 찾음 -> Receiver에게 offer의 데이터를 전달
      case 'offer':
        console.log('sending offer to', data.name);
        var conn = users[data.name];

        if (conn != null) {
          // socket.otherName: My Remote Peer's name
          socket.otherName = data.name;
          sendTo(conn, {
            type: 'offer',
            offer: data.offer,
            name: socket.name,
          });
        }
        break;

      // { "type": "answer", "name": "User1", "answer", "Hello to you too, User1!" }
      // Receiver가 다시 Offer에게 answer을 전달
      case 'answer':
        console.log('sending answer to', data.name);
        var conn = users[data.name];

        if (conn != null) {
          socket.otherName = data.name;
          sendTo(conn, {
            type: 'answer',
            answer: data.answer,
          });
        }
        break;

      case 'candidate':
        // 상대방에게 네트워크 정보 전달
        console.log('Sending candidate to', data.name);
        var conn = users[data.name];

        if (conn != null) {
          sendTo(conn, {
            type: 'candidate',
            candidate: data.candidate,
          });
        }
        break;

      // { "type": "leave", "name": "User2" }
      case 'leave':
        console.log('Disconnecting user from', data.name);
        var conn = users[data.name];

        if (conn != null) {
          if (conn.otherName != null) {
            conn.otherName = null;
          }

          sendTo(conn, {
            type: 'leave',
          });
        }
        break;

      default:
        sendTo(socket, {
          type: 'error',
          message: 'Unrecognized command: ' + data.type,
        });
        break;
    }
  });

  socket.on('close', function () {
    if (socket.name) {
      delete users[socket.name];

      // 상대방에게도 종료를 알려야함
      if (socket.otherName) {
        console.log('Disconnecting user from', socket.otherName);
        var conn = users[socket.otherName];

        if (conn) {
          conn.otherName = null;
          sendTo(conn, {
            type: 'leave',
          });
        }
      }
    }
  });

  // connection.send('Hello World');
});
