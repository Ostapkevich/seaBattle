const express = require('express');
const path = require('path');
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();

const httpServer = createServer(app);
const io = new Server(httpServer);
app.use(express.static(__dirname + '/dist/sea-battle'));
app.get('/', function(req,res) {
    
res.sendFile(path.join(__dirname+'/dist/sea-battle/index.html'));
});

let users={};

function updatePlayerStatus(id, status) {
  for (let key in users) {
    if (key === id) {
      if (status === false) {
        users[id] = users[id].replace('🟢', '🔵');
      } else {
        users[id] = users[id].replace('🔵', '🟢');

      }
    }
  }
}

io.on("connection", (socket) => {

  socket.on("createNewUser", (name, callback) => {
    try {
      callback({status: "ok" }, users);
      Object.assign(users, { [socket.id]: name + '🟢' });
      socket.broadcast.emit('addNewUser', { [socket.id]: name + '🟢' });
    } catch (error) {
      callback({ status: error.message });
    }
  });

  socket.on('inviteToPlay', (idTo, callback) => {
    try {
      if (users[idTo].lastIndexOf('🔵') > 0) {
        callback({ status: `Игрок ${users[idTo]} уже играет!` });
      } else {
        callback({ status: 'ok' });
      }

      io.to(idTo).emit('inviteToPlay', socket.id);
    } catch (error) {
      callback({ status: error.message });
    }
  });

  socket.on('invitationResponse', (idFrom, confirmStatus, callback) => {
    try {
      callback({ status: "ok" });
      io.to(idFrom).emit('invitationResponse', socket.id, confirmStatus);
      if (confirmStatus === '1') {
        updatePlayerStatus(idFrom, false);
        updatePlayerStatus(socket.id, false);
        io.emit('statusTwoPlayersBusy', idFrom, socket.id);
      }
    } catch (error) {
      callback({ status: error.message });
    }
  })

  socket.emit('addExistingUsers', users);

  socket.on('mePlayMarkFalse', () => {
    updatePlayerStatus(socket.id, true);
    socket.broadcast.emit('mePlayMarkFalse', socket.id);
  });

  socket.on('messageToServer', (idTo, between, usrMessage, idMessage, callback) => {
    try {
      callback({ status: 'ok' });
      io.to(idTo).emit('messageToUser', socket.id, between, usrMessage, idMessage);
    } catch (error) {
      callback({ status: error.message });
    }
  });

  socket.on('printing',(idTo)=>{
    console.log('printing')
    io.to(idTo).emit('printing',socket.id);
  });

  socket.on('gotAnswer', (idFrom, between, usrMessage, idMessage, callback) => {
    try {
      callback({ status: "ok" });
      io.to(idFrom).emit('gotAnswer', idMessage);
    } catch (error) {
      callback({ status: error.message });
    }
  })

  socket.on("disconnect", () => {
    for (const key in users) {
      if (key === socket.id) {
        delete users[key];
        io.emit('quitUser', socket.id);
        return;
      }
    }
  });

  socket.on('shot', (idTo, coord, callback) => {
    try {
      io.to(idTo).timeout(20000).emit('shot', coord, (err, response) => {
        try {
          if (err) {
            callback({ errorMessage: 'Проблемы с интернет соединением у противника! ' + err.message })
          } else {
            callback(response[0]);
          }
        } catch (error) {
          callback({ foundCoord: false, gameContinue: false, errorMessage: error.message });
        }
      });
    } catch (error) {
      callback({ foundCoord: false, gameContinue: false, errorMessage: error.message });
    }
  });

});


const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => { console.log('Server is running!') });
