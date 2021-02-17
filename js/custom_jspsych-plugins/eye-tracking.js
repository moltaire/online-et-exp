jsPsych.plugins["eye-tracking"] = (function () {
  /************************************
   * Helper functions
   ************************************/
  function wait(ms, callback) {
    return setTimeout(callback, ms);
  }

  function optionalWait(condition, ms, callback) {
    if (condition) {
      setTimeout(callback, ms);
    } else {
      callback();
    }
  }

  function optionalMessage(display_element, html, condition, callback) {
    if (condition) {
      display_element.innerHTML = html;
      console.log("Im supposed to show this message:", html);
      var onkeyup = function (e) {
        if (e.keyCode == 32) {
          removeEventListener("keyup", onkeyup);
          callback();
        }
      };
      addEventListener("keyup", onkeyup);
    } else {
      callback({});
    }
  }

  function vectorLength(x, y) {
    return Math.sqrt(x * x, y * y);
  }

  /************************************
   * CALIBRATE
   ************************************/
  function calibrate(displayElement, options, callback) {
    console.log("Started `calibrate`.");
    /** Setup variables */
    var duration = options.duration || 10;
    var showWebgazerPrediction = options.showWebgazerPrediction || false;

    if (options.shufflePoints) {
      options.points = jsPsych.randomization.repeat(options.points, 1);
    }
    var data = { history: [] };

    /** Setup display */
    displayElement.innerHTML =
      '<div id="calibration_dot"><div id="calibration_cnt">0</div></div>';
    var calibration_cnt = $("#calibration_cnt");
    var calibration_dot = $("#calibration_dot");
    calibration_dot.hide();

    /** Setup webgazer */
    webgazer.clearData();
    webgazer.showPredictionPoints(showWebgazerPrediction);

    console.log("  `calibrate`: Set inner HTML and set up webgazer.");

    /** Helper functions */
    function calibrationLoop(callback) {
      console.log("  `calibrate`: `calibrationLoop` started.");
      if (options.points.length == 0) {
        callback();
        return;
      }

      var point = options.points.pop();
      console.log("  current point", point);
      calibration_cnt.html(duration);
      calibration_dot.css({ left: point[0] + "%", top: point[1] + "%" });

      var cx = parseInt(Math.round(calibration_dot.offset().left));
      var cy = parseInt(Math.round(calibration_dot.offset().top));

      var trainer;
      wait(800, function () {
        trainer = setInterval(function () {
          webgazer.watchListener(cx, cy);
        }, 5);
      });

      var logger = setInterval(function () {
        var pos = webgazer.getCurrentPrediction();
        if (pos) {
          var c = calibration_cnt.html();
          var dist = vectorLength(pos.x - cx, pos.y - cy);
          data.history.push({
            x: pos.x,
            y: pos.y,
            cx: cx,
            cy: cy,
            dist: dist,
            count: c,
          });
        }
      }, 100);

      var counter = setInterval(function () {
        calibration_cnt.html(calibration_cnt.html() - 1);
      }, 1000);

      wait(duration * 1000, function () {
        clearInterval(trainer);
        clearInterval(logger);
        clearInterval(counter);
        calibrationLoop(callback);
      });
    }
    console.log("  `calibrate`: Starting calibration loop.");
    wait(1000, function () {
      calibration_dot.show();
      console.log("  Calibration dot shown.");
      calibrationLoop(function () {
        displayElement.innerHTML = "";
        webgazer.showPredictionPoints(showWebgazerPrediction);
        callback(data);
      });
    });
  }

  /************************************
   * VALIDATION
   ************************************/
  function validate(displayElement, options, callback) {
    /** Setup variables */
    var duration = options.duration || 10;
    var showWebgazerPrediction = options.showWebgazerPrediction || false;
    var tol = options.tol || 200;
    var threshold = options.threshold || 0.7;

    if (options.shufflePoints) {
      options.points = jsPsych.randomization.repeat(options.points, 1);
    }
    var success_color = "green";
    var failure_color = "orange";
    var data = { points: [], history: [] };

    /** Setup display */
    displayElement.innerHTML =
      '<div id="validation_dot"><div id="validation_cnt">0</div></div>';
    var validation_dot = $("#validation_dot");
    var validation_cnt = $("#validation_cnt");
    validation_dot.hide();

    /** Setup webgazer */
    webgazer.clearData();
    webgazer.showPredictionPoints(showWebgazerPrediction);

    function validationLoop(callback) {
      if (options.points.length == 0) {
        callback();
        return;
      }

      var point = options.points.pop();
      validation_dot.css({ left: point[0] + "%", top: point[1] + "%" });
      validation_cnt.html(duration);

      var cx = parseInt(Math.round(validation_dot.offset().left));
      var cy = parseInt(Math.round(validation_dot.offset().top));
      var hitCount = 0,
        totalCount = 0;

      var tester, timer, logger, counter, nextPoint;

      wait(500, function () {
        tester = setInterval(function () {
          var pos = webgazer.getCurrentPrediction();
          if (!pos) return;
          var dist = vectorLength(pos.x - cx, pos.y - cy);
          if (dist < tol) {
            hitCount += 1;
          }
          totalCount += 1;
        }, 10);
      });

      timer = setTimeout(function () {
        nextPoint();
      }, duration * 1000);

      logger = setInterval(function () {
        var pos = webgazer.getCurrentPrediction();
        if (pos) {
          var c = validation_cnt.html();
          var dist = vectorLength(pos.x - cx, pos.y - cy);
          data.history.push({
            x: pos.x,
            y: pos.y,
            cx: cx,
            cy: cy,
            dist: dist,
            count: c,
          });
        }
      }, 50);

      counter = setInterval(function () {
        validation_cnt.html(validation_cnt.html() - 1);
      }, 1000);

      nextPoint = function () {
        clearInterval(tester);
        clearTimeout(timer);
        clearInterval(logger);
        clearInterval(counter);
        var hitRatio = hitCount / totalCount;
        var success = hitRatio > threshold;
        data.points.push({
          x: point[0],
          y: point[1],
          valid: success,
          hitRatio: hitRatio,
          hitCount: hitCount,
          totalcount: totalCount,
        });
        validation_dot.css({
          "background-color": success ? success_color : failure_color,
        });
        wait(1000, function () {
          validation_dot.css({ "background-color": "#dd494b" });
          validationLoop(callback);
        });
      };
    }

    wait(1000, function () {
      validation_dot.show();
      validationLoop(function () {
        displayElement.innerHTML = "";
        webgazer.showPredictionPoints(showWebgazerPrediction);
        callback(data);
      });
    });
  }

  var plugin = {};

  /************************************
   * plugin parameters for calibration and validation using webgazer
   ************************************/
  plugin.info = {
    name: "eye-tracking",
    parameters: {
      doInit: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: false,
        description: "Whether to initialize the webcam and webgazer, or not.",
      },
      doCalibration: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: true,
        description: "Whether to perform the calibration routine.",
      },
      showVideoCalibration: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: false,
        description: "Whether to show the video feed during calibration.",
      },
      calibrationMessage: {
        type: jsPsych.plugins.parameterType.HTML_STRING,
        pretty_name: "Calibration message",
        default: undefined,
        description: "The optional message shown before calibration.",
      },
      showCalibrationMessage: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: true,
        description: "Whether to show a message prior to calibration.",
      },
      doValidation: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: true,
        description: "whether this is the intertrial Validation or not",
      },
      showVideoValidation: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: false,
        description: "Whether to show the video feed during Validation.",
      },
      validationMessage: {
        type: jsPsych.plugins.parameterType.HTML_STRING,
        pretty_name: "Validation message",
        default: undefined,
        description: "The optional message shown before validation.",
      },
      showValidationMessage: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: true,
        description: "Whether to show a message prior to Validation.",
      },
      showWebgazerPrediction: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: false,
        description: "Whether show the current webgazer prediction.",
      },
      calibrationPoints: {
        type: jsPsych.plugins.parameterType.INT,
        default: [
          [10, 50],
          [10, 90],
          [10, 10],
          [50, 10],
          [50, 50],
          [50, 90],
          [90, 10],
          [90, 50],
          [90, 90],
        ],
        description: "List of calibration point coordinates.",
      },
      calibrationDuration: {
        type: jsPsych.plugins.parameterType.INT,
        default: 3,
        description:
          "how long the calibration dot appears on the screen in seconds",
      },
      validationPoints: {
        type: jsPsych.plugins.parameterType.INT,
        default: [
          [30, 50],
          [30, 70],
          [30, 30],
          [50, 30],
          [50, 50],
          [50, 70],
          [70, 30],
          [80, 50],
          [70, 70],
        ],
        description: "List of validation point coordinates.",
      },
      validationDuration: {
        type: jsPsych.plugins.parameterType.INT,
        default: 2,
        description:
          "how long the calibration dot appears on the screen in seconds",
      },
      validationTol: {
        type: jsPsych.plugins.parameterType.INT,
        default: 200,
        description: "validation tolerent distance",
      },
      validationThreshold: {
        type: jsPsych.plugins.parameterType.FLOAT,
        default: 0.7,
        description: "criterion set for the validation ",
      },
      shufflePoints: {
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: "Shuffle calibration / validation points",
        default: true,
        description:
          "Whether to randomly shuffle the order of calibration and validation points.",
      },
      doFaceDetection: {
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: "Run face detection setup",
        default: true,
        description:
          "Whether to show the face detection screen, where subjects can adjust their camera to get a good face detection score.",
      },
      faceDetectionThreshold: {
        type: jsPsych.plugins.parameterType.IMAGE,
        pretty_name: "Face Detection Threshold",
        default: 0.7,
        description:
          "A value between 0-1 representing the quality of the face detection that must be achieved before moving to calibration.",
      },
    },
  };

  plugin.trial = function (display_element, trial) {
    display_element.innerHTML = "";

    function startWebgazer(callback) {
      if (trial.doInit) {
        //  Webcam is ready, please press the spacebar to continue
        //begin webgazer and also set up webgazer parameter
        webgazer.begin(function (err) {
          if (err) {
            callback(err);
            return;
          }
          webgazer.setRegression("threadedRidge");

          if (trial.doFaceDetection) {
            var faceOk = false;
            var done = false;
            function detectFaceLoop() {
              if (!done) {
                show_video_detect_message();
                var wg_container = display_element.querySelector(
                  "#webgazer-calibrate-container"
                );
                var score = check_face_score();
                wg_container.querySelector(
                  "#video-detect-quality-inner"
                ).style.width = score * 100 + "%";
              }
              if (score > trial.faceDetectionThreshold) {
                if (!faceOk) {
                  faceOk = true;
                  console.log("Face-detection score above threshold.");
                }
              } else {
                if (score < trial.faceDetectionThreshold) {
                  if (faceOk) {
                    faceOk = false;
                    console.log("Face-detection score below threshold.");
                  }
                }
              }
              // Stop loop if done
              if (!done) {
                requestAnimationFrame(detectFaceLoop);
              } else {
                display_element.innerHTML = "";
                console.log("Face-detection loop stopped. (inside)");
                callback();
                console.log("Callback called.");
              }
            }
            // continue if spacebar pressed
            var onkeyup = function (e) {
              if (e.keyCode == 32 && faceOk) {
                console.log("Face-detection done.");
                done = true;
                removeEventListener("keyup", onkeyup);
              }
            };
            addEventListener("keyup", onkeyup);
            console.log("Face-detection loop started.");
            requestAnimationFrame(detectFaceLoop);
          } else {
            // No face detection
            callback();
          }
        });
      } else {
        webgazer.resume();
        callback();
      }
    }

    function startCalibration(callback) {
      if (trial.doCalibration) {
        options = {
          points: trial.calibrationPoints,
          shufflePoints: trial.shufflePoints,
          duration: trial.calibrationDuration,
          showWebgazerPrediction: trial.showWebgazerPrediction,
        };
        calibrate(display_element, options, function (data) {
          callback(data);
        });
      } else {
        callback();
      }
    }

    function startValidation(callback) {
      addEventListener("keyup", onkeyup);
      if (trial.doValidation) {
        options = {
          points: trial.validationPoints,
          shufflePoints: trial.shufflePoints,
          duration: trial.validationDuration,
          showWebgazerPrediction: trial.showWebgazerPrediction,
          tol: trial.validationTol,
          threshold: trial.validationThreshold,
        };
        //begin validation
        validate(display_element, options, function (data) {
          callback(data);
        });
      } else {
        callback({});
      }
    }

    function computeAccuracy(validationPoints) {
      var count = 0;
      if (validationPoints == null) {
        return 1;
      } else {
        validationPoints.forEach((point) => {
          if (point.valid) count += 1;
        });
        return count / validationPoints.length;
      }
    }

    function show_video_detect_message() {
      var html =
        "<div id='webgazer-calibrate-container' style='position: relative; width:95vw; height:95vh;'>";
      html += "</div>";

      display_element.innerHTML = html;

      var wg_container = display_element.querySelector(
        "#webgazer-calibrate-container"
      );

      wg_container.innerHTML = `
        <div style='position: absolute; top: 50%; left: calc(50% - 400px); transform: translateY(-50%); width:800px;'>
        <p>To start, you need to position your head so that the webcam has a good view of your eyes.</p>
        <p>Use the video in the upper-left corner as a guide. Center your face in the box.</p>
        <p>The goal is to align the green face-mask with your face, <b>especially your eyes</b> like this:</p>
        <img src='img/et-instructions/et-instruct_0.png' width=20%>
        <p>Use these tips to achieve a good quality fit:<p>
        <img src='img/et-instructions/et-instruct_1.png' width=100%>
        <p>Try to change the lighting if you cannot achieve a good quality fit.</p>
        <p>Once you reached the necessary quality as indicated by the meter below, press the <b>SPACE BAR</b> to continue</p>
        <p>Quality of detection:</p>
        <div id='video-detect-quality-container' style='width:700px; height: 20px; background-color:#ccc; position: relative;'>
        <div id='video-detect-quality-inner' style='width:0%; height:20px; background-color: #5c5;'></div>
        <div id='video-detect-threshold' style='width: 1px; height: 20px; background-color: #f00; position: absolute; top:0; left:
        ${trial.faceDetectionThreshold * 100}%;'>
        </div>
        </div>
        </div>
        `;
    }

    function check_face_score() {
      return webgazer.getTracker().clm.getScore();
    }

    // Trial procedure
    // 1. Start webgazer, possibly initializing it. This function currently also includes the optional face detection screen.
    startWebgazer(function (err) {
      if (err) {
        console.log(err);
        alert(
          "Error: Cannot start eye-tracking.\nHave you permitted access to the webcam? This study needs to use the webcam."
        );
        location.reload();
        return;
      }
      optionalWait(trial.doCalibration, 1000, function () {
        // 2. Calibration
        // 2.1 Show (optional) pre-calibration message
        optionalMessage(
          display_element,
          trial.calibrationMessage,
          trial.doCalibration && trial.showCalibrationMessage,
          function () {
            webgazer.showFaceOverlay(trial.showVideoCalibration);
            webgazer.showFaceFeedbackBox(trial.showVideoCalibration);
            webgazer.showVideo(trial.showVideoCalibration);
            console.log("Starting calibration");
            // 2.2 Calibration routine
            startCalibration(function (calibrationData) {
              webgazer.showFaceOverlay(false);
              webgazer.showFaceFeedbackBox(false);
              webgazer.showVideo(false);
              optionalWait(trial.doValidation, 1000, function () {
                // 3. Validation
                // 3.1 Show (optional) pre-validation message
                optionalMessage(
                  display_element,
                  trial.validationMessage,
                  trial.doValidation && trial.showValidationMessage,
                  function () {
                    console.log("Starting validation");
                    // 3.2 Validation routine
                    webgazer.showVideo(trial.showVideoValidation);
                    webgazer.showFaceOverlay(trial.showVideoValidation);
                    webgazer.showFaceFeedbackBox(trial.showVideoValidation);

                    startValidation(function (validationData) {
                      var data = {
                        validationPoints: JSON.stringify(validationData.points),
                        accuracy: computeAccuracy(validationData.points),
                        validationnHistory: validationData.history,
                      };
                      webgazer.showPredictionPoints(false);
                      webgazer.showVideo(false);
                      webgazer.showFaceFeedbackBox(false);
                      webgazer.showFaceOverlay(false);
                      jsPsych.finishTrial(data);
                    });
                  }
                );
              });
            });
          }
        );
      });
    });
  };

  return plugin;
})();
