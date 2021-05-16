require("dotenv").config();
var express = require("express");
var passport = require("passport");
var TwitterStrategy = require("passport-twitter").Strategy;
var KakaoStrategy = require("passport-kakao").Strategy;
const jwt = require("jsonwebtoken");
const AWS = require("aws-sdk");
const fs = require("fs");
const request = require("request");
const mime = require("mime-types");

const s3 = new AWS.S3({
  accessKeyId: process.env["S3_ACCESS_KEY_ID"],
  secretAccessKey: process.env["S3_SECRET_ACCESS_KEY"],
  region: process.env["S3_REGION"],
});

passport.serializeUser(function (user, cb) {
  cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
  cb(null, obj);
});

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

applyPassportStrategy("twitter");
applyPassportStrategy("kakao");

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

async function downloadPhoto(url, fileName) {
  return await new Promise((resolve, reject) => {
    const stream = request(url).pipe(fs.createWriteStream(fileName));
    stream.on("close", () => {
      stream.close();
      resolve();
    });
    stream.on("error", () => {
      console.error("파일 다운로드 에러!");
      stream.close();
      reject();
    });
  });
}

async function uploadToS3(fileName) {
  return await new Promise((resolve) => {
    s3.upload(
      {
        Bucket: "moe-roco-comments-api",
        Key: `profile/${fileName}`,
        Body: fs.createReadStream(fileName),
        ContentType: mime.lookup(fileName),
      },
      (err, data) => {
        if (err) {
          console.error("업로드 실패했어요.", err);
          resolve(null);
        } else {
          resolve(`${process.env["OBJECT_URL"]}/profile/${fileName}`);
        }
      }
    );
  });
}

async function deletePhotoLocal(fileName) {
  return await new Promise((resolve, reject) => {
    try {
      fs.rmSync(fileName);
      resolve();
    } catch (e) {
      console.error("임시파일 삭제 실패:", e);
      reject();
    }
  });
}

function socialLoginController(authMethod) {
  const getPhotoURL = (user) => {
    switch (authMethod) {
      case "twitter":
        if (user.photos) return user.photos[0].value;
        else return null;
      case "kakao":
        const profile = user._json.kakao_account.profile;
        return profile.is_default_image ? null : profile.thumbnail_image_url;
    }
  };

  app.get(
    `/auth/${authMethod}`,
    passport.authenticate(authMethod, { session: false })
  );

  app.get(
    `/auth/${authMethod}/callback`,
    passport.authenticate(authMethod, { session: false }),
    function (req, res) {
      const { id, displayName } = req.user;
      const photoURL = getPhotoURL(req.user);
      let photo = null;
      (async () => {
        if (photoURL) {
          const fileName = `${authMethod}-${id}.${
            photoURL.split(".").reverse()[0]
          }`;
          try {
            await downloadPhoto(photoURL, fileName);
            const s3URL = await uploadToS3(fileName);
            await deletePhotoLocal(fileName);
            photo = s3URL;
          } catch (error) {
            console.error("프로필 사진 복사 중 오류 발생:", error);
          }
        }
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

        res.send(
          renderTemplate(authMethod, {
            ...payload,
            authorization: token,
          })
        );
      })();
    }
  );
}

socialLoginController("twitter");
socialLoginController("kakao");

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
      <a href="/auth/${authMethod}">오랫동안 이 화면이 보인다면... (재시도)</a>
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
