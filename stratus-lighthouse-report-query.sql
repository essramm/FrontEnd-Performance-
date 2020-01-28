SELECT
  generatedtime AS Timestamp,
  url AS URL,
  score AS "Overall Score",
  reportcategories[1].score AS "Performance Score",
  reportcategories[2].score AS "PWA Score",
  reportcategories[3].score AS "Accessibility Score",
  reportcategories[4].score AS "Best Practices Score",
  reportcategories[5].score AS "SEO Score",
  reportcategories[1].audits[1].score AS "First Meaningful Paint Score"
FROM raw_reports