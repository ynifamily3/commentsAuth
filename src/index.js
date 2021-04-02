require("dotenv").config();

var express = require("express");
var passport = require("passport");
var Strategy = require("passport-twitter").Strategy;
passport.serializeUser(function (user, cb) {
  cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
  cb(null, obj);
});
passport.use(
  new Strategy(
    {
      consumerKey: process.env["TWITTER_CONSUMER_KEY"],
      consumerSecret: process.env["TWITTER_CONSUMER_SECRET"],
      callbackURL:
        process.env.NODE_ENV === "production"
          ? "https://roco.moe/callback_twitter.html"
          : "http://localhost:8081/oauth/callback",
    },
    function (token, tokenSecret, profile, cb) {
      return cb(null, profile);
    }
  )
);

var app = express();

app.use(require("morgan")("combined"));
app.use(require("body-parser").urlencoded({ extended: true }));
app.use(
  require("express-session")({
    secret: process.env["SESSION_SECRET"],
    resave: true,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/login/twitter", passport.authenticate("twitter"));

app.get(
  "/oauth/callback",
  passport.authenticate("twitter", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/profile/twitter");
  }
);

app.get("/profile/twitter", function (req, res) {
  console.log(req.user);
  res.json({ user: req.user });
});

app.listen(process.env["PORT"] || 8081);
