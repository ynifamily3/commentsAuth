const express = require("express");
const passport = require("passport-twitter");
const app = express();
const port = 8081;

app.get("/", (req, res) => {
  res.send("인증서버 입니다.");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

passport.use(
  new TwitterStrategy(
    {
      consumerKey: process.env.TWITTER_CONSUMER_KEY,
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
      callbackURL: "https://roco.moe/callback_twitter.html",
    },
    function (token, tokenSecret, profile, cb) {
      User.findOrCreate({ twitterId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);
