const axios = require('axios');
const awsUtil = require('../util/aws');
const formatDate = require('../util/formatDate');
const SparkMD5 = require('spark-md5');
const consola = require('consola');

/**
 * @function containsScreenshots
 * @description returns whether or not the lighthouse report contains screenshots
 * @param {object} screenshots this is the data found in  .audits["screenshot-thumbnails"] of a lighthoust report that represent different screenshots for the webpage tested
 */
const containsScreenshots = (screenshots) => {
  let hasScreenshots = false;
  if (typeof screenshots.details == 'object' && screenshots.details.hasOwnProperty('items')) {
    hasScreenshots = true;
  }

  return hasScreenshots;
}

/**
 * @function getScreenshotPath
 * @description returns a path for s3. By default it will return a full s3 url.
 * @param {object} params 
 * @param {number} params.urlId 
 * @param {object} params.screenshot this is the data found in  .audits["screenshot-thumbnails"] of a lighthoust report that represent different screenshots for the webpage tested
 */
const getScreenshotPath = (params) => {
  let name = '';
  if (typeof params.screenshot === 'object') { name = JSON.stringify(params.screenshot); }

  return `${formatDate(new Date())}/${params.urlId}/screenshots/${SparkMD5.hash(name)}.jpeg`;
}

/**
 * @function calculateContentBreakDown
 * @description takes in the network request data from a lighthouse test and calculates the break down of each content type
 *
 * @param {Object} networkRequests all the network request that Lighthouse reported for this url
 *
 * @returns {Object} an object with content breakdown by byte count and per mime type
 */
const calculateContentBreakDown = (networkRequests) => {
  const targetResourceTypes = ["script", "font", "image", "stylesheet", "document"];
  const bytesCount = { 
    script: 0,
    font: 0,
    image: 0,
    stylesheet: 0,
    document: 0,
    other: 0,
  }

  const mimeTypeRequests = {
    script: 0,
    font: 0,
    image: 0,
    stylesheet: 0,
    document: 0,
    other: 0,
  }

  networkRequests.details.items.map((req) => {
    if (req.hasOwnProperty('resourceType')) { req.resourceType = req.resourceType.toLowerCase(); }

    let resourceType = req.resourceType;
    if (!targetResourceTypes.includes(resourceType)) { 
      // Looks like text/html sometimes doesn't have resourceType set
      // Check to see if the mimeType is html and increment the correct counter
      if (req.mimeType === 'text/html') {
        resourceType = 'document';
      } else {
        resourceType = 'other';
      }
    }

    bytesCount[resourceType] += req.transferSize;
    mimeTypeRequests[resourceType] += 1;
    return;
  });

  return {
    bytesCount,
    mimeTypeRequests,
  };
}

/**
 * @function grabReportingCategories
 * @description returns a simplified object with category name and it's value. Will times a decimall by 100 to grab whole number.
 * @param {object} categories this is the data found in
 */
const grabReportingCategories = (categories) => {
  // Grab the properties that will be used
  const targetCategories = ["performance", "pwa", "accessibility", "best-practices", "seo"];
  const categoryScores = {};

  const parsedCategories = Object.values(categories);
  parsedCategories.map((category) => { // Grab the scores that we want to send to the API
    const c = Object.assign({}, category); // just to be safe

    // continue to next interation if the current category isn't a target one
    if (!targetCategories.includes(c.id)) { return; }

    // Append to the other categories
    if (c.score <= 1) {
      // multiply by 100 since it's probaby a percentage
      // historic data has been returning full percentage (whole number)
      // but new version of lighthouse is returning percentage (decimal)
      categoryScores[c.id] = c.score * 100;
    } else {
      categoryScores[c.id] = c.score;
    }
  });

  return categoryScores;
}

/**
 * @function grabScreenshots
 * @description returns the an array of screenshots with the assumed S3 path for them
 * @param {object} screenshots this is the data found in  .audits["screenshot-thumbnails"] of a lighthoust report that represent different screenshots for the webpage tested
 * @param {object} screenshots.details
 * @param {array} screenshots.details.items
 */
const grabScreenshots = (urlId, screenshots) => {
  let screenshotArray = [];
  // If we have screenshots we send them over else just send an empty array
  if (containsScreenshots(screenshots) ) {
    screenshotArray = screenshots.details.items.slice();

    // Give all screenshots a url... assuming the s3 upload of images was successful
    screenshotArray.map((screenshot, i) => {
      /** 
       * This process preforms 3 things in async with no depedency of each other. One of those processes is uploading any screenshots 
       * returned by the lighthouse test up to S3. In this function we assume that those uploads were successful and we generate a url
       * to the screenshot using the same function that the upload codes uses to tag the S3 object. 
      */
      screenshotArray[i].screenShotPath = `s3://${process.env.BUCKET_PATH}/${getScreenshotPath({ urlId, screenshot })}`;
    });
  }

  return screenshotArray;
}

/**
 * @function sendToLumos
 * @description takes the results of the lighthouse test and send the data to the Lumos API 
 * @param {number} urlId - the url Id for which the lighthouse test ran for
 * @param {string} s3AuditPath - the s3 path to where the raw lighthouse test was saved to
 * @param {object} lighthouseResults - the raw results of the lighthouse test 
 */
const handleLighthouseResults = (urlId, s3AuditPath, lighthouseResults) =>  new Promise((resolve, reject) => {

  const categoryScores = grabReportingCategories(lighthouseResults.categories);
  const screenshots = grabScreenshots(urlId, lighthouseResults.audits['screenshot-thumbnails']);
  const contentBreakDown = calculateContentBreakDown(lighthouseResults.audits['network-requests']);

  const dateNow = new Date();
  // Assign values that we to send to Lumos API
  const lumosProperties = {
    urlId: urlId,
    firstMeaningfulPaint: lighthouseResults.audits["first-meaningful-paint"].rawValue,
    timeToFirstByte: lighthouseResults.audits["time-to-first-byte"].rawValue,
    performanceScore: categoryScores.performance,
    pwaScore: categoryScores.pwa,
    accessScore: categoryScores.accessibility,
    bestPracticeScore: categoryScores["best-practices"],
    seoScore: categoryScores.seo,
    networkRequests: lighthouseResults.audits["network-requests"].rawValue,
    totalByteWeight: lighthouseResults.audits["total-byte-weight"].rawValue,
    interactive: lighthouseResults.audits["interactive"].rawValue,
    errorsInConsole: lighthouseResults.audits["errors-in-console"].rawValue,
    htmlBytes: contentBreakDown.bytesCount.document,
    htmlRequests: contentBreakDown.mimeTypeRequests.document,
    jsBytes: contentBreakDown.bytesCount.script,
    jsRequests: contentBreakDown.mimeTypeRequests.script,
    cssBytes: contentBreakDown.bytesCount.stylesheet,
    cssRequests: contentBreakDown.mimeTypeRequests.stylesheet,
    fontBytes: contentBreakDown.bytesCount.font,
    fontRequests: contentBreakDown.mimeTypeRequests.font,
    imageBytes: contentBreakDown.bytesCount.image,
    imageRequests: contentBreakDown.mimeTypeRequests.image,
    otherBytes: contentBreakDown.bytesCount.other,
    otherRequests: contentBreakDown.mimeTypeRequests.other,
    auditPath: `s3://${s3AuditPath}`,
    screenShot: screenshots,
    date: formatDate(dateNow),
    timeStamp: dateNow.toISOString()
  };

  const {
    MARVIN_TOKEN,
    API_ENDPOINT
  } = process.env;

  // Creates (or reads from cache) a JSON web token to authenticate this request with the Lumos APi
  const axiosConfig = {
    headers: {
      'Content-Type': ' application/json',
      Authorization: `Bearer ${MARVIN_TOKEN}`
    }
  };

  // POST request to lumos api, with authorization headers set.
  axios.post(`${API_ENDPOINT}/audits`, lumosProperties, axiosConfig)
  .then((res) => {
    if (res.status != 200) {
      return reject ({ message: `Api returned non 200 status code, got: ${res.status}`});
    }
    return resolve({ status: 'Success'});
  }).catch((err) => {
    consola.error(`An error occurred when sending data to Lumos for URL ID ${urlId}:\n`, err);
    consola.error('Request:\n', err.response.data.error);
    // consola.error('Response :\n', err.response);
    return reject({status: 'Fail', message: err.message});
  });
});

/**
 * @description uploads all screenshots found to S3
 * @param {number} urlId - the urlId that the audit was ran for
 * @param {Object[]} screenshots - this is the data found in  .audits["screenshot-thumbnails"] of a lighthoust report that represent different screenshots for the webpage tested
 */
const handleScreenshots = (urlId, screenshots) => new Promise((resolve, reject) => {
  if (!containsScreenshots(screenshots)) { // check for screenshots so we can safely access screenshots.details.items
    return resolve({ message: 'No screenshots found for this Audit'});
  }

  const { items } = screenshots.details;
  const promises = items.map((screenshot) => {
    buf = new Buffer(screenshot.data.replace(/^data:image\/\w+;base64,/, ''),'base64');

    const params = {
        Bucket: process.env.BUCKET_PATH,
        Key: getScreenshotPath({ urlId, screenshot }),
        Body: buf,
        ContentEncoding: 'base64',
        ContentType: 'image/jpeg'
    };
    return awsUtil.uploadToAWS(params);
  });

  return Promise.all(promises)
    .then((results) => {
      return resolve(results);
    })
    .catch((err) => {
      return reject(err);
    });
});

module.exports = {
  handleLighthouseResults,
  handleScreenshots,
  grabReportingCategories,
  calculateContentBreakDown
};