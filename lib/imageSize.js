'use strict';
var fs = require('fs');
var pathFn = require('path');
var imgSize = require('image-size');
var lg = require('./log.js');
var config;

module.exports.getSizeInfo = function (imgsrc, data) {

  var imgWidth;
  var imgHeight;

  if (fs.existsSync(imgsrc)) {
    //image-size
    var ims = imgSize(imgsrc);
//    console.log("(image-size) W:" + ims.width+ " H:" + ims.height);
    imgWidth = ims.width;
    imgHeight = ims.height;
  } else {
    lg.log("error", "no such file or directory. img path: " + imgsrc, data.source);
    return null;
  }

  return {
    "w": imgWidth,
    "h": imgHeight
  };
};

module.exports.setConfig = function (inConfig) {
  config = inConfig;
  lg.setConfig(config);
};