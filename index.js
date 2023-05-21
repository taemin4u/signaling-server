var WebSocketServer = require('ws').Server,
  express = require('express'),
  http = require('http'),
  app = express(),
  server = http.createServer(app);

app.use(express.static('public'));
server.listen(80);

var wss = new WebSocketServer({ server: server, path: '/ws' });
users = {};

function sendTo(conn, message) {
  conn.send(JSON.stringify(message));
}

wss.on('connection', function (connection) {
  console.log('User connected');

  connection.on('message', function (message) {
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
          sendTo(connection, {
            type: 'login',
            success: false,
          });
        } else {
          users[data.name] = connection;
          connection.name = data.name;
          sendTo(connection, {
            type: 'login',
            success: true,
          });
        }
        break;

      // { "type": "offer", "name": "User2", "offer": "Hello, User2!" }
      case 'offer':
        console.log('sending offer to', data.name);
        var conn = users[data.name];

        if (conn != null) {
          connection.otherName = data.name;
          sendTo(conn, {
            type: 'offer',
            offer: data.offer,
            name: connection.name,
          });
        }
        break;

      // { "type": "answer", "name": "User1", "answer", "Hello to you too, User1!" }
      case 'answer':
        console.log('sending answer to', data.name);
        var conn = users[data.name];

        if (conn != null) {
          connection.otherName = data.name;
          sendTo(conn, {
            type: 'answer',
            answer: data.answer,
          });
        }
        break;

      case 'candidate':
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
        sendTo(connection, {
          type: 'error',
          message: 'Unrecognized command: ' + data.type,
        });
        break;
    }
  });

  connection.on('close', function () {
    if (connection.name) {
      delete users[connection.name];

      if (connection.otherName) {
        console.log('Disconnecting user from', connection.otherName);
        var conn = users[connection.otherName];
        conn.otherName = null;

        if (conn != null) {
          sendTo(conn, {
            type: 'leave',
          });
        }
      }
    }
  });

  // connection.send('Hello World');
});
