require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();
const multer = require('multer');
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const path = require('path');
const User = require('./models/user');

const passport = require('passport');
const port = 3000;
const upload = multer({ dest: 'uploads/'});

let rooms = {};

// mongoose
const db = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Sucessfully connected to Mongoose');
  } catch(err) {
    console.log('Error connected to Mongoose');
    exit(1);
  }
}

// connect to mongodb
db();

// this line allows json to be passed to the routes
app.use(express.static('public'))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.use(cors({
  origin: 'http://localhost:5173',
  methods: 'POST,GET,PUT,DELETE',
  credentials: true
}));

// this node.js app uses sessions (not jwt)
app.use(session({
  secret: 'secrete code a9b8c7',
  resave: true,
  saveUninitialized: true
}));

const io = new Server(server);

// initialize passport
app.use(passport.initialize());
app.use(passport.session());

// initialize the local strategy
require('./passport/local')(passport);

// initialize the google strategy
require('./passport/google')(passport);

// root route
app.get('/', (req, res) => {
  res.render('index');
});

// chat
app.get('/chat', checkAuthenticated, (req, res) => {
  res.render('chat', { name: req.user.firstName + ' ' + req.user.lastName, firstname: req.user.firstName, room: ''});
});

app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login');
});

app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('register');
});

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: '/chat',
  failureRedirect: '/login'
}));

app.post('/register', checkNotAuthenticated, async (req, res) => {
  try {
    let user = await User.findOne({ username: req.body.email });
    if (user) {
      res.send('User Already Exists');
      res.redirect('/login');
    } else {
      const hashedPassword = await bcrypt.hash(req.body.password, 10);

      const newUser = new User({
        firstName: req.body.firstname,
        lastName: req.body.lastname,
        email: req.body.email,
        password: hashedPassword,
      });
      await newUser.save();
      res.redirect('/login');
    }
  } catch(err) {
    console.log('An error occured');
    res.json(err);
  }
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/callback', passport.authenticate('google', {
  failureRedirect: '/login'
}), (req, res) => {
  res.redirect('/chat');
});

// related to rooms
app.get('/room/:room', checkAuthenticated, (req, res) => {
  const room = req.params.room;
  if (rooms[room] === null) {
    return res.redirect('/')
  }
  res.render('/' + room, { roomName: room });
});

app.post('/room', checkAuthenticated, (req, res) => {
  console.log('room post');
  const room = req.body.room;
  console.log(req.body);
  //if (rooms[room] != null) {
  //  return res.redirect('/')
  //}
  rooms[room] = { users: {} }
  console.log(rooms);
  io.emit('room-created', room);
  //res.redirect('/' + room);
})

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/login');
  });
});

// socket io
io.on('connection', (socket) => {
  console.log(`user ${socket.id} connected`);

  socket.on('new-user', (room, name) => {
    socket.join(room)
    rooms[room].users[socket.id] = name
    socket.to(room).broadcast.emit('user-connected', name)
  });
  socket.on('send-chat-message', (room, message) => {
    socket.to(room).broadcast.emit('send-chat-message', { message: message, name: rooms[room].users[socket.id] })
  });
  socket.on('receive-chat-message', (room, message) => {
    socket.to(room).broadcast.emit('receive-chat-message', { message: message, name: rooms[room].users[socket.id] })
  });
  socket.on('disconnect', () => {
    getUserRooms(socket).forEach(room => {
      socket.to(room).broadcast.emit('user-disconnected', rooms[room].users[socket.id])
      delete rooms[room].users[socket.id]
    })
  });
});

function getUserRooms(socket) {
  return Object.entries(rooms).reduce((names, [name, room]) => {
    if (room.users[socket.id] !== null) names.push(name)
    return names
  }, [])
}

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/chat');
  }
  return next();
}

server.listen(3000, () => {
  console.log(`listening on port: ${port}`);
});