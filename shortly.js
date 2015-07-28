var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser')


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

// Setting up sessions
app.use(cookieParser());
app.use(session({
  resave: true,
  saveUninitialized: true,
  genid: function() {
    console.log(genuuid(req));
    return genuuid() // use UUIDs for session IDs 
  },
  secret: 'keyboard cat'
}));

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


// Helper functions

var checkUser = function(res){
  // check if current user in session (if loged in == false)
  // if false do redirect
  // return res.redirect('/login');
};

//////////////////////////
// GET STUFF
//////////////////////////

app.get('/', 
function(req, res) {
  checkUser(res);
  /////// IF USER NOT LOGGED IN, REDIRECT TO LOGIN PAGE
  res.render('index');
});

app.get('/login', 
function(req, res) {

  res.render('login');
});

app.get('/signup', 
function(req, res) {
  res.render('signup');
});

app.get('/create', 
function(req, res) {
  checkUser(res);
  res.render('index');
});

app.get('/links', 
function(req, res) {
  checkUser(res);
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

//////////////////////////
// POST STUFF
//////////////////////////

app.post('/signup', function(req, res) {
  // WHERE ALL THE SIGNUP STUFF HAPPENS!
  var username = req.body.username;
  var password = req.body.password;
 

  // console.log(new User({"username": "dave"}).fetch());  

  new User({ username: username}).fetch().then(function(found) {
      if (found) {
        // console.log(found.attributes);
        res.send(200, found.attributes);
      } else {
        var user = new User({
          username: username,
          // TODO: add salt
          password: password 
        });

        user.save().then(function(newUser) {
          console.log('Added new USER!');
          Users.add(newUser);
          res.redirect(301, '/');
        });
      }
    });

});


//////////////////////////
// LOG IN
/////////////////////////

app.post('/login', function(req, res) {
  // WHERE ALL THE LOG IN STUFF HAPPENS (ohhhhh yeah)!
  var username = req.body.username;
  var password = req.body.password;
 
  // console.log(new User({"username": "dave"}).fetch());  
  // console.log(res.headers);
  new User({ username: username, password: password}).fetch().then(function(found) {
      if (found) {
        console.log('FOUND USER: ' + username + ' ' + password);
        // res.json({location: '/'});
        res.redirect(301, '/');
      } else {
        console.log("wrong username or password");
         res.redirect(301, '/login');
      }
    });
});




app.post('/links', 
function(req, res) {
  var uri = req.body.url;
  // console.log(uri);
  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      // console.log(found.attributes);
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          console.log('Added new link!');
          link.getCode();
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
