var yaml = require('yaml-front-matter');
var cheerio = require('cheerio');
var pathFn = require('path');
var isUrl = require('nice-is-url');
var lg = require('./log.js');
var gs = require('./imageSize.js');
var cache = require('./cache.js');
var config, contentJsonPath, post_asset_folder, relativeImagesPath, imagesPath;

module.exports.setConfig = function (inConfig) {
    config = inConfig;
    contentJsonPath = config.public_dir + 'content.json';
    post_asset_folder = config.post_asset_folder;
    relativeImagesPath = config.root;
    imagesPath = config.url + config.root;
    if (!post_asset_folder) {
        if (config.image_dir) {
            relativeImagesPath += config.image_dir;
            imagesPath += config.image_dir;
        } else {
            relativeImagesPath += 'images';
            imagesPath += 'images';
        }
        imagesPath += "/";
    }
    lg.setConfig(inConfig);
    gs.setConfig(inConfig);
};

module.exports.beforePostRender = function (data) {
    var excludeTest = /^\_posts\//;

    var cachedData = cache.getCache(data, config);
    if (!cachedData) {
        var ampSettings = yaml.loadFront(data.raw).ampSettings;
        if (ampSettings && ampSettings.titleImage && ampSettings.titleImage.path) {
            var path = ampSettings.titleImage.path;
            var relativePrefix = relativeImagesPath;
            var imagePrefix = imagesPath;
            // Use post asset folder
            if (config.post_asset_folder) {
                imagePrefix = data.permalink;
            }
            // Check if the featured image path is an absolute URI
            if (isUrl(path, {
                    requireProtocol: true
                })) {
                //Full URI - ensure height and width are specified
                if (ampSettings.titleImage.width && ampSettings.titleImage.height) {
                    data.eyeCatchImage = path;
                    data.titleImageForAmp = path;
                    data.eyeCatchImageProperty = {
                        "width": ampSettings.titleImage.width,
                        "height": ampSettings.titleImage.height
                    };
                } else {
                    lg.log("error", "Please check the front-matter options (ampSettings.titleImage.width and height option).", data.source);
                }
            } else {
                if (path.indexOf('/') === 0) {
                    //Absolute URI relative to site - No prefix needed
                    relativePrefix = '';
                    imagePrefix = '';
                }

                var imagePath = pathFn.join(process.cwd(), config.source_dir, relativePrefix, path);
                var gsSizeInfo = gs.getSizeInfo(pathFn.join(process.cwd(), config.source_dir, relativePrefix, path), data);
                if (gsSizeInfo) {
                    data.eyeCatchImage = imagePrefix + path;
                    data.titleImageForAmp = imagePrefix + path;
                    data.eyeCatchImageProperty = {
                        "width": gsSizeInfo.w,
                        "height": gsSizeInfo.h
                    };
                } else {
                    lg.log("error", "Unable to get image width and height", data.source);
                }
            }
            cache.saveCache_eyeCatchImg(data, config);
        }
    } else {
        if(data.isSubstituteEyeCatchImage) {
            data.isSubstituteEyeCatchImage = true;
        }
        data.eyeCatchImage = cachedData.eyeCatchImage;
        data.titleImageForAmp = cachedData.titleImageForAmp;
        data.eyeCatchImageProperty = cachedData.eyeCatchImageProperty;
    }
    return data;
};

module.exports.afterPostRender = function (data) {
    var isIncompleteProperty = false;
    if (!data.eyeCatchImage) {
        var imgWidth, imgHeight;
        var relativePrefix = relativeImagesPath;
        var imagePrefix = imagesPath;
        isIncompleteProperty = true;
        var $ = cheerio.load(data.content);
        if ($("img").length > 0) {
            var $img = $("img").first();
            var imgsrc = $img.attr("src");

            if (isUrl(imgsrc, {
                    requireProtocol: true
                })) {
                //External image file
                data.eyeCatchImage = imgsrc;
                data.titleImageForAmp = imgsrc;

                if ($img.attr("width")) {
                    imgWidth = $img.attr("width");
                }
                if ($img.attr("height")) {
                    imgHeight = $img.attr("height");
                } else if ($img.attr("data-height")) {
                    imgHeight = $img.attr("data-height");
                }
            } else {
                //Local image files
                if (imgsrc.indexOf('/') === 0) {
                    //Absolute URI relative to site - No prefix needed
                    relativePrefix = '';
                    imagePrefix = '';
                }

                data.eyeCatchImage = imagePrefix + imgsrc;
                data.titleImageForAmp = imagePrefix + imgsrc;

                if ($img.attr("width")) {
                    imgWidth = $img.attr("width");
                }
                if ($img.attr("height")) {
                    imgHeight = $img.attr("height");
                } else if ($img.attr("data-height")) {
                    imgHeight = $img.attr("data-height");
                }

                //get image size
                if (!imgWidth || !imgHeight) {
                    var gsSizeInfo = gs.getSizeInfo(pathFn.join(process.cwd(), config.source_dir, relativePrefix, imgsrc), data);
                    if (gsSizeInfo) {
                        imgWidth = gsSizeInfo.w;
                        imgHeight = gsSizeInfo.h;
                    }

                }
            }

            if (imgHeight && imgWidth) {
                data.eyeCatchImageProperty = {
                    "width": imgWidth,
                    "height": imgHeight
                };
                if (Number(imgWidth) < 696) {
                    lg.log("warn", "The following image should be at least 696 pixels wide. img path: " + data.eyeCatchImage, data.source);
                } else {
                    cache.saveCache_eyeCatchImg(data, config);
                    isIncompleteProperty = false;
                }
            }
        }
    }

    if (isIncompleteProperty) {
        if (config.generator_amp && config.generator_amp.substituteTitleImage && config.generator_amp.substituteTitleImage.path && config.generator_amp.substituteTitleImage.width && config.generator_amp.substituteTitleImage.height) {
            if (isUrl(config.generator_amp.substituteTitleImage.path, {
                    requireProtocol: true
                })) {
                data.eyeCatchImage = config.generator_amp.substituteTitleImage.path;
                data.titleImageForAmp = config.generator_amp.substituteTitleImage.path;
            } else {
                var imagePath = config.url + pathFn.join(config.root, config.generator_amp.assetDistDir, config.generator_amp.substituteTitleImage.path);
                data.eyeCatchImage = imagePath;
                data.titleImageForAmp = imagePath;
            }
            data.eyeCatchImageProperty = {
                "width": config.generator_amp.substituteTitleImage.width,
                "height": config.generator_amp.substituteTitleImage.height
            };
            data.isSubstituteEyeCatchImage = true;
            cache.saveCache_eyeCatchImg(data, config);
        }
    }


    return data;
}