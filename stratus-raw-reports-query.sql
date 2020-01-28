CREATE external TABLE IF NOT EXISTS stratus_lighthouse_reports.raw_reports(
  `generatedtime` string COMMENT 'from deserializer',
  `url` string COMMENT 'from deserializer',
  `score` string COMMENT 'from deserializer',
  `reportCategories` array<
                           struct<
                                  name:string,
                                  id:string,
                                  description:string,
                                  score:string,
                                  audits:
                                        array<
                                              struct<
                                                     id:string,
                                                     score:string,
                                                     result:
                                                            struct<
                                                                   name:string,
                                                                   description:string,
                                                                   score:string
                                                            >
                                              >
                                 >
                                >
                          >)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
STORED AS INPUTFORMAT 'org.apache.hadoop.mapred.TextInputFormat'
OUTPUTFORMAT 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat'
LOCATION 's3://rv-stratus-lighthouse/lighthouse-tests-results/'
TBLPROPERTIES (
  'has_encrypted_data'='false',
  'transient_lastDdlTime'='1526929007')
