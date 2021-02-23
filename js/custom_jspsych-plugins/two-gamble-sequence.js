/**
 * jspsych-two-gamble-sequence
 * Felix Molter
 *
 * a jsPsych plugin for displaying parts of two all-or-nothing gamble stimuli, described by a pie chart and a bar chart in sequence
 *
 **/

jsPsych.plugins["two-gamble-sequence"] = (function () {
  var plugin = {};

  plugin.info = {
    name: "two-gamble-sequence",
    description: "",
    parameters: {
      stimulus: {
        type: jsPsych.plugins.parameterType.OBJECT,
        description: "Stimulus object, containing attributes p0, p1, m0, m1",
      },
      choices: {
        type: jsPsych.plugins.parameterType.KEYCODE,
        array: true,
        pretty_name: "Choices",
        default: jsPsych.ALL_KEYS,
        description:
          "The keys the subject is allowed to press to respond to the stimulus.",
      },
      topAttribute: {
        type: jsPsych.plugins.parameterType.STR,
        pretty_name: "Top attribute.",
        default: "probability",
        description:
          "Which attribute ('probability' or 'outcome') is displayed in the top row.",
      },
      sequence: {
        type: jsPsych.plugins.parameterType.OBJECT,
        description:
          "Sequence object, containing attributes `durations`, `alternatives`, `attributes`",
      },
      choicePrompt: {
        type: jsPsych.plugins.parameterType.STR,
        pretty_name: "Choice prompt.",
        default: "Choose!",
        description: "The text shown after sequence presentation.",
      },
      choiceTimeout: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: "Choice timeout",
        default: 1000,
        description:
          "How long to wait for a response after sequence was shown.",
      },
      feedbackDuration: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: "Feedback duration.",
        default: 500,
        description: "Duration for which the feedback frame is shown (ms).",
      },
      doEyeTracking: {
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: "eye-tracking",
        default: true,
        description: "Whether to do the eye tracking during this trial.",
      },
      showPredictionPoints: {
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: "webgazer-prediction-point",
        default: true,
        description: "Whether to show the current webgazer-prediction.",
      },
      feedbackColor: {
        type: jsPsych.plugins.parameterType.STR,
        pretty_name: "Feedback color",
        default: "Gold",
        description: "Color of the choice feedback frame and choice prompt",
      },
      stimForegroundColor: {
        type: jsPsych.plugins.parameterType.STR,
        pretty_name: "Stimulus foreground color",
        default: "ForestGreen",
        description: "Color of the filled portions of the gamble stimuli",
      },
      stimBackgroundColor: {
        type: jsPsych.plugins.parameterType.STR,
        pretty_name: "Stimulus background color",
        default: "FireBrick",
        description: "Color of the unfilled portions of the gamble stimuli",
      },
      timeoutWarningColor: {
        type: jsPsych.plugins.parameterType.STR,
        pretty_name: "Timeout warning color",
        default: "red",
        description: "Color of warning after time out (no response).",
      },
      timeoutWarningText: {
        type: jsPsych.plugins.parameterType.STR,
        pretty_name: "Timeout warning text",
        default: "Too slow!",
        description: "Text of warning after time out (no response).",
      },
      showTimeoutWarning: {
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: "Show timeout warning",
        default: true,
        description: "Whether to show timeout warning after no response.",
      },
    },
  };

  plugin.trial = async function (display_element, trial) {
    // Randomize item positions
    var stimuli = [
      [trial.stimulus.p0, trial.stimulus.m0],
      [trial.stimulus.p1, trial.stimulus.m1],
    ];
    var leftItem = jsPsych.randomization.sampleWithoutReplacement([0, 1], 1)[0];
    trial.pL = stimuli[leftItem][0]; // left probability
    trial.mL = stimuli[leftItem][1]; // left magnitude
    trial.pR = stimuli[1 - leftItem][0]; // right probability
    trial.mR = stimuli[1 - leftItem][1]; // right magnitude

    var response = {
      rt: null,
      key: null,
    };

    var boxWidthScale = 2; // Size of surrounding box, relative to pie chart diameter

    //--------Set up Canvas start-------
    var gambleCanvas = document.createElement("canvas");
    gambleCanvas.width = 0.95 * screen.width;
    gambleCanvas.height = 0.95 * screen.height;
    display_element.appendChild(gambleCanvas);

    function drawPiechart(
      ctx,
      p,
      x,
      y,
      radius,
      fillColor = "green",
      backColor = "red"
    ) {
      // Filled segment
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(
        x,
        y,
        radius,
        1.5 * Math.PI,
        1.5 * Math.PI + p * 2 * Math.PI,
        false
      );
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();

      // Background segment
      ctx.fillStyle = backColor;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(
        x,
        y,
        radius,
        1.5 * Math.PI + p * 2 * Math.PI,
        3.5 * Math.PI,
        false
      );
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
    }

    function drawBarchart(
      ctx,
      m,
      x,
      y,
      width,
      height,
      fillColor = "green",
      backColor = "red"
    ) {
      // Background segment
      ctx.fillStyle = backColor;
      ctx.beginPath();
      ctx.fillRect(x, y, width, height);

      // Filled segment
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.fillRect(x, y + (1 - m) * height, width, m * height);
      ctx.closePath();
    }

    var drawStims = function (i) {
      // Frames
      // Left
      // ctx.strokeStyle = stimFrameColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        left_xpos - boxWidthScale * radius,
        gambleCanvas.height * 0.2,
        2 * boxWidthScale * radius,
        gambleCanvas.height * 0.7
      );
      // Right
      ctx.strokeRect(
        right_xpos - boxWidthScale * radius,
        gambleCanvas.height * 0.2,
        2 * boxWidthScale * radius,
        gambleCanvas.height * 0.7
      );

      // Loop over alternatives and draw everything
      var alt;
      for (alt = 0; alt < 2; alt++) {
        // -- Probability
        if (
          trial.sequence.alternatives[i] == alt ||
          trial.sequence.alternatives[i] == "all"
        ) {
          if (
            trial.sequence.attributes[i] == "p" ||
            trial.sequence.attributes[i] == "all"
          ) {
            drawPiechart(
              ctx,
              stimuli[alt][0],
              xpos[alt],
              probability_ypos,
              radius,
              trial.stimForegroundColor,
              trial.stimBackgroundColor
            );
          }
          // -- Magnitude
          if (
            trial.sequence.attributes[i] == "m" ||
            trial.sequence.attributes[i] == "all"
          ) {
            drawBarchart(
              ctx,
              stimuli[alt][1],
              xpos[alt] - 0.5 * width,
              magnitude_ypos,
              width,
              height,
              trial.stimForegroundColor,
              trial.stimBackgroundColor
            );
          }
        }
      }
    };

    // function to end trial when it is time
    var end_trial = function () {
      if (trial.doEyeTracking) {
        webgazer.showPredictionPoints(false);
        webgazer.pause(); // pause the webgazer before you save the data, this is optional
        clearInterval(eye_tracking_interval);
      } // clear the time interval before you save the data, so next time you use this trial, the timer will start from beginning.

      // kill any remaining setTimeout handlers
      jsPsych.pluginAPI.clearAllTimeouts();

      // kill keyboard listeners
      if (typeof keyboardListener !== "undefined") {
        jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
      }

      // gather the data to store for the trial
      var trial_data = {
        rt: response.rt,
        key_press: response.key,
        pL: trial.pL,
        mL: trial.mL,
        pR: trial.pR,
        mR: trial.mR,
        eyeData: JSON.stringify(eyeData),
        sequence: trial.sequence,
      };

      if (response.key == null && trial.showTimeoutWarning) {
        // Clear canvas
        ctx.clearRect(0, 0, gambleCanvas.width, gambleCanvas.height);
        // Draw "Too slow!" feedback
        ctx.font = "60px sans-serif";
        ctx.fillStyle = trial.timeoutWarningColor;
        ctx.textAlign = "center";
        ctx.fillText(
          trial.timeoutWarningText,
          gambleCanvas.width / 2,
          gambleCanvas.height / 2
        );
        jsPsych.pluginAPI.setTimeout(function () {
          // move on to the next trial
          // Remove the canvas as the child of the display_element element
          display_element.innerHTML = "";
          jsPsych.finishTrial(trial_data);
        }, trial.feedbackDuration);
      } else {
        // move on to the next trial
        // Remove the canvas as the child of the display_element element
        display_element.innerHTML = "";
        jsPsych.finishTrial(trial_data);
      }
    };

    // function to handle responses by the subject
    var after_response = function (info) {
      // only record the first response
      if (response.key == null) {
        response = info;
      }
      if (String.fromCharCode(response.key) == trial.choices[0]) {
        var xposFeedback = left_xpos;
      } else {
        if (String.fromCharCode(response.key) == trial.choices[1]) {
          var xposFeedback = right_xpos;
        }
      }
      // Feedback Frame
      ctx = gambleCanvas.getContext("2d");
      ctx.strokeStyle = trial.feedbackColor;
      ctx.lineWidth = 5;
      ctx.strokeRect(
        xposFeedback - boxWidthScale * radius,
        gambleCanvas.height * 0.2,
        2 * boxWidthScale * radius,
        gambleCanvas.height * 0.7
      );

      // Code before the pause
      // kill any remaining setTimeout handlers
      jsPsych.pluginAPI.clearAllTimeouts();
      setTimeout(function () {
        end_trial();
      }, trial.feedbackDuration);
    };

    // Trial procedure
    ctx = gambleCanvas.getContext("2d");

    // Set up positions
    var left_xpos = gambleCanvas.width * 0.25;
    var right_xpos = gambleCanvas.width * 0.75;
    if (leftItem == 0) {
      var xpos = [left_xpos, right_xpos];
    } else {
      var xpos = [right_xpos, left_xpos];
    }
    if (trial.topAttribute == "probability") {
      var probability_ypos = gambleCanvas.height * 0.75;
      var magnitude_ypos = gambleCanvas.height * 0.25;
    } else {
      var probability_ypos = gambleCanvas.height * 0.25;
      var magnitude_ypos = gambleCanvas.height * 0.75;
    }

    // Set up stimulus properties
    var radius = gambleCanvas.width / 15;
    var height = 2 * radius;
    var width = (radius * Math.PI) / 2; // This way, the area of the barplot and the pie chart are identical

    // Start eyetracking
    var eyeData = { history: [] };
    if (trial.doEyeTracking) {
      webgazer.resume();
      webgazer.showVideo(false);
      webgazer.showPredictionPoints(trial.showPredictionPoints);
      webgazer.showFaceOverlay(false);
      webgazer.showFaceFeedbackBox(false);
      var starttime = performance.now();
      var eye_tracking_interval = setInterval(function () {
        var pos = webgazer.getCurrentPrediction();
        if (pos) {
          var relativePosX = pos.x / screen.width;
          var relativePosY = pos.y / screen.height;
          eyeData.history.push({
            "relative-x": relativePosX,
            "relative-y": relativePosY,
            "elapse-time": performance.now() - starttime,
          });
        }
      }, 20);
    }

    // Draw stimuli
    var i;
    for (i = 0; i < trial.sequence.durations.length; i++) {
      // Draw
      drawStims(i);
      // Wait
      await new Promise((r) => setTimeout(r, trial.sequence.durations[i]));
      // Clear canvas
      ctx.clearRect(0, 0, gambleCanvas.width, gambleCanvas.height);
    }

    for (alt = 0; alt < 2; alt++) {
      ctx.strokeRect(
        xpos[alt] - boxWidthScale * radius,
        gambleCanvas.height * 0.2,
        2 * boxWidthScale * radius,
        gambleCanvas.height * 0.7
      );
    }

    // Draw choice prompt
    ctx.font = "60px sans-serif";
    ctx.fillStyle = trial.feedbackColor;
    ctx.textAlign = "center";
    ctx.fillText(
      trial.choicePrompt,
      gambleCanvas.width / 2,
      gambleCanvas.height / 2
    );

    // start the response listener
    if (trial.choices != jsPsych.NO_KEYS) {
      var keyboardListener = jsPsych.pluginAPI.getKeyboardResponse({
        callback_function: after_response,
        valid_responses: trial.choices,
        rt_method: "performance",
        persist: false,
        allow_held_key: false,
      });
    }

    // end trial if choiceTimeout is set
    if (trial.choiceTimeout !== null) {
      jsPsych.pluginAPI.setTimeout(function () {
        end_trial();
      }, trial.choiceTimeout);
    }
  };

  return plugin;
})();
