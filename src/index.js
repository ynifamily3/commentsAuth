require("dotenv").config();
var express = require("express");
const jwt = require("jsonwebtoken");
const [downloadPhoto, uploadToS3, deletePhotoLocal] = require("./photo");
const renderTemplate = require("./render");
const passport = require("./passport")();
const session = require("express-session")({
  secret: process.env["SESSION_SECRET"],
  cookie: {
    domain: process.env.NODE_ENV === "production" ? ".roco.moe" : "localhost",
    path: "/",
    maxAge: 1000 * 10,
  },
  resave: true,
  saveUninitialized: false,
});

var app = express();
app.use(require("morgan")("combined"));
app.use(require("body-parser").urlencoded({ extended: true }));
app.use(session);
app.use(passport.initialize());

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

app.listen(process.env["PORT"] || 8081);
