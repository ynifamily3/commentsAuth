var passport = require("passport");
var TwitterStrategy = require("passport-twitter").Strategy;
var KakaoStrategy = require("passport-kakao").Strategy;
function passportConfigure() {
  passport.serializeUser(function (user, cb) {
    cb(null, user);
  });

  passport.deserializeUser(function (obj, cb) {
    cb(null, obj);
  });

  applyPassportStrategy("twitter");
  applyPassportStrategy("kakao");
  return passport;
}

function applyPassportStrategy(authMethod) {
  const strategyOption = {};
  let SocialStrategy = null;
  switch (authMethod) {
    case "twitter":
      SocialStrategy = TwitterStrategy;
      break;
    case "kakao":
      SocialStrategy = KakaoStrategy;
      break;
    default:
      console.error("authMethod를 제대로 주십시오.");
      break;
  }
  const callbackURL = `${
    process.env.NODE_ENV === "production"
      ? "https://auth.roco.moe"
      : "http://localhost:8081"
  }/auth/${authMethod}/callback`;

  switch (authMethod) {
    case "twitter":
      Object.assign(strategyOption, {
        consumerKey: process.env["TWITTER_CONSUMER_KEY"],
        consumerSecret: process.env["TWITTER_CONSUMER_SECRET"],
        callbackURL,
      });
      break;
    case "kakao":
      Object.assign(strategyOption, {
        clientID: process.env["KAKAO_CLIENT_ID"],
        clientSecret: process.env["KAKAO_CLIENT_SECRET"],
        callbackURL,
      });
      break;
    default:
      console.error("authMethod를 제대로 주십시오.");
      break;
  }
  passport.use(
    new SocialStrategy(strategyOption, function (_, __, profile, cb) {
      return cb(null, profile);
    })
  );
}

module.exports = passportConfigure;
