/*
 * Make sure this file resides in the same directory as your package.json or node_modules.
 * This expects nightwatch, handlebars, underscore to be installed
 */
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const junitReporter = require('./node_modules/nightwatch/lib/runner/reporters/junit.js');
const _ = require('underscore');

module.exports = {
  write : function(results, options, done) {
    console.log('-------writing reports now----------');
    const reportFilename = options.filename_prefix + Date.now() + '.html';
    const reportFilePath = path.join(__dirname, options.output_folder, reportFilename);
    /*
     * screenshotDetails {object}
     * screenshotDetails.key {string} module+testname (path to the testfile within the repo)
     * screenshotDetails.value {array[string]} each element containing the full path to the screenshot file corresponding to test (in the key)
     */
    let screenshotDetails = {};
    let key;

    _.each(results.modules, (module, moduleName, modulesObject) => {
      let screenshotsPath = options.globals.test_settings.screenshots.path + '/' + moduleName;
      if(fs.existsSync(screenshotsPath)) {
        let screenshotFiles = fs.readdirSync(screenshotsPath);
        _.each(module.completed, (test, testName, testObject) => {
          if(test.constructor === Object && test.hasOwnProperty('timeMs')) { // check if it's a test object with details
            key = moduleName + '/' + testName;
            screenshotDetails[key] = [];
            _.each(screenshotFiles, (screenshotFileName, index, screenshotFiles) => {
              let regex = new RegExp(testName.replace(/\s+/g, '-') + '_[A-Z]+_.+\.png');
              if(regex.test(screenshotFileName)) {
                let completeFilePath = path.join(__dirname, screenshotsPath, screenshotFileName);
                screenshotDetails[key].push(completeFilePath);
              }
            });
          }
        });
      }
    });

    console.log('---------done reading screenshot files-------------');

    // It exposes the screenshotDetails object to the template
    handlebars.registerHelper('screenshotHelper', function (modulename, testname) {
      let key = modulename+'/'+testname;
      let linkString = '';
      for(let index in screenshotDetails[key]) {
        let counter = parseInt(index) + 1;
        linkString = linkString + '<a target="_blank" href="' + screenshotDetails[key][index] + '">' + counter + '  </a>';
      }
      return new handlebars.SafeString(linkString);
    });


    // read the html template. Use the 'fs' module and the 'writeFile' function to write to a file.
    fs.readFile('html-reporter.hbs', function(err, data) {
      if (err) throw err;
      let template = data.toString();

      // merge the template with the test results data
      let html = handlebars.compile(template)({
        results    : results,
        options    : options,
        timestamp  : new Date().toString(),
        browser    : options.filename_prefix.split('_').join(' ')
      });

      // write junit.xml
      junitReporter.write(results, options, function() {
        console.log('----------junit.xml generated----------');
        // write html report after junit.xml has been written
        fs.writeFile(reportFilePath, html, function(err) {
          if (err) throw err;
          console.log('HTML report generated: ' + reportFilePath);
          done();
        });
      });
    });
  }
};
