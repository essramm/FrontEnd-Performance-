const axios = require('axios');
const consola = require('consola');
const uuidv4 = require('uuid/v4');

const {
  grabReportingCategories,
  calculateContentBreakDown
} = require('./lumos');

/**
 * @description sends Lighthouse data to cohesion
 * @param {number} urlId - the urlId that the audit was ran for
 * @param {Object[]} lighthouseResults  - the raw results of the lighthouse test
 */
const sendToCohesion = async (urlId, lighthouseResults) => {
  consola.info('Starting process to send data to Cohesion');

  const categoryScores = grabReportingCategories(lighthouseResults.categories);
  const contentBreakDown = calculateContentBreakDown(
    lighthouseResults.audits['network-requests']
  );
  const metrics = lighthouseResults.audits.metrics.details.items[0];

  const requestData = {
    messageId: uuidv4(),
    event: 'redventures.browser.v1alpha2.LighthouseCaptured',
    properties: {
      primary_key_id: uuidv4(),
      url_id: urlId.toString(),
      content_width: lighthouseResults.audits['content-width'].score,
      errors_in_console: lighthouseResults.audits['errors-in-console'].rawValue,
      interactive_raw: lighthouseResults.audits['interactive'].rawValue,
      interactive_score: lighthouseResults.audits['interactive'].score,
      seo_score: categoryScores.seo,
      best_practice_score: categoryScores['best-practices'],
      pwa_score: categoryScores.pwa,
      access_score: categoryScores.accessibility,
      performance_score: categoryScores.performance,
      input_latency:
        lighthouseResults.audits['estimated-input-latency'].numericValue,
      first_cpu_idle: lighthouseResults.audits['first-cpu-idle'].numericValue,
      dom_content_loaded: metrics.observedDomContentLoaded,
      dom_content_loaded_ts: metrics.observedDomContentLoadedTs,
      first_contentful_paint: metrics.firstContentfulPaint,
      first_contentful_paint_ts: metrics.observedFirstContentfulPaintTs,
      first_meaningful_paint: metrics.firstMeaningfulPaint,
      first_meaningful_paint_ts: metrics.observedFirstMeaningfulPaintTs,
      first_paint: metrics.observedFirstPaint,
      first_paint_ts: metrics.observedFirstPaintTs,
      first_visual_change: metrics.observedFirstVisualChange,
      first_visual_change_ts: metrics.observedFirstVisualChangeTs,
      last_visual_change: metrics.observedLastVisualChange,
      last_visual_change_ts: metrics.observedLastVisualChangeTs,
      navigation_start: metrics.observedNavigationStart,
      navigation_start_ts: metrics.observedNavigationStartTs,
      speed_index: metrics.speedIndex,
      time_to_first_byte:
        lighthouseResults.audits['time-to-first-byte'].rawValue,
      total_byte_weight: lighthouseResults.audits['total-byte-weight'].rawValue,
      css_bytes: contentBreakDown.bytesCount.stylesheet,
      css_requests: contentBreakDown.mimeTypeRequests.stylesheet,
      font_bytes: contentBreakDown.bytesCount.font,
      font_requests: contentBreakDown.mimeTypeRequests.font,
      html_bytes: contentBreakDown.bytesCount.document,
      html_requests: contentBreakDown.mimeTypeRequests.document,
      image_bytes: contentBreakDown.bytesCount.image,
      image_requests: contentBreakDown.mimeTypeRequests.image,
      js_bytes: contentBreakDown.bytesCount.script,
      js_requests: contentBreakDown.mimeTypeRequests.script,
      network_requests: lighthouseResults.audits['network-requests'].rawValue,
      other_bytes: contentBreakDown.bytesCount.other,
      other_requests: contentBreakDown.mimeTypeRequests.other,
      fetch_time: lighthouseResults.fetchTime,
      requested_url: lighthouseResults.requestedUrl,
      final_url: lighthouseResults.finalUrl
      // We need to discuss what value to use for load_time
      // total_load_time
    },
    sentAt: new Date().toISOString()
  };

  const endpointURL = process.env.COHESION_ENDPOINT;
  const axiosConfig = {
    headers: {
      'Content-Type': 'application/json'
    },
    auth: {
      username: process.env.cohesion_write_key,
      password: ''
    }
  };

  let data;

  try {
    consola.info('Sending POST request');
    const response = await axios.post(endpointURL, requestData, axiosConfig);
    data = response.data;
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

  return data;
};

module.exports = {
  sendToCohesion
};
