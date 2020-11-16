const get = require('lodash/get');
const moment = require('moment');
const { getStorage } = require('../models/Google/Storage');
const { UPLOAD_DATE_FORMAT } = require('./constants');

exports.formatFileName = fileName =>
  `media-${fileName.replace(/[^a-zA-Z0-9]/g, '')}-${moment().format(UPLOAD_DATE_FORMAT)}`;

exports.uploadMedia = async payload => new Promise((resolve, reject) => {
  const { fileName, file } = payload;

  const bucket = getStorage().bucket(process.env.GCS_BUCKET_NAME);
  const stream = bucket.file(fileName)
    .createWriteStream({ metadata: { contentType: get(file, 'hapi.headers.content-type') } })
    .on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      resolve(publicUrl);
    })
    .on('error', (err) => {
      console.error(err);
      reject(new Error('Unable to upload media, something went wrong'));
    });

  file.pipe(stream);
});

exports.deleteMedia = async publicId => new Promise((resolve, reject) => {
  getStorage().bucket(process.env.GCS_BUCKET_NAME).file(publicId).delete({}, (err, res) => {
    if (err && err.code !== 404) reject(err);
    else resolve(res);
  });
});