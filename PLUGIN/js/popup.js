const DEBUG = !!+localStorage.debug;

if (DEBUG && location.pathname !== "/views/popup-debug.xhtml") {
    location.replace("/views/popup-debug.xhtml");
}

(function(document) {
    "use strict";


    var showRecording = function() {
        document.getElementById("voice-search").src = "../images/icon_anim_128.gif";
    }
    var hideRecording = function() {
        document.getElementById("voice-search").src = "../images/icon_64.png";
    }
    var openRequestPermissionTab = function() {
		chrome.tabs.create({
			url: chrome.extension.getURL("../views/permission.html#ask"),
			selected: true
		});
    }
   	var checkPermission = function(callback) {
   		navigator.webkitGetUserMedia({
			audio: true,
		}, function(stream) {
			console.log("permission granted");
			callback(true);
		}, function() {
			console.log("permission denied");
			callback(false);
		});
   	}

    var
        recognition,
        opts = localStorage,
        $ = function(id) {
            return document.getElementById(id);
        },
        open_search_query = function(raw_query, name, template_uri, query) {
            chrome.tabs.create({
                url: template_uri.replace(/%s/g, encodeURIComponent(query)),
                selected: true
            });
            close();
        },
        voice_search_input = $("voice-search"),
        search_engine_select = $("search-engines"),
        speech_change_event = ("onspeechchange" in document.createElement("input") ? "" : "webkit") + "speechchange",
        search_engines = JSON.parse(opts.search_engines),
        search_engine_regexs = [],
        punctuation = /[,"'?!;:#$%&()*+\/<>=@\[\]\\\^_{}\|~.\-]+/g,
        whitespace = /\s+/g,
        mid_word_capitalization = /([a-z])([A-Z])/g,
        search_engine_regex, i = 0,
        len = search_engines.length,
        close_on_blur = true,
        on_view_blur = function() {
            if (close_on_blur) {
                // close();
            }
        },
        on_mouse_down = function() {
            close_on_blur = false;

			var onresponse = function(response) {
                if(recognition.cancelled) {
                    console.log("Recognition cancelled");
                    return;
                }

				if(response.result === "success" && response.text != null) {
					var fixedResponse = response.text
						.replace("Dougal", "Google")
						.replace("dougal", "google");

					console.log(fixedResponse);

					on_speech_change({text: fixedResponse, confidence: response.confidence});
                    _gaq.push(['_trackEvent', 'response', 'succeeded']);
				}
				else {
					console.log("Error");
					console.log(response);
                    _gaq.push(['_trackEvent', 'response', 'errored']);
				}
			}

            var onstatechange = function(state) {
                if(state == 2) {
                    showRecording();
                }
                else if(state == 0) {
                    hideRecording();
                }
            }

            if(!recognition) {
                recognition = new iSpeechRecognizer({
                    apiKey: "d59f54e5da7ba8f1fa52661475488e50",
                    silenceDetection: true,
                    workerLoc: "../lib/iSpeechWorker.min.js",
                    onResponse: onresponse,
                });    
            }

            if(recognition.state === 0) {
                recognition.onStateChange = onstatechange

    			checkPermission(function(permission) {
    				if(!permission) {
    					openRequestPermissionTab();
    					return;
    				}

    				showRecording();
                	recognition.start();
                    recognition.cancelled = false;
    			});

                _gaq.push(['_trackEvent', 'recording', 'started']);
            }
            else {
                recognition.stop();
                recognition.cancelled = true;

                _gaq.push(['_trackEvent', 'recording', 'cancelled']);
            }
        },
        on_speech_change = function(event) {
            var
                query = event.text,
                selected = search_engine_select.selectedIndex;
			if(query=="new tab"||query=="new")
				window.open();
            if (!selected) {
                // attempt to discern a dictation to use a specific search engine
                var
                    specific_search_engine_query, i = search_engines.length
                    // longest matching search engine detected
                    // for cases like 'google: videos foobar' vs 'google videos: foobar'
                    ,
                    best_match = { matched: false };
                while (i--) {
                    specific_search_engine_query = query.match(search_engine_regexs[i]);
                    if (specific_search_engine_query !== null) {
                        if (!best_match.matched ||
                            best_match.name.length < search_engines[i].name.length
                        ) {
                            best_match.matched = true;
                            best_match.name = search_engines[i].name;
                            best_match.uri = search_engines[i].uri;
                            best_match.query = specific_search_engine_query[2];
                        }
                    }
                }
                if (!best_match.matched) {
                    // use default search engine if no match
                    best_match = search_engines[0];
                    best_match.query = query;
                }
                open_search_query(query, best_match.name, best_match.uri, best_match.query);
            } else {
                open_search_query(
                    query, search_engine_select.children.item(selected).firstChild.data, search_engine_select.value, query
                );
            }
        };

    $("search-engines").addEventListener("mousedown", function() {
        _gaq.push(['_trackEvent', 'searchEngineMenu', 'clicked']);
    });

    for (; i < len; i++) {
        // make regexps for matching commands dictated for a certain search engine
        search_engine_regex = "^(" +
            search_engines[i].name
            // punctuation optional
            .replace(punctuation, "\\W*")
            // whitespace optional
            .replace(whitespace, "\\s*")
            // allow possible spaces from capitalization (e.g. YouTube ~ You Tube)
            .replace(mid_word_capitalization, "$1\\s*$2") +
            ")\\s+([\\s\\S]+)$" // query capture group
        ;
        search_engine_regexs.push(new RegExp(search_engine_regex, "i"));
    }
    search_engine_select.children.item(0).value = search_engines[0].uri;
    for (i = 0, len = search_engines.length; i < len; i++) {
        if (search_engines[i].in_popup !== false) {
            search_engine_select.appendChild(new Option(
                search_engines[i].name, search_engines[i].uri
            ));
        }
    }
    if (DEBUG) {
        var
            form = $("debug"),
            test_query_btn = $("test-query"),
            debug_engine_name = $("debug-engine-name").appendChild(document.createTextNode("")),
            debug_query = $("debug-query").appendChild(document.createTextNode("")),
            debug_URI = $("debug-uri").appendChild(document.createTextNode(""));
        open_search_query = function(raw_query, name, template_uri, query) {
            debug_engine_name.data = name;
            debug_query.data = query;
            debug_URI.data = template_uri.replace(/%s/g, encodeURIComponent(query));
        };
        form.addEventListener("submit", function(event) {
            event.preventDefault();
        });
        test_query_btn.addEventListener("DOMActivate", function() {
            on_speech_change({ target: voice_search_input });
        });
    } else {
        voice_search_input.addEventListener("mousedown", on_mouse_down);
        on_mouse_down();
        self.addEventListener("blur", on_view_blur);
    }
}(document));
