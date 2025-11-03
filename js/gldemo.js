
window.addEventListener('load', function() {

	/** @type {WebGL2RenderingContext} */
	var gl = null;

	function initWebGL(canvas) {
		var msg = "";
		try {
			gl = canvas.getContext("webgl2");
		} catch (e) {
			msg = "Error creating WebGL context: " + e.toString();
		}
		// če to ne deluje, je potrebno ustvariti context "webgl", torej brez 2

		if (!gl) {
			alert(msg);
			throw new Error(msg);
		}
	}
	var program;

	function initShaders() {
		// ustvari in prevedi senčilnike
		// nastavi konstantne uniform spremenljivke
		program = gl.createProgram();

		var vs = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vs, document.querySelector("#simple-vs").text);
		gl.compileShader(vs);
		gl.attachShader(program, vs);
		var shaderInfo = gl.getShaderInfoLog(vs);
		if (shaderInfo.length > 0) {
			alert("VShader Info: " + shaderInfo);
		}

		var fs = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fs, document.querySelector("#simple-fs").text);
		gl.compileShader(fs);
		gl.attachShader(program, fs);
		var shaderInfo = gl.getShaderInfoLog(fs);
		if (shaderInfo.length > 0) {
			alert("FShader Info: " + shaderInfo);
		}

		gl.linkProgram(program);
		//gl.bindAttribLocation(program, 0, "VertexPosition");// ne rabimo, že rešeno z layout location = 0 v kodi senčilnika

		var shaderInfo = gl.getProgramInfoLog(program);
		if (shaderInfo.length > 0) {
			alert("Program Info: " + shaderInfo);
		}
	}

	var bufferTrikotniki;
    var vaoTrikotniki;

	function constructGeometry() {
		// ustvari podatke za tla (koordinate oglišč, normale,
		// koordinate teksture)
		// lahko uporabiš constructSphere za generiranje krogle
		// ustvari bufferje na GPU in kopiraj podatke
		bufferTrikotniki = gl.createBuffer();
                vaoTrikotniki = gl.createVertexArray();
                gl.bindVertexArray(vaoTrikotniki);
		gl.bindBuffer(gl.ARRAY_BUFFER, bufferTrikotniki);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ 0, 0, 0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0 ]), gl.STATIC_DRAW);
                gl.enableVertexAttribArray(0);
                gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * 4, 0);
	}

	var posY = 0, posX = 0;
	function setupInteraction(canvas) {
		canvas.onkeydown = function keyDown(event) {
			switch (event.keyCode) {
			case 37:
				posY -= 10;
				break;
			case 39:
				posY += 10;
				break;
			case 38:
				posX -= 10;
				break;
			case 40:
				posX -= 10;
				break;
			default:
				// alert(event.keyCode);
			}
		};
		canvas.tabIndex = 1000;
		canvas.focus();

	}

	//var myCanvas = document.getElementById("myCanvas");
	/** @type {HTMLCanvasElement} */
	var myCanvas = document.querySelector("#myCanvas");
	initWebGL(myCanvas);

	initShaders();
	constructGeometry();
	setupInteraction(myCanvas);

	gl.clearColor(0.0, 0.2, 0.7, 1);

	var e = gl.getError();
	if (e) {
		alert("Init error: " + e);
	}

	setInterval(drawLoop, 33);

	function drawLoop() {

		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		// nastavi viewport
		//za naslednjo nalogo nastavi projekcijo in kamero in transformacije
		
		var PVM = glMatrix.mat4.identity(glMatrix.mat4.create());
		/*var proj_matrix = glMatrix.mat4.perspective(glMatrix.mat4.create(), glMatrix.glMatrix.toRadian(80), myCanvas.width / myCanvas.height, 0.1, 1000);

		var model_matrix=glMatrix.mat4.identity(glMatrix.mat4.create());

		model_matrix = glMatrix.mat4.translate(glMatrix.mat4.create(), model_matrix, glMatrix.vec3.fromValues(0, 0, -2));
		model_matrix = glMatrix.mat4.rotate(glMatrix.mat4.create(), model_matrix, glMatrix.glMatrix.toRadian(posY), glMatrix.vec3.fromValues(0, 1, 0));
		model_matrix = glMatrix.mat4.rotate(glMatrix.mat4.create(), model_matrix, glMatrix.glMatrix.toRadian(posX), glMatrix.vec3.fromValues(1, 0, 0));

		var view_matrix = glMatrix.mat4.identity(glMatrix.mat4.create());
		view_matrix = glMatrix.mat4.translate(glMatrix.mat4.create(), view_matrix, glMatrix.vec3.fromValues(0, 0, -2));

		var PVM = glMatrix.mat4.multiply(glMatrix.mat4.create(), proj_matrix, glMatrix.mat4.multiply(glMatrix.mat4.create(), view_matrix, model_matrix));

		PVM = glMatrix.mat4.rotate(glMatrix.mat4.create(), PVM, glMatrix.glMatrix.toRadian(posY), glMatrix.vec3.fromValues(0, 1, 0));
		PVM = glMatrix.mat4.rotate(glMatrix.mat4.create(), PVM, glMatrix.glMatrix.toRadian(posX), glMatrix.vec3.fromValues(1, 0, 0));
		*/

		
		gl.useProgram(program);
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "PVM"), false, PVM);

		gl.bindVertexArray(vaoTrikotniki);
		gl.drawArrays(gl.TRIANGLES, 0, 3);

		var e = gl.getError();
		if (e) {
			alert("Draw error: " + e);
		}
	}

});
