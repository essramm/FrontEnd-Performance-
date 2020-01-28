# Stratus Lighthouse
This package programmatically runs [Lighthouse](https://www.npmjs.com/package/lighthouse) audits on a given list of sites, and stores the results of those audits in raw form in an AWS S3 bucket, and also parses and extracts select audit data and inserts it into the [Lumos API](https://github.com/redventures/lumos-api), which is consumed by the [Lumos UI](https://github.com/RedVentures/lumos.stratusapps.io).


This project runs in ECS as a scheduled task in the `rv-stratus` AWS account. The production system runs at `cron(0 5 ? * * *)`, which is every day, at 6:00am. The staging system runs at `cron(0/30 8-22 ? * * *)`, which is every 30 minutes, between the hours of 9:00am and 11:00pm

## Deployment
This repo uses an semi-manual deployment proccess for deployment, along with using the `staging` branch to build for the staging environment, and the `master` branch to build for the production environment. Once the changes that you want are merged into either staging or master go to the following link for your branch:

staging - https://jenkins-rv.redventures.io/job/stratus/job/staging-deployments/job/stratus-lighthouse/

master - https://jenkins-rv.redventures.io/job/stratus/job/master-deployments/job/stratus-lighthouse/

Click `build now` at the top of the page to kick off the build and deployment proccess, the process will then deploy to the desired environment.

The deployment configuration for this project lives at: https://github.com/RedVentures/cops-cd/tree/master/rv/stratus/stratus-lighthouse


## Viewing Production & Staging Logs

You can view the logs for both the staging and production tasks via CloudWatch, in the `rv-stratus` AWS account. 

Visit the [CloudWatch](https://us-east-1.console.aws.amazon.com/cloudwatch/) dashboard in the AWS console, then click "Logs". Enter `/ecs/` in the filter box, and then select either 
`/ecs/stratus-lighthouse-production` or `/ecs/stratus-lighthouse-staging` to view the list of log streams for each environment, respectively.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

Local Dev: 
* NodeJS 8X LTS
* Docker - if you want to build and run the dockerized app
* Oktad account that allows Lambda access (likely the AWS RV Sandbox)
* RV Network access - local or VPN

### Local Install 

A step by step series of examples that tell you have to get a development env running

Clone the repo
```
$ git clone ssh://git@stash.redventures.net/stratuscore/stratus-lighthouse.git
```

Change to stratus-lighthouse cloned directory

```
$ cd ./stratus-inventory-system
```

Then install the deps

```
$ npm install
```

Then use `npm test` to test the lighthouse app or launch the dev server

```
$ npm run dev
```

You should see something like this: 
```$xslt
> MODE=dev NODE_ENV=dev nodemon app.js

[nodemon] 1.17.4
[nodemon] to restart at any time, enter `rs`
[nodemon] watching: *.*
[nodemon] starting `node app.js`
The environment is dev
Dev environment - loading defaults form .env...
Stratus Site Inventory API is listening on port: 4000

MODE: dev

```

The API endpoints are now running locally at the localhost port noted in the console. To test you can simply open a browser tab to `http://localhost:4000/sites`

## Running Tests

This inventory system already has mocha tests defined in the test dir. These tests have already been 
defined in the root dir package.json

### Break down into end to end tests

**NOTE:** These tests have to be run from an oktad console!!!!!

### Testing the Database
The DB Test tests the APIs ability to communicate with DynamoDB in AWS and verifies that all 
database functions (CRULD) are working as expected

From the repo root dir stratus-inventory-system/
```
npm run db-test
```

### Testing the API

The API Test tests verify that all API endpoints are working as expected

From the repo root dir stratus-inventory-system/
```
npm run api-test
```

### Testing Lighthouse

The Lighthouse Test tests verify that the Lighthouse audits work as expected

From the repo root dir stratus-inventory-system/
```
npm run lighthouse-test
```
