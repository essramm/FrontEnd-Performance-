const { getJwt } = require('@redventures/auth');
const awsUtil = require('../util/aws');

const setAuthEnvVars = (ssmParameterPrefix, ssmParameters) => {
  // Loop through response and set env variables for marvin to read later
  ssmParameters.map((d) => {
    // This takes something like /stratus/dev_stratus_lighthouse_auth_clientid
    // and converts it to stratus_lighthouse_auth_clientid
    const envName = d.Name.replace(`${ssmParameterPrefix}_`, '');
    process.env[envName] = d.Value;
  });
}

const getSSMParameterPrefix = (environment) => {
  let ssmPrefix = '/stratus';

  if (environment.includes('prod')) {
    ssmPrefix = `${ssmPrefix}/prod`;
  } else if (environment.includes('staging')) {
    ssmPrefix = `${ssmPrefix}/staging`;
  } else {
    ssmPrefix = `${ssmPrefix}/dev`;
  }

  return ssmPrefix;
}

/**
 * @description Returns a promise that resolves to a JWT via @redventures/auth, or rejects with an error 
 * @see: https://github.com/RedVentures/sdk-node/tree/master/packages/auth
 */
const auth = async (environment) => {
  const ssmParameterPrefix = getSSMParameterPrefix(environment);
  const params = {
    Names: [
      `${ssmParameterPrefix}_stratus_lighthouse_auth_clientid`,
      `${ssmParameterPrefix}_stratus_lighthouse_auth_clientsecret`,
      `${ssmParameterPrefix}_stratus_lighthouse_auth_tenanturl`,
      `${ssmParameterPrefix}_stratus_lighthouse_auth_resourceid`,
      `${ssmParameterPrefix}_cohesion_write_key`,
    ],
    WithDecryption: true
  };

  let ssmParameters;
  try {
    ssmResponse = await awsUtil.getSSMParameters(params);
    ssmParameters = ssmResponse.Parameters;
  } catch (err) {
    console.log('An error occurred loading AWS SSM parameters:');
    console.log('Error code:', err.code);
    console.log('Error:', err.message);
    console.log('Request ID:', err.requestId)
    console.log('Timestamp:', err.time);
    console.log(err.stack);
    process.exit(1);
  }

  setAuthEnvVars(ssmParameterPrefix, ssmParameters);

  return new Promise((resolve, reject)=> {
     // Via: https://github.com/RedVentures/sdk-node/tree/master/packages/auth#example-usage-2
    return getJwt({
      appID: process.env.stratus_lighthouse_auth_clientid,
      secret: process.env.stratus_lighthouse_auth_clientsecret,
      tenantURL: process.env.stratus_lighthouse_auth_tenanturl,
      resource: process.env.stratus_lighthouse_auth_resourceid,
      expireThreshold: 20,
      cb: (err, token) => {
        if (!err) {
          return resolve(token);
        } else {
          return reject(err)
        }
      }
    })
  });
}

module.exports = auth;
