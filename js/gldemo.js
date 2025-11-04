let cubePositions = [
    [-0.4, -0.4, 0], [0, -0.4, 0], [0.4, -0.4, 0],
    [-0.2, 0, 0], [0.2, 0, 0], 
    [0, 0.4, 0]  
];

let cubeColors = [
    [1, 0, 0],  
    [0, 1, 0],   
    [0, 0, 1],   
    [1, 1, 0],  
    [1, 0, 1],  
    [0, 1, 1]
];

let t = 0;

let cameraDistance = 3;
let isLeftMB = false;
let isRightMB = false;	
let lastMouseX = 0;
let lastMouseY = 0;
let cameraPos = [0, 0, 0]; // začetna pozicija kamere
let cameraRotation = [0, 0, 0]; 
let pyramidScale = [1.0, 1.0, 1.0];   // skaliranje
let pyramidShearMatrix = glMatrix.mat4.create();
let pyramidRotation = [0, 0, 0];      
let pyramidPosition = [0, 0, 0];
let orthoPerspective = false;
let shearTheta = 90;
let shearPhi = 90;
let shearType = "XY";

function shearMatrix(type, thetaDeg, phiDeg) {
    let theta = glMatrix.glMatrix.toRadian(thetaDeg);
    let phi = glMatrix.glMatrix.toRadian(phiDeg);

    let ctgTheta = 1 / Math.tan(theta);
    let ctgPhi = 1 / Math.tan(phi);

    let shearMat = glMatrix.mat4.create();

    switch(type) {
        case "XY":
            shearMat[8] = ctgTheta; 
            shearMat[9] = ctgPhi;  
            break;
        case "XZ":
            shearMat[4] = ctgPhi;  
            shearMat[8] = ctgTheta;
            break;
        case "YZ":
            shearMat[1] = ctgTheta; 
            shearMat[2] = ctgPhi;
            break;
    }

    return shearMat;
}

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

	function setupMouseControls(canvas) {
		canvas.addEventListener('mousedown', (e) => {
			if (e.button === 0) isLeftMB = true;  // 0 = left button, 1 = middle button, 2 = right button
			if (e.button === 2) isRightMB = true;
			lastMouseX = e.clientX;
			lastMouseY = e.clientY;
		});

		canvas.addEventListener('contextmenu', e => e.preventDefault()); // Disablamo desni klik meni

		canvas.addEventListener('mouseup', (e) => {
			if (e.button === 0) isLeftMB = false;
			if (e.button === 2) isRightMB = false;
		});

		canvas.addEventListener('mousemove', (e) => {
			let dx = e.clientX - lastMouseX;
			let dy = e.clientY - lastMouseY;

			if (isLeftMB) {
				cameraPos[0] -= dx * 0.01;  // levo-desno
				cameraPos[1] += dy * 0.01;  // gor-dol
			}
			
			if (isRightMB) {
				cameraRotation[0] += dx * 0.5;
				cameraRotation[1] += dy * 0.5;
				if (cameraRotation[1] > 89.0) cameraRotation[1] = 89.0;
				if (cameraRotation[1] < -89.0) cameraRotation[1] = -89.0;
			}

			lastMouseX = e.clientX;
			lastMouseY = e.clientY;
		});

		canvas.addEventListener('wheel', (e) => { 
			let forward_vector = getCameraDirection();
			cameraPos[0] += -forward_vector[0] * e.deltaY * 0.001;
			cameraPos[1] += -forward_vector[1] * e.deltaY * 0.001;
			cameraPos[2] += -forward_vector[2] * e.deltaY * 0.001;
			if (cameraDistance < 0.5) cameraDistance = 0.5; 
		});
	}

	window.addEventListener('keydown', (e)=>{
        switch(e.key){
            case 'ArrowUp': pyramidPosition[1]+=0.1; break;
            case 'ArrowDown': pyramidPosition[1]-=0.1; break;
            case 'ArrowLeft': pyramidPosition[0]-=0.1; break;
            case 'ArrowRight': pyramidPosition[0]+=0.1; break;
			case '-': pyramidPosition[2]+=0.1; break;
			case '.': pyramidPosition[2]-=0.1; break;
			
            case 'q': pyramidRotation[1]-=5; break;
            case 'e': pyramidRotation[1]+=5; break;
			case 'r': pyramidRotation[0]-=5; break;
			case 't': pyramidRotation[0]+=5; break;
			case 'z': pyramidRotation[2]-=5; break;
			case 'u': pyramidRotation[2]+=5; break;

            case 'w': pyramidScale[1]+=0.1; break;
            case 's': pyramidScale[1]-=0.1; break;
			case 'd': pyramidScale[0]+=0.1; break;
			case 'a': pyramidScale[0]-=0.1; break;
			case 'f': pyramidScale[2]+=0.1; break;
			case 'g': pyramidScale[2]-=0.1; break;
			case 'h': 
				for (let i = 0; i < pyramidScale.length; i++)
					pyramidScale[i] += 0.1;
				break;
			case 'j': 
				for (let i = 0; i < pyramidScale.length; i++)
					pyramidScale[i] -= 0.1;
				break;

			case 'y': 
				shearTheta -= 5;
				pyramidShearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
				break;
			case 'x':
				shearTheta += 5;
				pyramidShearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
				break;
			case 'c': 
				shearPhi -= 5;
				pyramidShearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
				break;	
			case 'v': 
				shearPhi += 5;
				pyramidShearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
				break;
			case 'b': 
				shearType = "XZ"; 
				pyramidShearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
				break;
			case 'n': 
				shearType = "YZ"; 
				pyramidShearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
				break;
			case 'm': 
				shearType = "XY"; 
				pyramidShearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
				break;

			
			case 'Escape': 
				pyramidScale = [1.0, 1.0, 1.0];
				pyramidShear = [0.0, 0.0, 0.0];
				pyramidRotation = [0, 0, 0];      
				pyramidPosition = [0, 0, 0];
				resetSliders();
				break;

			case 'p': orthoPerspective = !orthoPerspective; break;
        }
    });

	/*
	var bufferTrikotniki;
    var vaoTrikotniki;
	*/
	let bufferCube;
	let vaoCube;

	function constructGeometry() {
		// ustvari podatke za tla (koordinate oglišč, normale,
		// koordinate teksture)
		// lahko uporabiš constructSphere za generiranje krogle
		// ustvari bufferje na GPU in kopiraj podatke
		/*
		bufferTrikotniki = gl.createBuffer();
                vaoTrikotniki = gl.createVertexArray();
                gl.bindVertexArray(vaoTrikotniki);
		gl.bindBuffer(gl.ARRAY_BUFFER, bufferTrikotniki);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ 0, 0, 0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0 ]), gl.STATIC_DRAW);
                gl.enableVertexAttribArray(0);
                gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * 4, 0);
		*/

		let cubeVertices = [
			// spredaj (2 trikotnika na lice kocke)
			-0.5, -0.5, 0.5,	
			0.5, -0.5, 0.5,
			0.5, 0.5, 0.5,
			-0.5, -0.5, 0.5,
			0.5, 0.5, 0.5,
			-0.5, 0.5, 0.5,

			// zadaj
			-0.5, -0.5, -0.5,
			-0.5, 0.5, -0.5,
			0.5, 0.5, -0.5,
			-0.5, -0.5, -0.5,
			0.5, 0.5, -0.5,
			0.5, -0.5, -0.5,

			// levo
			-0.5, -0.5, -0.5,
			-0.5, -0.5, 0.5,
			-0.5, 0.5, 0.5,
			-0.5, -0.5, -0.5,
			-0.5, 0.5, 0.5,
			-0.5, 0.5, -0.5,

			// desno
			0.5, -0.5, -0.5,
			0.5, 0.5, -0.5,
			0.5, 0.5, 0.5,
			0.5, -0.5, -0.5,
			0.5, 0.5, 0.5,
			0.5, -0.5, 0.5,

			// zgoraj
			-0.5, 0.5, -0.5,
			-0.5, 0.5, 0.5,
			0.5, 0.5, 0.5,
			-0.5, 0.5, -0.5,
			0.5, 0.5, 0.5,
			0.5, 0.5, -0.5,

			// spodaj
			-0.5, -0.5, -0.5,
			0.5, -0.5, -0.5,
			0.5, -0.5, 0.5,
			-0.5, -0.5, -0.5,
			0.5, -0.5, 0.5,
			-0.5, -0.5, 0.5
		];

		let scaledCubeVertices = cubeVertices.slice();
		let scale = 0.4;
		for (let i = 0; i < scaledCubeVertices.length; i++) {
			scaledCubeVertices[i] *= scale;
		}

		// Naložim base kocko v buffer na GPU, ki ga v drawLoop uporabim za risanje kock in tal
		bufferCube = gl.createBuffer();
		vaoCube = gl.createVertexArray();
		gl.bindVertexArray(vaoCube);
		gl.bindBuffer(gl.ARRAY_BUFFER, bufferCube);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(scaledCubeVertices), gl.STATIC_DRAW);
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
	setupMouseControls(myCanvas);
	setupSliders();

	gl.clearColor(0.0, 0.2, 0.7, 1);

	var e = gl.getError();
	if (e) {
		alert("Init error: " + e);
	}

	setInterval(drawLoop, 20);

	function drawLoop() {
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.enable(gl.DEPTH_TEST);
		let proj_matrix;

		// P 
		if (!orthoPerspective) {
			proj_matrix = glMatrix.mat4.perspective(glMatrix.mat4.create(), glMatrix.glMatrix.toRadian(80), myCanvas.width / myCanvas.height, 0.1, 1000);
		} else {
			let aspect = myCanvas.width / myCanvas.height;
    		let size = 2;
			// ortho: left = -size * aspect, right = size * aspect, bottom = -size, top = size, near = 0.1, far = 1000
			proj_matrix = glMatrix.mat4.ortho(glMatrix.mat4.create(), -size * aspect, size * aspect, -size, size, 0.1, 1000);
		}
		
		// V 
		let view_matrix = glMatrix.mat4.identity(glMatrix.mat4.create());
		glMatrix.mat4.rotateX(view_matrix, view_matrix, glMatrix.glMatrix.toRadian(cameraRotation[1]));
		glMatrix.mat4.rotateY(view_matrix, view_matrix, glMatrix.glMatrix.toRadian(cameraRotation[0]));
		glMatrix.mat4.translate(view_matrix, view_matrix, glMatrix.vec3.fromValues(-cameraPos[0], -cameraPos[1], -cameraPos[2] - cameraDistance));

		gl.useProgram(program);
		let colorLoc = gl.getUniformLocation(program, "CubeColor");

		// M za tla
		let M_floor = glMatrix.mat4.create();
		glMatrix.mat4.scale(M_floor, M_floor, glMatrix.vec3.fromValues(10, 0.1, 10)); // Skaliramo base kocko da postane tla
		glMatrix.mat4.translate(M_floor, M_floor, glMatrix.vec3.fromValues(0, -6, 0)); // Tla pomaknemo malo nižje

		let PVM_floor = glMatrix.mat4.create(); // Izračunamo PVM matriko za tla
		glMatrix.mat4.multiply(PVM_floor, view_matrix, M_floor);       // V * M
		glMatrix.mat4.multiply(PVM_floor, proj_matrix, PVM_floor);     // P * V * M

		// Tla 
		gl.bindVertexArray(vaoCube);
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "PVM"), false, PVM_floor);
		gl.uniform3fv(colorLoc, new Float32Array([0, 0, 0]));
		gl.drawArrays(gl.TRIANGLES, 0, 36);

		// Piramida
		let M_pyramid = glMatrix.mat4.create();
        glMatrix.mat4.translate(M_pyramid, M_pyramid, glMatrix.vec3.fromValues(...pyramidPosition));  // Premik piramide
        glMatrix.mat4.rotateX(M_pyramid, M_pyramid, glMatrix.glMatrix.toRadian(pyramidRotation[0]));  // Rotacije piramide
        glMatrix.mat4.rotateY(M_pyramid, M_pyramid, glMatrix.glMatrix.toRadian(pyramidRotation[1]));
        glMatrix.mat4.rotateZ(M_pyramid, M_pyramid, glMatrix.glMatrix.toRadian(pyramidRotation[2]));
        glMatrix.mat4.multiply(M_pyramid, M_pyramid, pyramidShearMatrix);  // Shear piramide
        glMatrix.mat4.scale(M_pyramid, M_pyramid, glMatrix.vec3.fromValues(...pyramidScale)); // Skaliranje piramide

        // Draw pyramid
        for(let i = 0; i < cubePositions.length; i++){
            let pos = cubePositions[i]; let color = cubeColors[i];
            let Mk = glMatrix.mat4.create();
            glMatrix.mat4.translate(Mk, Mk, glMatrix.vec3.fromValues(pos[0], pos[1], pos[2]));

            let PVM_cube = glMatrix.mat4.create();
            glMatrix.mat4.multiply(PVM_cube, view_matrix, M_pyramid);
            glMatrix.mat4.multiply(PVM_cube, PVM_cube, Mk);
            glMatrix.mat4.multiply(PVM_cube, proj_matrix, PVM_cube);

            gl.uniformMatrix4fv(gl.getUniformLocation(program,"PVM"), false, PVM_cube);
            gl.uniform3fv(colorLoc, new Float32Array(color));
            gl.drawArrays(gl.TRIANGLES, 0, 36);
        }

		// Spreminjanje barv iz prejšnje naloge
		t += 0.1;
		for (let i = 0; i < cubeColors.length; i++) {
			cubeColors[i][0] = 0.75 + 0.5 * Math.sin(t * 1 + i * 3);
			cubeColors[i][1] = 0.75 + 0.5 * Math.sin(t * 0.5 + i * 5);
			cubeColors[i][2] = 0.75 + 0.5 * Math.sin(t * 1.5 + i * 7);
		}

		let e = gl.getError();
			if (e) alert("Draw error: " + e);
	}

	function getCameraDirection() {
		let pitch = glMatrix.glMatrix.toRadian(cameraRotation[1]);
		let yaw = glMatrix.glMatrix.toRadian(cameraRotation[0]);

		let x = Math.cos(pitch) * Math.sin(yaw);
		let y = Math.sin(pitch);
		let z = Math.cos(pitch) * Math.cos(yaw);

		return [x, y, -z];
	}

	function setupSliders() {
		const sliderData = [
			["scaleX", pyramidScale, 0],
			["scaleY", pyramidScale, 1],
			["scaleZ", pyramidScale, 2],
			["rotX", pyramidRotation, 0],
			["rotY", pyramidRotation, 1],
			["rotZ", pyramidRotation, 2],
			["posX", pyramidPosition, 0],
			["posY", pyramidPosition, 1],
			["posZ", pyramidPosition, 2]
		];

		let button = document.getElementById("toggleProjection");
		button.addEventListener("click", () => {
			orthoPerspective = !orthoPerspective;
			button.textContent = orthoPerspective ? "Orthographic" : "Perspective";
			console.log("Projection mode toggled:", orthoPerspective ? "Orthographic" : "Perspective");
		});

		sliderData.forEach(([id, arr, index]) => {
			let slider = document.getElementById(id);
			let display = document.getElementById(id + "Val");
			slider.addEventListener("input", () => {
				arr[index] = parseFloat(slider.value);
				display.textContent = slider.value;
			});
		});

		let thetaSlider = document.getElementById("shearTheta");
		let phiSlider = document.getElementById("shearPhi");
		let thetaDisplay = document.getElementById("shearThetaVal");
		let phiDisplay = document.getElementById("shearPhiVal");
		let shearTypeSelect = document.getElementById("shearType");

		function updateShear() {
			let theta = parseFloat(thetaSlider.value);
			let phi = parseFloat(phiSlider.value);
			let type = shearTypeSelect.value;

			thetaDisplay.textContent = theta.toFixed(1);
			phiDisplay.textContent = phi.toFixed(1);

			pyramidShearMatrix = shearMatrix(type, theta, phi);
		}

		thetaSlider.addEventListener("input", updateShear);
		phiSlider.addEventListener("input", updateShear);
		shearTypeSelect.addEventListener("change", updateShear);
	}


	function resetSliders() {
		const defaultValues = {
			"scaleX": 1.0, "scaleY": 1.0, "scaleZ": 1.0,
			"rotX": 0, "rotY": 0, "rotZ": 0,
			"posX": 0, "posY": 0, "posZ": 0,
			"shearThetaInput": 0.0,
			"shearPhiInput": 0.0
		};
		Object.keys(defaultValues).forEach(key => {
			const slider = document.getElementById(key);
			const display = document.getElementById(key + "Val");
			slider.value = defaultValues[key];
			display.textContent = defaultValues[key];
		});
	}

});
