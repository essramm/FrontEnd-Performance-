#!/usr/bin/env node
const consola = require('consola');
const auth = require('./lib/auth');
const {
  fetchAuditURLs,
  audit,
  processLighthouseResults
} = require('./lib/audit');

const { invalidURLs, shortListURLs } = require('./mocks/');

// Make sure process.env.NODE_ENV is set or defaults to staging
process.env.NODE_ENV = (!process.env.NODE_ENV) ? 'staging' : process.env.NODE_ENV;
const environment = process.env.NODE_ENV;
const apiEndpointURL = process.env.API_ENDPOINT;
const auditResultS3BucketPath = process.env.BUCKET_PATH;
// const mock = typeof process.env.USE_MOCK !== 'undefined' ? process.env.USE_MOCK : false;
const mock = false;

if (environment.includes('local')) {
  consola.log('Using the localhost .envLocal file...');
  require('dotenv').config({ path: `${process.cwd()}/.envLocal` });
}

if (environment.includes('development')) {
  consola.log('Using the development .envDev file...');
  require('dotenv').config({ path: `${process.cwd()}/.envDev` });
}

// Is this a dev env?
if (environment.includes('staging')) {
  consola.log('Using the staging .envStaging file...');
  require('dotenv').config({ path: `${process.cwd()}/.envStaging` });
}

async function runAudits(environment) {
  consola.debug(`The environment is ${environment}`);
  consola.debug(`DEBUG - AWS S3 audit Bucket path set to ${auditResultS3BucketPath}`);

  consola.debug(`DEBUG - Attempting to fetch audit URL list from: ${apiEndpointURL}`);

  // Fetch Auth0 credentials, get JWT
  process.env.MARVIN_TOKEN = await auth(environment);
  
  let auditURLList;
  if (mock) {
    consola.log('Running with mock URLs');
    // Get the site list from the Lumos API
    auditURLList = invalidURLs;
  } else {
    // Get the site list from the Lumos API
    auditURLList = await fetchAuditURLs(environment);
  }

  consola.debug(`DEBUG - Got a list of ${auditURLList.length} url(s) from ${apiEndpointURL}`);
  // Loop over all Audit URLs, run audit, process results.
  for(let i=0; i<auditURLList.length; i++) {
    let auditURLObject = auditURLList[i];
    
    if (typeof auditResultS3BucketPath !== 'undefined') {
      // Run Lighthouse audit
      const auditResults = await audit(auditURLObject.url);
      
      if(typeof auditResults !== 'undefined') {
        consola.info(`Preparing to process Lighthouse results for ${auditURLObject.url}`);
        try {
          await processLighthouseResults(auditURLObject.id, auditResultS3BucketPath, auditResults)
        } catch(e) {
          consola.error(`FAIL - Error occured when processing lighthouse results for URL '${auditURLObject.url}':\n`, e);
          consola.info('Moving to next URL\n');
        }
        consola.success('SUCCESS - Lighthouse results were processed successfully');
      } else {
        consola.error(`FAIL - Error occured when processing lighthouse results for '${auditURLObject.url}'`);
        consola.error(`FAIL - Audit Result: ${auditResults}`);
        return -1
      }
    } else {
      consola.fatal(`Error - No Bucket path was specified to save lighthouse audit results. Skipping audits process.`);
      return -1
    }
  }

  consola.info('\n\n\nDONE - Exiting the Lighthouse audit testing pipeline');
  process.exit(0); // Exit with zero exit code
}

try {
  runAudits(environment);
} catch(err) {
  consola.error(err);
  process.exit(1);
}