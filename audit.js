const axios = require('axios');
const consola = require('consola');

const { uploadToAWS } = require('../util/aws');
const formatDate = require('../util/formatDate');


const {
  handleScreenshots,
  handleLighthouseResults
} = require('./lumos');

const {
  sendToCohesion
} = require('./cohesion');

const runLighthouse = require('../util/lighthouse');

const fetchAuditURLs = async (environment) => {
  const endpointURL = `${process.env.API_ENDPOINT}/urls`;
  const { MARVIN_TOKEN } = process.env;
  const axiosConfig = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MARVIN_TOKEN}`
    }
  };

  try {
    // Get the site list from the Lumos API
    const response = await axios.get(endpointURL, axiosConfig);
    const { data } = response.data;
    auditURLList = data;

  } catch (err) {
    consola.error(err.message);
    if (err.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      consola.log(`Response data (${err.response.data.length} char length):`);
      consola.log(err.response.data);
      consola.log('--');
      consola.log(`Response Status Code: ${err.response.status}`);
      consola.log('--');
      consola.log('Response Headers:');
      consola.log(err.response.headers);
    } else if (err.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      consola.error(err.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      consola.error('Error', err.message);
    }
    consola.error(err.config);
    process.exit(1);
  }

  return auditURLList;
};

const audit = async (auditURL) => {
  const date = new Date();
  consola.debug(`DEBUG - Running audits on Stratus site list - started @ ${date}`);
  consola.info(`${date} - Auditing URL: ${auditURL}`);
  let auditResponse = {
    result: {},
    status: ''
  };

  try {
    // Run Lighthouse audit for this URL
    lighthouseResponse = await runLighthouse(auditURL);
    // Parse resulting report into JSON
    try {
      let report;
      report = JSON.parse(lighthouseResponse.report);
      auditResponse.status = `SUCCESS - The lighthouse audit for ${auditURL} was successful`

      const lighthouseResults = Object.assign(report);
      delete lighthouseResults.artifacts; // The gathered artifacts are typically removed as they can be quite large (~50MB+)
  
      const { audits } = lighthouseResults;
      const auditsArr = Object.values(audits); // Issues with using this structure with Athena, so creating an array with same values
      lighthouseResults.parsedAudits = auditsArr;

      auditResponse.result = report;
    } catch (err) {
      auditResponse.status = `FAIL - Unable to parse lighthouse report for ${auditURL}: ${err.message}`
      auditResponse.result = err;
    }
  } catch (err) {
    auditResponse.result = err;
    auditResponse.status = `FAIL - The lighthouse audit for ${auditURL} failed`;
  }

  return auditResponse;
};

/**
 * Uploads raw lighthouse audit results to AWS S3, at the provided bucketPath. Also 
 * 
 * @param {*} urlId 
 * @param {*} bucketPath 
 * @param {*} results 
 */
const processLighthouseResults = async (urlId, bucketPath, results) => {
  // Looks like the new version of Lighthouse returns the report
  // both as a JSON string and as a JSON object. Going to go with the JSON string
  // since that output is what's expected if a report is being viewed on https://googlechrome.github.io/lighthouse/viewer/
  let parsedResults;

  consola.info('DEBUG - Parsing results');
  if (results) {
    if (typeof results !== 'object') {
        parsedResults = JSON.parse(results);
    } else {
      parsedResults = results.result;
    }
  } else {
    throw new Error(`Invalid type for results: ${typeof results} for URL ID ${urlId}`);
  }

  const lighthouseResults = Object.assign(parsedResults);
  delete lighthouseResults.artifacts; // The gathered artifacts are typically removed as they can be quite large (~50MB+)

  const { audits } = lighthouseResults;
  const auditsArr = Object.values(audits); // Issues with using this structure with Athena, so creating an array with same values
  lighthouseResults.parsedAudits = auditsArr;

  const date = new Date();
  const dateString = formatDate(date); // YYYY-MM-DD
  const s3ObbjKey = `${dateString}/${urlId}/${date.toJSON()}.json`;

  /** Write results to S3 bucket using name arg */
  // console.log(`START - Uploading Lighthouse report '${params.Key}' to ${params.Bucket}`);
  consola.info('Sending Lighthouse audit to S3...');
  const rawDataUpload = await uploadToAWS({ Bucket: bucketPath, Key: s3ObbjKey, Body: JSON.stringify(lighthouseResults) });
  consola.info('Data upload:', rawDataUpload);
  let lumosDataUpload = null;
  let screenshotsUpload = null;
  
  if (lighthouseResults.runtimeError.code == "NO_ERROR") {
    consola.info('Sending Lighthouse screenshots to S3...');
    screenshotsUpload = await handleScreenshots(urlId, lighthouseResults.audits['screenshot-thumbnails']);
    consola.info('Processing Lighthouse audit to send to API ...');
    lumosDataUpload = await handleLighthouseResults(urlId, `${bucketPath}/${s3ObbjKey}`, lighthouseResults);
    consola.info('Sending data to Cohesion ...');
    sendCohesionData = await sendToCohesion(urlId, lighthouseResults);
  }

  Promise.all([rawDataUpload, screenshotsUpload, lumosDataUpload, sendCohesionData])
  .then((values) => {
    console.log('All data was uploaded...');
    return {status: 'Success', results: values };
  })
  .catch((err) => {
    return err;
  });
}

module.exports = {
  fetchAuditURLs,
  audit,
  processLighthouseResults
};