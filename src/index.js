require("dotenv").config();
var express = require("express");
var passport = require("passport");
var Strategy = require("passport-twitter").Strategy;
const jwt = require("jsonwebtoken");
const passportJWT = require("passport-jwt");
const JWTStrategy = passportJWT.Strategy;

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
          ? "https://auth.roco.moe/auth/twitter/callback"
          : "http://localhost:8081/auth/twitter/callback",
    },
    function (token, tokenSecret, profile, cb) {
      return cb(null, profile);
    }
  )
);

passport.use(
  new JWTStrategy(
    {
      jwtFromRequest: (req) => req.cookies.jwt,
      secretOrKey: process.env["SESSION_SECRET"],
    },
    (jwtPayload, done) => {
      if (Date.now() > jwtPayload.expires) {
        return done("jwt expired");
      }

      return done(null, jwtPayload);
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
      maxAge: 1000 * 60 * 24,
    },
    resave: true,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/auth/twitter", passport.authenticate("twitter", { session: false }));
app.get(
  "/auth/twitter/callback",
  passport.authenticate("twitter"),
  function (req, res) {
    const { id, displayName, photos } = req.user;
    const payload = {
      id,
      expires: Date.now() + parseInt(3600) * 1000,
    };
    const token = jwt.sign(
      JSON.stringify(payload),
      process.env["SESSION_SECRET"]
    );
    res.send(
      renderTemplate("twitter", {
        id,
        displayName,
        photo: photos[0] ? photos[0].value : null,
        authorization: token,
      })
    );
  }
);

function renderTemplate(authMethod, authValue) {
  const services = new Map();
  services.set("twitter", "트위터");
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
