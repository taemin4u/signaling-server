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

  yourConnection.createAnswer().then((answer) => {
    yourConnection.setLocalDescription(answer);
    _send({
      type: 'answer',
      answer: answer,
    });
  }).catch(
    (error) => {
    alert('An error has occurred.');
  });
}

async function onAnswer(answer) {
  await yourConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

function onCandidate(candidate) {
  yourConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

function onLeave() {
  connectedUser = null;
  theirVideo.srcObject = null;

  yourConnection.close();

  yourConnection.onicecandidate = null;
  yourConnection.ontrack = null

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
  // 상대 Peer가 addTrack을 하고 SDP와 ice가 넘어오면 그때 ontrack이 호출된다.
  yourConnection.ontrack = function (event) {
    const remoteMediaStream = new MediaStream();
    remoteMediaStream.addTrack(event.track);
    theirVideo.srcObject = remoteMediaStream;
  };
}

// user = remoteUser
function _startPeerConnection(user) {
  connectedUser = user;

  yourConnection.createOffer().then(offer => {
    _send({
      type: 'offer',
      offer: offer
    });
    console.log('sending offer to Remote,', offer)
    yourConnection.setLocalDescription(offer)
  }).catch(error => {
    alert('An error has ocurred', error)
  })
}
