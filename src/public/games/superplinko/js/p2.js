////////////////////////////////////////////////////////////
// P2
////////////////////////////////////////////////////////////
var worldArr = [];
var scaleX = 50, scaleY = -50;

var ballPhysics_arr = [];
var hitPhysics_arr = [];
var physicsData = {currentWorld:0, ballX:0, ballY:0, idleTime:10, idleTimeCount:0};
				
function initPhysics(){
	for(var n=0; n<2; n++){
		worldArr.push({world:'', paused:true})

		// Init p2.js	
		worldArr[n].world = new p2.World({gravity:[0,-50]});

		var ballVsObject = new p2.ContactMaterial(ballMaterial, pinMaterial, {
			// friction
			friction: .5,
			// bounce
			restitution: .4
		});
		worldArr[n].world.addContactMaterial(ballVsObject);

		var ballVsObject = new p2.ContactMaterial(ballMaterial, sideMaterial, {
			// friction
			friction: .5,
			// bounce
			restitution: .4
		});
		worldArr[n].world.addContactMaterial(ballVsObject);

		worldArr[n].world.on('beginContact', function (evt){
			var contactVelocityA = getBodyVelocity(evt.bodyA);
			var contactVelocityB = getBodyVelocity(evt.bodyB);

			if(evt.bodyA.contactType === 'ball' || evt.bodyB.contactType === 'ball'){
				if(contactVelocityA > 5){
					playHitSound();
				}
				
				if(contactVelocityB > 5){
					playHitSound();
				}
			}

			if(evt.bodyA.contactType == 'ball' && evt.bodyB.contactType == 'pin'){
				setBallVelocity(evt.bodyA);
			}else if(evt.bodyA.contactType == 'pin' && evt.bodyB.contactType == 'ball'){
				setBallVelocity(evt.bodyB);
			}

			if(evt.bodyA.contactType == 'ball' && evt.bodyB.contactType == 'bottom'){
				findGameResult();
			}else if(evt.bodyA.contactType == 'bottom' && evt.bodyB.contactType == 'ball'){
				findGameResult();
			}
		});

		pausedPhysics(n, true);
	}
}

function getBodyVelocity(body){
	return Math.abs(body.velocity[0]) + Math.abs(body.velocity[1]);
}

var ballMaterial = new p2.Material();
var sideMaterial = new p2.Material();
var pinMaterial = new p2.Material();

function createPhysicBall(radius, x, y){
	ballPhysics_arr.push({shape:'', body:'', material:'', property:{radius:(radius/scaleX)}, position:[0, 0]});
	var newIndex = ballPhysics_arr.length-1;
		
	ballPhysics_arr[newIndex].shape = new p2.Circle(ballPhysics_arr[newIndex].property);
	ballPhysics_arr[newIndex].material = ballMaterial;
	ballPhysics_arr[newIndex].shape.material = ballPhysics_arr[newIndex].material;
	ballPhysics_arr[newIndex].body = new p2.Body({
		mass:1,
		position:ballPhysics_arr[newIndex].position
	});
	ballPhysics_arr[newIndex].body.addShape(ballPhysics_arr[newIndex].shape);
	
	ballPhysics_arr[newIndex].body.position[0] = ((x) - (canvasW/2))/scaleX;
	ballPhysics_arr[newIndex].body.position[1] = ((y) - canvasH)/scaleY;
	ballPhysics_arr[newIndex].body.contactType = 'ball';
	
	worldArr[physicsData.currentWorld].world.addBody(ballPhysics_arr[newIndex].body);
}

function createPhysicBall2(w, h, x, y, rotation){
	ballPhysics_arr.push({shape:'', body:'', material:'', property:{width:w/scaleX, height:h/scaleX}, position:[0, 0]});
	var newIndex = ballPhysics_arr.length-1;
		
	ballPhysics_arr[newIndex].shape = new p2.Box(hitPhysics_arr[newIndex].property);
	ballPhysics_arr[newIndex].material = ballMaterial;
	ballPhysics_arr[newIndex].shape.material = ballPhysics_arr[newIndex].material;
	ballPhysics_arr[newIndex].body = new p2.Body({
		mass:1,
		position:ballPhysics_arr[newIndex].position,
		angle: -(rotation) / (180 / Math.PI)
	});
	ballPhysics_arr[newIndex].body.addShape(ballPhysics_arr[newIndex].shape);
	
	ballPhysics_arr[newIndex].body.position[0] = ((x) - (canvasW/2))/scaleX;
	ballPhysics_arr[newIndex].body.position[1] = ((y) - canvasH)/scaleY;
	ballPhysics_arr[newIndex].body.contactType = 'ball';
	
	worldArr[physicsData.currentWorld].world.addBody(ballPhysics_arr[newIndex].body);
}

function createPhysicPlane(w, h, x, y, rotation, type){
	hitPhysics_arr = [{shape:'', body:'', material:'', property:{width:w/scaleX, height:h/scaleX}, position:[0, 0]}];
	var newIndex = hitPhysics_arr.length-1;
	
	hitPhysics_arr[newIndex].shape = new p2.Box(hitPhysics_arr[newIndex].property);
	hitPhysics_arr[newIndex].material = sideMaterial;
	hitPhysics_arr[newIndex].shape.material = hitPhysics_arr[newIndex].material;
	hitPhysics_arr[newIndex].body = new p2.Body({
		mass:0,
		position:hitPhysics_arr[newIndex].position,
		angle: -(rotation) / (180 / Math.PI)
	});
	hitPhysics_arr[newIndex].body.addShape(hitPhysics_arr[newIndex].shape);
	
	hitPhysics_arr[newIndex].body.position[0] = (x - (canvasW/2))/scaleX;
	hitPhysics_arr[newIndex].body.position[1] = (y - canvasH)/scaleY;
	hitPhysics_arr[newIndex].body.contactType = type;

	worldArr[physicsData.currentWorld].world.addBody(hitPhysics_arr[newIndex].body);
}

function createPhysicCircle(radius, x, y){
	hitPhysics_arr.push({shape:'', body:'', material:'', property:{radius:(radius/scaleX)}, position:[0, 0]});
	var newIndex = hitPhysics_arr.length-1;
		
	hitPhysics_arr[newIndex].shape = new p2.Circle(hitPhysics_arr[newIndex].property);
	hitPhysics_arr[newIndex].material = pinMaterial;
	hitPhysics_arr[newIndex].shape.material = hitPhysics_arr[newIndex].material;
	hitPhysics_arr[newIndex].body = new p2.Body({
		mass:0,
		position:hitPhysics_arr[newIndex].position
	});
	hitPhysics_arr[newIndex].body.addShape(hitPhysics_arr[newIndex].shape);
	
	hitPhysics_arr[newIndex].body.position[0] = (x - (canvasW/2))/scaleX;
	hitPhysics_arr[newIndex].body.position[1] = (y - canvasH)/scaleY;
	hitPhysics_arr[newIndex].body.contactType = 'pin';
	
	worldArr[physicsData.currentWorld].world.addBody(hitPhysics_arr[newIndex].body);
}

function dropPhysicsBall(index, x, y){
	ballPhysics_arr[index].body.position[0] = (x - (canvasW/2))/scaleX;
	ballPhysics_arr[index].body.position[1] = (y - canvasH)/scaleY;
	ballPhysics_arr[index].body.velocity[0] = 0;
	ballPhysics_arr[index].body.velocity[1] = 0;
}

function resetPhysics(){
	ballPhysics_arr[0].body.velocity[0] = 0;
	ballPhysics_arr[0].body.velocity[1] = 0;

	ballPhysics_arr[1].body.velocity[0] = 0;
	ballPhysics_arr[1].body.velocity[1] = 0;
}

function setBallVelocity(targetBody){	
	var veloX = 0;
	
	if(targetBody.velocity[0] > 0){
		veloX = randomIntFromInterval(0,2);
	}else if(targetBody.velocity[0] < 0){
		veloX = randomIntFromInterval(0,2);
		veloX = -veloX;
	}else{
		veloX = randomIntFromInterval(-2,2);
	}
	
	targetBody.velocity[0] += veloX;
}

function renderPhysics(index){
	var x = ballPhysics_arr[index].body.position[0],
		y = ballPhysics_arr[index].body.position[1];
	
	var targetBall = gameData.ballShape;
	if(index == 1){
		targetBall = gameData.ballShapeBonus;
	}

	targetBall.x = (canvasW/2) + (x * scaleX);
	targetBall.y = canvasH + (y * scaleY);
	targetBall.rotation = -(ballPhysics_arr[index].body.angle) * 180 / Math.PI;

	var checkIdle = false;
	if(gameData.dropCon){
		if(!gameData.bonusRound){
			if(!gameData.resultCon){
				checkIdle = true;
			}
		}else{
			if(!gameData.resultBonusCon){
				checkIdle = true;
			}
		}

		if(checkIdle){
			physicsData.idleMove = getDistanceByValue(targetBall.x, targetBall.y, physicsData.ballX, physicsData.ballY);

			if(physicsData.idleMove == 0){
				physicsData.idleTimeCount--;
				if(physicsData.idleTimeCount <= 0){
					setBallVelocity(ballPhysics_arr[index].body);
				}
			}else{
				physicsData.idleTimeCount = physicsData.idleTime;
			}
		}

		physicsData.ballX = targetBall.x;
		physicsData.ballY = targetBall.y;
	}
}

function pausedPhysics(index, con){
	worldArr[index].paused = con;
}

//p2 loop
function updatePhysics(){
	for(var n=0; n<2; n++){
		if(!worldArr[n].paused){
			worldArr[n].world.step(1/60);
			renderPhysics(n);
		}
	}
}