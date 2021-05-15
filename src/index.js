require("dotenv").config();
var express = require("express");
var passport = require("passport");
var TwitterStrategy = require("passport-twitter").Strategy;
var KakaoStrategy = require("passport-kakao").Strategy;
const jwt = require("jsonwebtoken");

passport.serializeUser(function (user, cb) {
  cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
  cb(null, obj);
});

passport.use(
  new TwitterStrategy(
    {
      consumerKey: process.env["TWITTER_CONSUMER_KEY"],
      consumerSecret: process.env["TWITTER_CONSUMER_SECRET"],
      callbackURL:
        process.env.NODE_ENV === "production"
          ? "https://auth.roco.moe/auth/twitter/callback"
          : "http://localhost:8081/auth/twitter/callback",
    },
    function (token, tokenSecret, profile, cb) {
      return cb(null, profile);
    }
  )
);

passport.use(
  new KakaoStrategy(
    {
      clientID: process.env["KAKAO_CLIENT_ID"],
      clientSecret: process.env["KAKAO_CLIENT_SECRET"],
      callbackURL:
        process.env.NODE_ENV === "production"
          ? "https://auth.roco.moe/auth/kakao/callback"
          : "http://localhost:8081/auth/kakao/callback",
    },
    function (accessToken, refreshToken, profile, cb) {
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
    cookie: {
      domain: process.env.NODE_ENV === "production" ? ".roco.moe" : "localhost",
      path: "/",
      maxAge: 1000 * 10,
    },
    resave: true,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());

app.get("/auth/twitter", passport.authenticate("twitter", { session: false }));
app.get(
  "/auth/twitter/callback",
  passport.authenticate("twitter", { session: false }),
  function (req, res) {
    const { id, displayName, photos } = req.user;
    const payload = {
      id,
      displayName,
      photo: photos[0] ? photos[0].value : null,
      expires: Date.now() + parseInt(3600) * 1000,
    };
    const token = jwt.sign(
      JSON.stringify(payload),
      process.env["SESSION_SECRET"]
    );
    res.send(
      renderTemplate("twitter", {
        ...payload,
        authorization: token,
      })
    );
  }
);

// 카카오
app.get("/auth/kakao", passport.authenticate("kakao", { session: false }));
app.get(
  "/auth/kakao/callback",
  passport.authenticate("kakao", { session: false }),
  function (req, res) {
    const {
      id,
      displayName,
      _json: {
        kakao_account: { profile },
      },
    } = req.user;
    console.log("rr", req.user._json);
    const photo = profile.is_default_image ? "" : profile.thumbnail_image_url;
    const payload = {
      id,
      displayName,
      photo,
      expires: Date.now() + parseInt(3600) * 1000,
    };
    const token = jwt.sign(
      JSON.stringify(payload),
      process.env["SESSION_SECRET"]
    );
    console.log(payload);
    res.send(
      renderTemplate("kakao", {
        ...payload,
        authorization: token,
      })
    );
  }
);

function renderTemplate(authMethod, authValue) {
  const services = new Map();
  services.set("twitter", "트위터");
  services.set("kakao", "카카오");
  const targetOrigin =
    process.env.NODE_ENV === "production"
      ? "https://roco.moe"
      : "http://localhost:3000";
  if (!services.has(authMethod)) return ``;
  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${services.get(authMethod)} 로그인</title>
    </head>
    <body>
      <h1>로그인 중이에요...</h1>
      <script type="text/javascript">
        const user = ${JSON.stringify(authValue).replace(/</g, "\\u003c")};
        console.log(user);
        const message = { authMethod: "${authMethod}", authValue: user};
        window.opener.postMessage(message, "${targetOrigin}");
      </script>
    </body>
  </html>
  `;
}

app.listen(process.env["PORT"] || 8081);
