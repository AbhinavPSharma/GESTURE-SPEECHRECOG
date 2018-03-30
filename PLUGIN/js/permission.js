(function(document) {
	"use strict";
	
	var constraints = { audio: true, video: false };
    
	navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
		console.log("permission granted");
		window.close();
	}).catch(function(err) {
		console.log("permission denied");
	});

	console.log("Requested permission");
})(document);