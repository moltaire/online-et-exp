jsPsych.plugins["eye-tracking"] = (function () {
  /************************************
   * Helper functions
   ************************************/
  function wait(ms, callback) {
    return setTimeout(callback, ms);
  }

  function optionalWait(flag, ms, callback) {
    if (flag) {
      setTimeout(callback, ms);
    } else {
      callback();
    }
  }

  function optionalMessage(display_element, flag, callback) {
    if (flag) {
      display_element.innerHTML =
        "<div>Validation starts. Press the spacebar to begin. </div>";
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

  function optionalMessage_interTrial(display_element, flag, callback) {
    if (flag) {
      display_element.innerHTML =
        "<div>We need to re-calibrate you. Adjust your position relative to your webcam and proceed by pressing the <b>SPACE BAR</b> when you are ready.</div>";
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

  function prepareReferencePoints(num) {
    var points = utils.shuffle([
      { x: "50%", y: "20%" },
      { x: "80%", y: "20%" },
      { x: "20%", y: "50%" },
      { x: "80%", y: "50%" },
      { x: "20%", y: "80%" },
      { x: "50%", y: "80%" },
      { x: "80%", y: "80%" },
      { x: "35%", y: "35%" },
      { x: "65%", y: "35%" },
      { x: "35%", y: "65%" },
      { x: "65%", y: "65%" },
      { x: "20%", y: "20%" },
      // {x: "45%", y: "5%"},
      // {x: "45%", y: "35%"},
      // {x: "15%", y: "50%"},
      // {x: "15%", y: "60%"},
      // {x: "15%", y: "90%"},
      // {x: "75%", y: "60%"},
      // {x: "75%", y: "90%"},
      // {x: "65%", y: "35%"},
      // {x: "35%", y: "65%"},
      // {x: "50%", y: "80%"},
      // {x: "80%", y: "50%"},
    ]);
    points.length = num;
    // points[0] = {x: "50%", y: "50%"}; // fix the last point (points are popped in reverse order)
    points.unshift({ x: "50%", y: "50%" });
    return points;
  }

  /************************************
   * CALIBRATE
   ************************************/
  function calibrate(displayElement, options, callback) {
    console.log("Started `calibrate`.");
    /** Setup variables */
    var numPoints = options.numPoints || 6;
    var duration = options.duration || 10;
    var showPoint = options.showPoint || false;
    var doVideo = options.doVideo || true;

    var points = prepareReferencePoints(numPoints);
    var data = { history: [] };

    /** Setup display */
    displayElement.innerHTML =
      '<div id="calibration_dot"><div id="calibration_cnt">0</div></div>';
    var calibration_cnt = $("#calibration_cnt");
    var calibration_dot = $("#calibration_dot");
    calibration_dot.hide();

    /** Setup webgazer */
    webgazer.clearData();
    webgazer.showPredictionPoints(showPoint);
    webgazer.showVideo(doVideo);
    webgazer.showFaceOverlay(doVideo);
    webgazer.showFaceFeedbackBox(doVideo);

    console.log("  `calibrate`: Set inner HTML and set up webgazer.");

    /** Helper functions */
    function calibrationLoop(callback) {
      console.log("  `calibrate`: `calibrationLoop` started.");
      if (points.length == 0) {
        callback();
        return;
      }

      var point = points.pop();
      console.log("  current point", point);
      calibration_cnt.html(duration);
      calibration_dot.css({ left: point.x, top: point.y });

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
        webgazer.showPredictionPoints(showPoint);
        callback(data);
      });
    });
  }

  /************************************
   * VALIDATION
   ************************************/
  function validate(displayElement, options, callback) {
    /** Setup variables */
    var numPoints = options.numPoints || 6;
    var duration = options.duration || 10;
    var showPoint = options.showPoint || false;
    var tol = options.tol || 200;
    var threshold = options.threshold || 0.7;
    var doVideo = options.doVideo || false;

    var points = prepareReferencePoints(numPoints);
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
    webgazer.showPredictionPoints(showPoint);
    webgazer.showVideo(doVideo);
    webgazer.showFaceOverlay(doVideo);
    webgazer.showFaceFeedbackBox(doVideo);

    function validationLoop(callback) {
      if (points.length == 0) {
        callback();
        return;
      }

      var point = points.pop();
      validation_dot.css({ left: point.x, top: point.y });
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
          x: point.x,
          y: point.y,
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
        webgazer.showPredictionPoints(showPoint);
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
        description:
          "whether this is the first time to load the web cam or not",
      },
      IsInterTrial: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: false,
        description: "whether this is the intertrial calibration or not",
      },
      doVideo: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: false,
        description:
          "whether ask the subject to open the video during the experiment",
      },
      showPoint: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: false,
        description: "whether show the predcition point or not",
      },
      doCalibration: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: false,
        description: "whether do calibration in this trial",
      },
      showVideoInterTrial: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: true,
        description: "whether show video intertrial",
      },
      calibrationMethod: {
        type: jsPsych.plugins.parameterType.HTML_STRING,
        default: "watch",
        description: "click or watch",
      },
      calibrationDots: {
        type: jsPsych.plugins.parameterType.INT,
        default: 5,
        description: "how many calibration dots",
      },
      calibrationDuration: {
        type: jsPsych.plugins.parameterType.INT,
        default: 3,
        description:
          "how long the calibration dot appears on the screen in seconds",
      },
      doValidation: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: false,
        description: "whether do validation in this trial",
      },
      validationDots: {
        type: jsPsych.plugins.parameterType.INT,
        default: 5,
        description: "how many validation dots",
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
      face_detect_threshold: {
        type: jsPsych.plugins.parameterType.IMAGE,
        pretty_name: "Face Detection Threshold",
        default: 0.8,
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
          //webgazer.setRegression('ridge');
          webgazer.setRegression("threadedRidge");
          //webgazer.params.showVideo = trial.doVideo;
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
            if (score > trial.face_detect_threshold) {
              if (!faceOk) {
                faceOk = true;
                console.log("Face-detection score above threshold.");
              }
            } else {
              if (score < trial.face_detect_threshold) {
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
        });
      } else {
        webgazer.resume();
        callback();
      }
    }

    function startCalibration(callback) {
      if (trial.doCalibration) {
        options = {
          numPoints: trial.calibrationDots,
          duration: trial.calibrationDuration,
          showPoint: trial.showPoint,
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
          numPoints: trial.validationDots,
          duration: trial.validationDuration,
          showPoint: trial.showPoint,
          tol: trial.validationTol,
          threshold: trial.validationThreshold,
          //doVideo: trial.doValidationVideo
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
        ${trial.face_detect_threshold * 100}%;'>
        </div>
        </div>
        </div>
        `;
    }

    function check_face_score() {
      return webgazer.getTracker().clm.getScore();
    }

    startWebgazer(function (err) {
      if (err) {
        console.log(err);
        alert(
          "Error: Cannot start eye-tracking.\nHave you permitted access to the webcam? This study needs to use the webcam."
        );
        location.reload();
        return;
      }
      webgazer.showFaceOverlay(trial.showVideoInterTrial);
      webgazer.showFaceFeedbackBox(trial.showVideoInterTrial);
      webgazer.showVideo(trial.showVideoInterTrial || trial.doVideo);
      optionalWait(
        trial.doCalibration && trial.IsInterTrial,
        1000,
        function () {
          optionalMessage_interTrial(
            display_element,
            trial.doCalibration && trial.IsInterTrial,
            function () {
              webgazer.showFaceOverlay(trial.showVideoInterTrial);
              webgazer.showFaceFeedbackBox(trial.showVideoInterTrial);
              webgazer.showVideo(trial.doVideo);
              console.log("Starting calibration");
              startCalibration(function (calibrationData) {
                optionalWait(
                  trial.doCalibration && trial.doValidation,
                  1000,
                  function () {
                    optionalMessage(
                      display_element,
                      trial.doCalibration && trial.doValidation,
                      function () {
                        console.log("Starting validation");
                        startValidation(function (validationData) {
                          var data = {
                            validationPoints: JSON.stringify(
                              validationData.points
                            ),
                            // validationData.points,
                            accuracy: computeAccuracy(validationData.points),
                            // calibrationHistory: calibrationData.history,
                            validationnHistory: validationData.history,
                          };
                          jsPsych.finishTrial(data);
                        });
                      }
                    );
                  }
                );
              });
            }
          );
        }
      );
    });
  };

  return plugin;
})();
