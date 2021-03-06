//Enviroment Variable
require('dotenv').config();

//Requiring
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
// const MicrosoftStrategy = require('passport-microsoft').Strategy;
const findOrCreate = require('mongoose-findorcreate');

//App
const app = express();

//Use
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

//Session
app.use(session({
  secret: 'Our little secret.',
  resave: false,
  saveUninitialized: false
}));

//Passport
app.use(passport.initialize());
app.use(passport.session());

//Connect
mongoose.connect(process.env.MONGODB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set('useCreateIndex', true);

//Build
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model('User', userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

//Passport with Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID_GOOGLE,
    clientSecret: process.env.CLIENT_SECRET_GOOGLE,
    callbackURL: 'http://localhost:3000/auth/google/secrets',
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

// //Passport with Microsoft OAuth
// passport.use(new MicrosoftStrategy({
//     clientID: process.env.CLIENT_ID_MICROSOFT,
//     clientSecret: process.env.CLIENT_SECRET_MICROSOFT,
//     callbackURL: 'http://localhost:3000/auth/microsoft/secrets',
//     scope: ['user.read']
//   },
//   function(accessToken, refreshToken, profile, done) {
//     User.findOrCreate({
//       userId: profile.id
//     }, function(err, user) {
//       return done(err, user);
//     });
//   }
// ));

//Getting
app.get('/', function(req, res) {
  res.render('home');
});

//Getting Google OAuth
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile']
  })
);
app.get('/auth/google/secrets',
  passport.authenticate('google', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    // Successful authentication, redirect to Secrets.
    res.redirect('/secrets');
  });

// //Getting Microsoft OAuth
// app.get('/auth/microsoft',
//       passport.authenticate('microsoft'));
//
//     app.get('/auth/microsoft/secrets',
//       passport.authenticate('microsoft', { failureRedirect: '/login' }),
//       function(req, res) {
//         // Successful authentication, redirect home.
//         res.redirect('/secrets');
//       });

//Getting
app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/register', function(req, res) {
  res.render('register');
});

app.get('/secrets', function(req, res) {
  User.find({
    'secret': {
      $ne: null
    }
  }, function(err, foundUsers) {
    if (err) {
      console.log(err);
    } else {
      if (foundUsers) {
        res.render('secrets', {
          usersWithSecrets: foundUsers
        });
      }
    }
  });
});

app.get('/submit', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('submit');
  } else {
    res.redirect('/login');
  }
});

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

//Posting
app.post('/register', function(req, res) {
  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect('/register');
    } else {
      passport.authenticate('local')(req, res, function() {
        res.redirect('/secrets');
      });
    }
  });
});

app.post('/login', function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate('local')(req, res, function() {
        res.redirect('/secrets');
      });
    }
  });
});

app.post('/submit', function(req, res) {
  const submittedSecret = req.body.secret;
  User.findById(req.user.id, function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save(function() {
          res.redirect('/secrets');
        });
      }
    }
  });
});

//Listen
app.listen(process.env.PORT || 3000, function(){
  console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});
