/*
 * a plugin for binary choices - two attributes
 * type for params: BOOL, STRING, INT, FLOAT, FUNCTION, KEYCODE, SELECT, HTML_STRING, IMAGE, AUDIO, VIDEO, OBJECT, COMPLEX
 */

jsPsych.plugins["binary-choice"] = (function () {
  var plugin = {};

  plugin.info = {
    name: "binary-choice",
    parameters: {
      stimulus: {
        type: jsPsych.plugins.parameterType.HTML_STRING,
        pretty_name: "stimulus",
        default: undefined,
        description: "Array of stimulus images",
      },
      choices: {
        type: jsPsych.plugins.parameterType.KEYCODE,
        array: true,
        pretty_name: "choices",
        default: ["F", "J"],
        description:
          "The keys the subject is allowed to press to respond to the stimulus.",
      },
      choiceTimeout: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: "choiceTimeout",
        default: -1,
        description: "choiceTimeout.",
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
    },
  };

  /**
   * trial method is responsible for running a single trial.
   * parameters:
   * display_element: DOM element where jsPsych content is being generated --> HTML element
   * this parameter can change th content of the display: display_element.innerHTML = html_content;
   * trial: an object containing all the parameters specified in the correspnding TimelineNode. Need to call jsPsych.finishTrial() when it is done.
   */

  plugin.trial = function (display_element, trial) {
    // set default values for the parameters
    trial.choices = trial.choices || [];
    trial.choiceTimeout = trial.choiceTimeout || -1;
    var selected_color = "Gold";
    var setTimeoutHandlers = [];
    var keyboardListener;

    var response = {
      rt: -1,
      key: -1,
    };

    // display stimuli
    var display_stage = function () {
      //console.log('display_stage');

      kill_timers();
      kill_listeners();

      display_element.innerHTML = "";
      var new_html = "";

      new_html += '<div class="container-multi-choice">';
      new_html +=
        '<div class="container-multi-choice-column" id= "multiattribute-choices-stimulus-left">';
      new_html += `<div id="multiattribute-choices-stimulus-left " ><img src="${trial.stimulus[0]}"/></div>`;
      new_html += "</div>";
      new_html +=
        '<div class="container-multi-choice-column" id= "multiattribute-choices-stimulus-right">';
      new_html += `<div id="multiattribute-choices-stimulus-right " ><img src="${trial.stimulus[1]}"/></div>`;
      new_html += "</div>";
      new_html += '<div id="binary-timeoutinfo"></div>';
      new_html += "</div>";
      display_element.innerHTML = new_html;
    };

    var display_selection = function () {
      var selected;
      if (String.fromCharCode(response.key) == trial.choices[0]) {
        selected = "#multiattribute-choices-stimulus-left";
      } else {
        selected = "#multiattribute-choices-stimulus-right";
      }
      $(selected).css("border", `6px solid ${selected_color}`);
    };

    var display_timeout = function () {
      $("binary-timeoutinfo").text("Time out!");
    };

    var kill_timers = function () {
      for (var i = 0; i < setTimeoutHandlers.length; i++) {
        clearTimeout(setTimeoutHandlers[i]);
      }
    };

    var kill_listeners = function () {
      if (typeof keyboardListener !== "undefined") {
        jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
      }
    };

    var start_response_listener = function () {
      if (trial.choices != jsPsych.NO_KEYS) {
        keyboardListener = jsPsych.pluginAPI.getKeyboardResponse({
          valid_responses: trial.choices,
          rt_method: "performance",
          persist: false,
          allow_held_key: false,
          callback_function: function (info) {
            kill_listeners();
            kill_timers();
            response = info;
            display_selection();
            setTimeout(() => end_trial(false), 500);
          },
        });
      }
    };

    var display_stimuli = function () {
      kill_timers();
      kill_listeners();
      display_stage();
      start_response_listener();

      if (trial.choiceTimeout > 0) {
        var response_timer = setTimeout(function () {
          kill_listeners();
          display_timeout();
          setTimeout(() => end_trial(true), 500);
        }, trial.choiceTimeout);
        setTimeoutHandlers.push(response_timer);
      }
    };

    var end_trial = function (timeout) {
      if (trial.doEyeTracking) {
        webgazer.showPredictionPoints(false);
        webgazer.pause();
        clearInterval(eye_tracking_interval);
      }
      // data saving
      var trial_data = {
        stimulus: trial.stimulus,
        left_stimulus: trial.stimulus[0],
        right_stimulus: trial.stimulus[1],
        probability: trial.Probabilty,
        rt: response.rt,
        key_press: response.key,
        choices: trial.choices,
        eyeData: JSON.stringify(eyeData),
      };
      jsPsych.finishTrial(trial_data);
    };

    var eyeData = { history: [] };
    display_stimuli();
    if (trial.doEyeTracking) {
      webgazer.resume();
      webgazer.showPredictionPoints(trial.showPredictionPoints);
      webgazer.showVideo(false);
      webgazer.showFaceOverlay(false);
      webgazer.showFaceFeedbackBox(false);
      var starttime = performance.now();
      var eye_tracking_interval = setInterval(function () {
        var pos = webgazer.getCurrentPrediction();
        if (pos) {
          var relativePosX = pos.x / screen.width;
          var relativePosY = pos.y / screen.height;
          var relativePosX2 = pos.x / innerWidth;
          var relativePosY2 = pos.y / innerHeight;
          eyeData.history.push({
            "relative-x": relativePosX,
            "relative-y": relativePosY,
            "relative-x2": relativePosX2,
            "relative-y2": relativePosY2,
            "elapse-time": performance.now() - starttime,
          });
        }
      }, 20);
    }
  };

  return plugin;
})();
