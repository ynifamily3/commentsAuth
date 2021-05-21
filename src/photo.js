const request = require("request");
const mime = require("mime-types");
const AWS = require("aws-sdk");
const fs = require("fs");

const s3 = new AWS.S3({
  accessKeyId: process.env["S3_ACCESS_KEY_ID"],
  secretAccessKey: process.env["S3_SECRET_ACCESS_KEY"],
  region: process.env["S3_REGION"],
});

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

module.exports = [downloadPhoto, uploadToS3, deletePhotoLocal];
