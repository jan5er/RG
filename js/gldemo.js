let t = 0;

let CubeColor = [1, 0, 1];

let cameraDistance = 3;
let isLeftMB = false;
let isRightMB = false;	
let lastMouseX = 0;
let lastMouseY = 0;
let cameraPos = [0, 0, 0]; // začetna pozicija kamere
let cameraRotation = [0, 0, 0]; 
let orthoPerspective = false;
let shearTheta = 90;
let shearPhi = 90;
let shearType = "XY";
let shearAnimation = false;

let uploadedObjects = [];
let objects = [];
let selectedObjectIndex = -1;

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

	let upload = document.getElementById('uploadFile');
	upload.addEventListener('change', (e) => {
		let files = e.target.files;
		for (let file of files) {
			let reader = new FileReader();
			reader.onload = (ev) => {
				let objectData = parseObject(ev.target.result);
				uploadedObjects.push({
					name: file.name,
					objectData: objectData
				});
			};
			reader.readAsText(file);
		}
	})

	let insertButton = document.getElementById("insertObject");
	insertButton.addEventListener("click", () => {
		let select = document.getElementById("objectSelect");
		
		for (let item of uploadedObjects) {
			let gpuObj = uploadObject(item.objectData);

			objects.push({
				name: item.name,
				vao: gpuObj.vao,
				vertexCount: gpuObj.vertexCount,
				position: [0,0,0],
				rotation: [0,0,0],
				scale: [1,1,1],
				shearMatrix: glMatrix.mat4.create(),
				colorMode: "normal"
			});

			console.log("Inserted object:", item.name);
			let option = document.createElement("option");
			option.value = objects.length - 1; // index v arrayu
			option.textContent = item.name;
			select.appendChild(option);

			selectedObjectIndex = objects.length - 1;
			select.value = selectedObjectIndex;
			updateSlidersForSelectedObject();
		}

		uploadedObjects = [];
	});

	let objectSelect = document.getElementById("objectSelect");
	objectSelect.addEventListener("change", () => {
		selectedObjectIndex = parseInt(objectSelect.value);
		console.log("Selected object changed to:", objects[selectedObjectIndex].name);
		updateSlidersForSelectedObject();
	});

	let toggleShearAnimationButton = this.document.getElementById("toggleShearAnimation");
	toggleShearAnimationButton.addEventListener("click", () => {
		shearAnimation = !shearAnimation;
	});

	document.getElementById("colorMode").addEventListener("change", (e) => {
		if (selectedObjectIndex < 0) return;
		objects[selectedObjectIndex].colorMode = e.target.value;
	});


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
				if (cameraRotation[1] > 89.0) cameraRotation[1] = 89.0; // omejimo kote gledanja da se ne izguimo
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
		if(e.key === 'Tab'){
			selectedObjectIndex = (selectedObjectIndex + 1) % objects.length;
			e.preventDefault();
			let objectDropdown = document.getElementById("objectSelect");
			objectDropdown.selectedIndex = selectedObjectIndex;
			updateSlidersForSelectedObject();
		}
	});

	window.addEventListener('keydown', (e)=>{
		if (selectedObjectIndex < 0) return;
		selectedObject = objects[selectedObjectIndex];
		
        switch(e.key){
            case 'ArrowUp': selectedObject.position[1]+=0.1; break;
            case 'ArrowDown': selectedObject.position[1]-=0.1; break;
            case 'ArrowLeft': selectedObject.position[0]-=0.1; break;
            case 'ArrowRight': selectedObject.position[0]+=0.1; break;
			case '-': selectedObject.position[2]+=0.1; break;
			case '.': selectedObject.position[2]-=0.1; break;
			
            case 'q': selectedObject.rotation[1]-=5; break;
            case 'e': selectedObject.rotation[1]+=5; break;
			case 'r': selectedObject.rotation[0]-=5; break;
			case 't': selectedObject.rotation[0]+=5; break;
			case 'z': selectedObject.rotation[2]-=5; break;
			case 'u': selectedObject.rotation[2]+=5; break;

            case 'w': selectedObject.scale[1]+=0.1; break;
            case 's': selectedObject.scale[1]-=0.1; break;
			case 'd': selectedObject.scale[0]+=0.1; break;
			case 'a': selectedObject.scale[0]-=0.1; break;
			case 'f': selectedObject.scale[2]+=0.1; break;
			case 'g': selectedObject.scale[2]-=0.1; break;
			case 'h': 
				for (let i = 0; i < selectedObject.scale.length; i++)
					selectedObject.scale[i] += 0.1;
				break;
			case 'j': 
				for (let i = 0; i < selectedObject.scale.length; i++)
					selectedObject.scale[i] -= 0.1;
				break;

			case 'y': 
				shearTheta -= 5;
				selectedObject.shearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
				break;
			case 'x':
				shearTheta += 5;
				selectedObject.shearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
				break;
			case 'c': 
				shearPhi -= 5;
				selectedObject.shearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
				break;	
			case 'v': 
				shearPhi += 5;
				selectedObject.shearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
				break;
			case 'b': 
				shearType = "XZ"; 
				selectedObject.shearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
				break;
			case 'n': 
				shearType = "YZ"; 
				selectedObject.shearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
				break;
			case 'm': 
				shearType = "XY"; 
				selectedObject.shearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
				break;

			
			case 'Escape': 
				selectedObject.scale = [1.0, 1.0, 1.0];
				selectedObject.shearMatrix = [0.0, 0.0, 0.0];
				selectedObject.rotation = [0, 0, 0];      
				selectedObject.position = [0, 0, 0];
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

	function parseObject(objectData) {
		let positions = [[0, 0, 0]];
		let normals = [[0, 0, 0]];
		let texture_uvs = [[0, 0]];
		let vertices = [];
		let indices = [];

		/*
		# www.blender.org: ignoriramo komentarje
		v 2.688762 0.000000 0.000000	: vertex točke - določa pozicijo (x,y,z)
		vt 0.719652 0.186670			: vertex texture - določa teksturo (u, v)
		vn 0.861200 0.495400 -0.113400	: vertex normal - normala vektorja 
		s 1								: smoothing - glajenje 
		f 13/1/1 14/2/2 2/3/3			: face - lica/ploskve objekta (i[v]/i[vt]/i[vn])
		*/
		let map = {};

		let dataLine = objectData.split('\n');
		for (let line of dataLine) {
			line = line.trim();
			if (line.startsWith('#')) continue;
			if (!line) continue;
			let parsed_line = line.split(/\s+/); // "v 1.0 2.0 3.0" -> ["v","1.0","2.0","3.0"]

			switch(parsed_line[0]) {
				case 'v': 
					positions.push(parsed_line.slice(1).map(parseFloat));
					break;
				case 'vt':
					texture_uvs.push(parsed_line.slice(1).map(parseFloat));
					break;
				case 'vn':
					normals.push(parsed_line.slice(1).map(parseFloat));
					break;
				case 's':
					break;
				case 'f':
					let face = parsed_line.slice(1);  // 13/1/1 14/2/2 2/3/3
					for (let faceVertex of face) {
						let [i_v, i_vt, i_vn] = faceVertex.split('/').map(x => x ? parseInt(x) : 0);
						let key = `${i_v}/${i_vt}/${i_vn}`; // Naredimo ključ glede na indekse, ki opisujejo lice

						if (!(key in map)) { // Če tak ključ še ne obstaja v slovarju, novo 
							map[key] = vertices.length; // Dobimo zadnje mesto seznama oglišč

							vertices.push({
								position: positions[i_v],
								texture: texture_uvs[i_vt] || [0, 0],
								normal: normals[i_vn] || [0, 0, 0]
							})
						}

						indices.push(map[key]);
					}
					break;
			}

		}

		return { positions, normals, texture_uvs, vertices, indices };
	}

	function uploadObject(objectData) {
		let vao = gl.createVertexArray();
    	gl.bindVertexArray(vao);

		// VBO 
		let vboData = [];
		let buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		for (let v of objectData.vertices) {
			vboData.push(
				v.position[0], v.position[1], v.position[2],
				v.normal[0], v.normal[1], v.normal[2],
				v.texture[0], v.texture[1]
			);
		}
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vboData), gl.STATIC_DRAW);
		
		const stride = 8 * 4; // 8 floatov na oglišče

		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);

		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);

		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 6 * 4);

		// EBO: uporabimo, ker brez tega sem imel velike luknje v objektu (hrani indekse trikotnikov, ki kažejo na oglišča v VBO)
		// EBO povežemo šele ko sta VAO in VBO povezana
		let ebo = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(objectData.indices), gl.STATIC_DRAW);

		return {
			vao,
			ebo,
			vertexCount: objectData.indices.length
		};
	}


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

		// naloženi objekti
		for (let obj of objects) {
			// M za objekt
			let M = glMatrix.mat4.create();
			glMatrix.mat4.translate(M, M, obj.position);

			glMatrix.mat4.rotateX(M, M, glMatrix.glMatrix.toRadian(obj.rotation[0]));
			glMatrix.mat4.rotateY(M, M, glMatrix.glMatrix.toRadian(obj.rotation[1]));
			glMatrix.mat4.rotateZ(M, M, glMatrix.glMatrix.toRadian(obj.rotation[2]));
			glMatrix.mat4.scale(M, M, obj.scale);
			glMatrix.mat4.multiply(M, M, obj.shearMatrix);

			let PVM = glMatrix.mat4.create();
			glMatrix.mat4.multiply(PVM, view_matrix, M);
			glMatrix.mat4.multiply(PVM, proj_matrix, PVM);

			gl.bindVertexArray(obj.vao);
			gl.uniformMatrix4fv(gl.getUniformLocation(program, "PVM"), false, PVM);

			let colorModeLoc = gl.getUniformLocation(program, "ColorMode");

			switch(obj.colorMode) {
				case "normala": 
					gl.uniform1i(colorModeLoc, 1); 
					break;
				case "uv": 
					gl.uniform1i(colorModeLoc, 2); 
					break;
				default:
					gl.uniform1i(colorModeLoc, 0);
					break;
			}

			if (obj.colorMode === "normal") gl.uniform3fv(colorLoc, CubeColor);

			gl.drawElements(gl.TRIANGLES, obj.vertexCount, gl.UNSIGNED_SHORT, 0);
		}

		CubeColor[0] = 0.75 + 0.5 * Math.sin(t); 
		CubeColor[1] = 0.75 + 0.5 * Math.sin(t * 0.5); 
		CubeColor[2] = 0.75 + 0.5 * Math.sin(t * 1.5); 

		t += 0.05


		if (shearAnimation) {
			if (selectedObjectIndex < 0) return;
			selectedObject = objects[selectedObjectIndex];
			
			shearTheta += Math.sin(t) * 4;
			shearPhi += Math.sin(t - 2) * 4;
			if (shearPhi >= 180) shearPhi = 0;
			if (shearTheta >= 180) shearTheta = 0;
			selectedObject.shearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
			let thetaSlider = document.getElementById("shearTheta");
			let thetaDisplay = document.getElementById("shearThetaVal");
			let phiSlider = document.getElementById("shearPhi");
			let phiDisplay = document.getElementById("shearPhiVal");
			phiSlider.value = shearPhi;
			phiDisplay.textContent = shearPhi.toFixed(1);
			thetaSlider.value = shearTheta;
			thetaDisplay.textContent = shearTheta.toFixed(1);
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

		return [x, -y, -z];
	}

	function setupSliders() {
		const sliderIds = [
			["scaleX", 0], ["scaleY", 1], ["scaleZ", 2],
			["rotX", 0], ["rotY", 1], ["rotZ", 2],
			["posX", 0], ["posY", 1], ["posZ", 2]
		];

		sliderIds.forEach(([id, idx]) => {
			let slider = document.getElementById(id);
			let display = document.getElementById(id + "Val");

			slider.addEventListener("input", () => {
				if (selectedObjectIndex < 0) return;
				let obj = objects[selectedObjectIndex];

				if (id.startsWith("scale")) obj.scale[idx] = parseFloat(slider.value);
				else if (id.startsWith("rot")) obj.rotation[idx] = parseFloat(slider.value);
				else if (id.startsWith("pos")) obj.position[idx] = parseFloat(slider.value);

				display.textContent = slider.value;
			});
		});

		// SHEAR
		const thetaSlider = document.getElementById("shearTheta");
		const phiSlider = document.getElementById("shearPhi");
		const thetaDisplay = document.getElementById("shearThetaVal");
		const phiDisplay = document.getElementById("shearPhiVal");
		const shearTypeSelect = document.getElementById("shearType");

		function updateShear() {
			if (selectedObjectIndex < 0) return;
			let obj = objects[selectedObjectIndex];
			let theta = parseFloat(thetaSlider.value);
			let phi = parseFloat(phiSlider.value);
			let type = shearTypeSelect.value;

			thetaDisplay.textContent = theta.toFixed(1);
			phiDisplay.textContent = phi.toFixed(1);

			obj.shearMatrix = shearMatrix(type, theta, phi);
		}

		thetaSlider.addEventListener("input", updateShear);
		phiSlider.addEventListener("input", updateShear);
		shearTypeSelect.addEventListener("change", updateShear);
	}


	function resetSliders() {
		if (selectedObjectIndex < 0) return;
		let selectedObject = objects[selectedObjectIndex];
		const defaultValues = {
			"scaleX": 1.0, "scaleY": 1.0, "scaleZ": 1.0,
			"rotX": 0, "rotY": 0, "rotZ": 0,
			"posX": 0, "posY": 0, "posZ": 0,
			"shearTheta": 90.0,
			"shearPhi": 90.0
		};
		Object.keys(defaultValues).forEach(key => {
			const slider = document.getElementById(key);
			const display = document.getElementById(key + "Val");
			slider.value = defaultValues[key];
			display.textContent = defaultValues[key];
		});

		selectedObject.shearMatrix = shearMatrix(shearType, shearTheta, shearPhi);
	}

	function updateSlidersForSelectedObject() {
		if (selectedObjectIndex < 0) return;
		let selectedObject = objects[selectedObjectIndex];

		const mapping = [
			["scaleX", selectedObject.scale, 0],
			["scaleY", selectedObject.scale, 1],
			["scaleZ", selectedObject.scale, 2],
			["rotX", selectedObject.rotation, 0],
			["rotY", selectedObject.rotation, 1],
			["rotZ", selectedObject.rotation, 2],
			["posX", selectedObject.position, 0],
			["posY", selectedObject.position, 1],
			["posZ", selectedObject.position, 2]
		];

		mapping.forEach(([id, arr, idx]) => {
			let slider = document.getElementById(id);
			let display = document.getElementById(id + "Val");
			slider.value = arr[idx];
			display.textContent = arr[idx].toFixed(2);
		});

		// color mode in shear sliderje posodobimo posebej
		let colorMode = document.getElementById("colorMode");
		colorMode.value = selectedObject.colorMode;

		let thetaSlider = document.getElementById("shearTheta");
		let phiSlider = document.getElementById("shearPhi");
		let thetaDisplay = document.getElementById("shearThetaVal");
		let phiDisplay = document.getElementById("shearPhiVal");

		// shear sliderje hranim globalno
		thetaSlider.value = shearTheta;
		phiSlider.value = shearPhi;
		thetaDisplay.textContent = shearTheta.toFixed(1);
		phiDisplay.textContent = shearPhi.toFixed(1);
	}
});
