var name, connectedUser, yourConnection, stream;

var socket = new WebSocket('wss://eunnhodev.site/ws');

var loginPage = document.querySelector('#login-page');
var usernameInput = document.querySelector('#username');
var loginButton = document.querySelector('#login');
var callPage = document.querySelector('#call-page');
var yourVideo = document.querySelector('#yours');
var theirVideo = document.querySelector('#theirs');
var theirUsernameInput = document.querySelector('#their-username');
var callButton = document.querySelector('#call');
var hangUpButton = document.querySelector('#hang-up');

const remoteMediaStream = new MediaStream();

callPage.style.display = 'none';

loginButton.addEventListener('click', function (event) {
  name = usernameInput.value;
  console.log(name.length);
  if (name.length > 0) {
    _send({
      type: 'login',
      name: name,
    });
  }
});

callButton.addEventListener('click', function () {
  var theirUsername = theirUsernameInput.value;

  if (theirUsername.length > 0) {
    _startPeerConnection(theirUsername);
  }
});

hangUpButton.addEventListener('click', function () {
  _send({
    type: 'leave',
  });

  onLeave();
});

socket.onopen = function () {
  console.log('Connected');
};

socket.onmessage = function (message) {
  console.log('Got message', message.data);

  var data = JSON.parse(message.data);
  switch (data.type) {
    case 'login':
      onLogin(data.success);
      break;
    case 'offer':
      onOffer(data.offer, data.name);
      break;
    case 'answer':
      onAnswer(data.answer);
      break;
    case 'candidate':
      onCandidate(data.candidate);
      break;
    case 'leave':
      onLeave();
      break;
    default:
      break;
  }
};

socket.onerror = function (error) {
  console.log('Got error', error);
};

function onLogin(success) {
  if (success === false) {
    alert('Login unsuccessful. Please try a different username.');
  } else {
    loginPage.style.display = 'none';
    callPage.style.display = 'block';

    _startConnection();
  }
}

function onOffer(offer, name) {
  connectedUser = name;

  yourConnection.setRemoteDescription(new RTCSessionDescription(offer));

  yourConnection.createAnswer(
    function (answer) {
      yourConnection.setLocalDescription(answer);
      _send({
        type: 'answer',
        answer: answer,
      });
    },
    function (error) {
      alert('An error has occurred.');
    }
  );
}

function onAnswer(answer) {
  yourConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

function onCandidate(candidate) {
  yourConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

function onLeave() {
  connectedUser = null;
  theirVideo.srcObject = null;

  yourConnection.close();

  yourConnection.onicecandidate = null;
  yourConnection.onaddstream = null;

  _setupPeerConnection(stream);
}

function _send(message) {
  if (connectedUser) {
    message.name = connectedUser;
  }

  socket.send(JSON.stringify(message));
}

// Login 성공시 스트림을 얻으며 PeerConnection 구축 시작
function _startConnection() {
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: false })
    .then(function (myStream) {
      stream = myStream;
      yourVideo.srcObject = stream;

      _setupPeerConnection(stream);
    })
    .catch(function (error) {
      console.log(error);
    });
}

function _setupPeerConnection(stream) {
  var configuration = {
    iceServers: [
      { urls: ['stun:stun.kinesisvideo.ap-northeast-2.amazonaws.com:443'] },
      {
        urls: ['turn:35.247.51.87:3478?transport=tcp'],
        username: 'username',
        credential: 'password',
      },
    ],
  };
  yourConnection = new RTCPeerConnection(configuration);

  // setup ice handling
  yourConnection.onicecandidate = function (event) {
    if (event.candidate) {
      _send({
        type: 'candidate',
        candidate: event.candidate,
      });
    }
  };

  // setup sttream listening
  yourConnection.addTrack(stream.getTracks()[0]);
  yourConnection.ontrack = function (event) {
    remoteMediaStream.addTrack(event.track);
    console.log(event);
    theirVideo.srcObject = remoteMediaStream;
  };
}

// user = remoteUser
function _startPeerConnection(user) {
  connectedUser = user;

  yourConnection.createOffer(
    function (offer) {
      _send({
        type: 'offer',
        offer: offer,
      });

      yourConnection.setLocalDescription(offer);
    },
    function (error) {
      alert('An error hsa occurred.');
    }
  );
}
