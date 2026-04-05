////////////////////////////////////////////////////////////
// GAME v1.3
////////////////////////////////////////////////////////////

/*!
 * 
 * GAME SETTING CUSTOMIZATION START
 * 
 */

var gameSettings ={
    enableFixedResult:false, //option to have fixed result by API, enabling this will disable 2D physics engine
    enablePercentage:false, //option to have result base on percentage, enabling this will disable 2D physics engine
    gamePlayType:true, //game play type; true for chance, false for bet
    totalChance:7, //total chance
    betPoint:500, //start bet amount
    minBet:10, //minimum bet amount
    maxBet:500, //max bet amount
	coin:true, //enable collect coin
	coinPercent:20 //total coins for collect
}

var plinkoSettings = {
        column:9,
        row:10,
        size:48,		
        ballSize:19,
        ballColor:"#FF7F00",
        pinSize:5,
        pinColor:"#fff",
        prizeBorderColor:"#fff",
		prizes:[
			{value:50, text:"5\n0", fontSize:20, lineHeight:18, x:0, y:-3, color:"#fff", bgColor:"#7700B0", bgWinColor:"#A600F9", percent:15},
			{value:0, text:"0", fontSize:20, lineHeight:18, x:0, y:5, color:"#fff", bgColor:"#7700B0", bgWinColor:"#A600F9", percent:20},
			{value:250, text:"2\n5\n0", fontSize:20, lineHeight:18, x:0, y:-8, color:"#fff", bgColor:"#7700B0", bgWinColor:"#A600F9", percent:10},
			{value:0, text:"0", fontSize:20, lineHeight:18, x:0, y:5, color:"#fff", bgColor:"#7700B0", bgWinColor:"#A600F9", percent:20},
			{value:500, text:"5\n0\n0", fontSize:20, lineHeight:18, x:0, y:-8, color:"#fff", bgColor:"#7700B0", bgWinColor:"#A600F9", percent:5},
			{value:0, text:"0", fontSize:20, lineHeight:18, x:0, y:5, color:"#fff", bgColor:"#7700B0", bgWinColor:"#A600F9", percent:20},
			{value:250, text:"2\n5\n0", fontSize:20, lineHeight:18, x:0, y:-8, color:"#fff", bgColor:"#7700B0", bgWinColor:"#A600F9", percent:10},
			{value:0, image:'assets/item_prize_bonus.png', x:0, y:0, color:"#fff", bgColor:"#7700B0", bgWinColor:"#A600F9", percent:20, bonus:true},
			{value:50, text:"5\n0", fontSize:20, lineHeight:18, x:0, y:-3, color:"#fff", bgColor:"#7700B0", bgWinColor:"#A600F9", percent:15},
	]
}

var plinkoBonusSettings = {
	column:5,
	row:6,
	size:52,		
	ballSize:20,
	ballColor:"#FF7F00",
	pinSize:6,
	pinColor:"#fff",
	prizeBorderColor:"#fff",
	prizes:[
		{value:500, text:"5\n0\n0", fontSize:20, lineHeight:18, x:0, y:-8, color:"#fff", bgColor:"#ea841f", bgWinColor:"#efad29", percent:15},
		{value:0, text:"0", fontSize:20, lineHeight:18, x:0, y:5, color:"#fff", bgColor:"#ea841f", bgWinColor:"#efad29", percent:20},
		{value:500, text:"5\n0\n0", fontSize:20, lineHeight:18, x:0, y:-8, color:"#fff", bgColor:"#ea841f", bgWinColor:"#efad29", percent:15},
		{value:0, text:"0", fontSize:20, lineHeight:18, x:0, y:5, color:"#fff", bgColor:"#ea841f", bgWinColor:"#efad29", percent:20},
		{value:500, text:"5\n0\n0", fontSize:20, lineHeight:18, x:0, y:-8, color:"#fff", bgColor:"#ea841f", bgWinColor:"#efad29", percent:15}
]
}

var coinSettings = [
						{value:1},
						{value:5},
						{value:10}
];

//game text display
var textDisplay = {
					credit:"$[NUMBER]",
					bet:"$[NUMBER]",
					chance:"x [NUMBER]",
					minBet:"PLACE BET TO BEGIN",
					won:"YOU WON $[NUMBER]",
					lose:"YOU DIDN't WIN",
					playing:'PLAYING...',
					bonusRound:'BONUS ROUND',
					gameOver:'GAME OVER',
					collectCoin:"+[NUMBER]",
					exitTitle:"EXIT GAME",
					exitMessage:"ARE YOU SURE YOU WANT\nTO QUIT GAME?",
					share:"SHARE YOUR SCORE",
					resultTitle:"GAME OVER",
					resultDesc:"YOU WON",
					resultScore:"$[NUMBER]"
}

//Social share, [SCORE] will replace with game score
var shareEnable = true; //toggle share
var shareTitle = "Highscore on Super Plinko Game at Level [SCORE].";//social share score title
var shareMessage = "Level [SCORE] is mine new highscore on Super Plinko Game! Try it now!"; //social share score message
				
/*!
 *
 * GAME SETTING CUSTOMIZATION END
 *
 */

var playerData = {chance:0, score:0, point:0, bet:0};
var gameData = {sideH:7, bottomH:20, paused:true, dropCon:false, ballShape:null, moveArray:[], moveBonusArray:[], finalMoveArray:[], coinArray:[], fixedResult:-1, fixedBonusResult:-1, bonusRound:false};
var betData = {interval:null, timer:0, timerMax:300, timerMin:10, betpoint:0, betNumber:0, betNumberPlus:0};
var tweenData = {score:0, scoreTarget:0, resultScore:0};

/*!
 * 
 * GAME BUTTONS - This is the function that runs to setup button event
 * 
 */
function buildGameButton(){
	gameData.physicsEngine = true;
	if(gameSettings.enableFixedResult){
		gameData.physicsEngine = false;
	}
	
	if(gameSettings.enablePercentage){
		createPercentage();
		gameData.physicsEngine = false;	
	}

	buttonStart.cursor = "pointer";
	buttonStart.addEventListener("click", function(evt) {
		playSound('soundClick');
		goPage('game');
	});
	
	//game
	buttonMinus.cursor = "pointer";
	buttonMinus.addEventListener("mousedown", function(evt) {
		playSound('soundChips');
		toggleBetNumber('minus');
	});
	buttonMinus.addEventListener("pressup", function(evt) {
		toggleBetNumber();
	});
	
	buttonPlus.cursor = "pointer";
	buttonPlus.addEventListener("mousedown", function(evt) {
		playSound('soundChips');
		toggleBetNumber('plus');
	});
	buttonPlus.addEventListener("pressup", function(evt) {
		toggleBetNumber();
	});

	buttonConfirm.cursor = "pointer";
	buttonConfirm.addEventListener("click", function(evt) {
		playSound('soundClick');
		toggleConfirm(false);
		stopGame(true);
		goPage('main');
	});
	
	buttonCancel.cursor = "pointer";
	buttonCancel.addEventListener("click", function(evt) {
		playSound('soundClick');
		toggleConfirm(false);
	});
	
	buttonContinue.cursor = "pointer";
	buttonContinue.addEventListener("click", function(evt) {
		playSound('soundClick');
		goPage('main');
	});
	
	//result
	buttonFacebook.cursor = "pointer";
	buttonFacebook.addEventListener("click", function(evt) {
		share('facebook');
	});
	
	buttonTwitter.cursor = "pointer";
	buttonTwitter.addEventListener("click", function(evt) {
		share('twitter');
	});
	
	buttonWhatsapp.cursor = "pointer";
	buttonWhatsapp.addEventListener("click", function(evt) {
		share('whatsapp');
	});
	
	//options
	buttonSoundOff.cursor = "pointer";
	buttonSoundOff.addEventListener("click", function(evt) {
		toggleGameMute(true);
	});
	
	buttonSoundOn.cursor = "pointer";
	buttonSoundOn.addEventListener("click", function(evt) {
		toggleGameMute(false);
	});
	
	buttonFullscreen.cursor = "pointer";
	buttonFullscreen.addEventListener("click", function(evt) {
		toggleFullScreen();
	});
	
	buttonSettings.cursor = "pointer";
	buttonSettings.addEventListener("click", function(evt) {
		playSound('soundClick');
		toggleOption();
	});
	
	buttonExit.cursor = "pointer";
	buttonExit.addEventListener("click", function(evt) {
		playSound('soundClick');
		toggleConfirm(true);
		toggleOption();
	});
}

function appendFocusFrame(){
	$('#mainHolder').prepend('<div id="focus" style="position:absolute; width:100%; height:100%; z-index:1000;"></div');
	$('#focus').click(function(){
		$('#focus').remove();
	});	
}


/*!
 * 
 * DISPLAY PAGES - This is the function that runs to display pages
 * 
 */
var curPage=''
function goPage(page){
	curPage=page;
	
	mainContainer.visible = false;
	gameContainer.visible = false;
	resultContainer.visible = false;
	
	var targetContainer = null;
	switch(page){
		case 'main':
			targetContainer = mainContainer;
		break;
		
		case 'game':			
			targetContainer = gameContainer;
			
			startGame();
		break;
		
		case 'result':
			targetContainer = resultContainer;
			stopGame();
			
			playSound('soundResult');

			tweenData.resultScore = 0;
			TweenMax.to(tweenData, 1, {resultScore:playerData.score, overwrite:true, onUpdate:function(){
				resultScoreTxt.text = textDisplay.resultScore.replace('[NUMBER]', addCommas(Math.round(tweenData.resultScore)));
			}});

			saveGame(playerData.score);
		break;
	}
	
	if(targetContainer != null){
		targetContainer.visible = true;
		targetContainer.alpha = 0;
		TweenMax.to(targetContainer, .5, {alpha:1, overwrite:true});
	}
	
	resizeCanvas();
}

function toggleConfirm(con){
	confirmContainer.visible = con;
	
	if(con){
		TweenMax.pauseAll(true, true);
		gameData.paused = true;
	}else{
		TweenMax.resumeAll(true, true);
		if(curPage == 'game'){
			gameData.paused = false;
		}
	}
}

/*!
 * 
 * SETUP GAME - This is the function that runs to setup game
 * 
 */
function setupGames(){
	var rotateArr = [63,113];
	var pos = {x:0, y:0};
	pos.y = (plinkoSettings.row+3) * (plinkoSettings.size);
	pos.y = -(pos.y/2);
	
	for(var n=0; n<plinkoSettings.row; n++){
		var totalPin = plinkoSettings.column;
		var rotateNum = rotateArr[0];
		var centerCon = true;
		if(!isEven(n)){
			totalPin--;
			rotateNum = rotateArr[1];
			centerCon = false;
		}

		var totalW = totalPin * (plinkoSettings.size);
		pos.x = -(totalW/2);
		
		var sideW = plinkoSettings.size;
		var sideH = gameData.sideH;

		var newSideL = new createjs.Shape();
		var centerPos = getCenterPosition(pos.x, pos.y, pos.x + (plinkoSettings.size/2), pos.y + plinkoSettings.size);
		if(!centerCon){
			centerPos = getCenterPosition(pos.x, pos.y, pos.x - (plinkoSettings.size/2), pos.y + plinkoSettings.size);
		}
		newSideL.graphics.beginFill("blue").drawRect(-(sideW/2), -(sideH/2), sideW, sideH);
		newSideL.x = centerPos.x - (sideH/2);
		newSideL.y = centerPos.y;
		newSideL.rotation = rotateNum;
		plinkoGuideContainer.addChild(newSideL);

		createPhysicPlane(sideW, sideH, newSideL.x, newSideL.y, newSideL.rotation, 'side');

		if(n == 0){
			var newTopL = new createjs.Shape();
			newTopL.graphics.beginFill("blue").drawRect(-(sideW/2), -(sideH/2), sideW, sideH);
			newTopL.x = pos.x;
			newTopL.y = pos.y - (plinkoSettings.size/2);
			newTopL.rotation = -90;
			plinkoGuideContainer.addChild(newTopL);

			//buttons
			var buttonPos = {x:0, y:0};
			buttonPos.x = pos.x;
			buttonPos.y = pos.y;
			
			gameData.dropArea = totalPin;
			for(var p=0; p<gameData.dropArea; p++){
				$.drop[p] = new createjs.Shape();
				$.drop[p].hitArea = new createjs.Shape(new createjs.Graphics().beginFill("green").drawRect(-(sideW/2), -(sideW + (sideW/2)), sideW, sideW * 2));
				$.drop[p].x = buttonPos.x + (plinkoSettings.size/2);
				$.drop[p].y = buttonPos.y - (plinkoSettings.size/2);
				plinkoItemContainer.addChild($.drop[p]);

				$.arrow[p] = itemArrow.clone();
				$.arrow[p].visible = true;
				$.arrow[p].x = $.drop[p].x;
				$.arrow[p].y -= (plinkoSettings.size/2);
				stateContainer.addChild($.arrow[p]);

				buttonPos.x += plinkoSettings.size

				//events
				$.drop[p].cursor = "pointer";
				$.drop[p].addEventListener("click", function(evt) {
					if(playerData.chance == 0){
						return;
					}
					dropBall(evt.currentTarget);
				});

				$.drop[p].cursor = "pointer";
				$.drop[p].addEventListener("mouseover", function(evt) {
					if(playerData.chance == 0){
						return;
					}
					toggleBallFall(evt.currentTarget, true);
				});

				$.drop[p].cursor = "pointer";
				$.drop[p].addEventListener("mouseout", function(evt) {
					if(playerData.chance == 0){
						return;
					}
					toggleBallFall(evt.currentTarget, false);
				});
			}

			stateContainer.y = buttonPos.y - (plinkoSettings.size);
		}

		pos.x += plinkoSettings.size;

		//movement
		var movePos = {x:0, y:0};
		movePos.x = pos.x - (plinkoSettings.size/2);
		movePos.y = pos.y;
		
		gameData.moveArray.push([]);
		for(var p=0; p<totalPin; p++){
			$.move[n+'_'+p] = new createjs.Shape();
			$.move[n+'_'+p].graphics.beginFill('red').drawCircle(0, 0, plinkoSettings.pinSize/2);
			$.move[n+'_'+p].x = movePos.x;
			$.move[n+'_'+p].y = movePos.y;

			movePos.x += plinkoSettings.size;
			plinkoGuideContainer.addChild($.move[n+'_'+p]);

			gameData.moveArray[n].push(p);
		}

		for(var p=0; p<totalPin-1; p++){
			var newPot = new createjs.Shape();
			newPot.graphics.beginFill(plinkoSettings.pinColor).drawCircle(0, 0, plinkoSettings.pinSize);
			newPot.x = pos.x;
			newPot.y = pos.y;
			
			pos.x += plinkoSettings.size;
			plinkoItemContainer.addChild(newPot);

			createPhysicCircle(plinkoSettings.pinSize, newPot.x, newPot.y);
		}

		rotateNum = rotateArr[1];
		if(!isEven(n)){
			rotateNum = rotateArr[0];
		}

		var newSideR = new createjs.Shape();
		var centerPos = getCenterPosition(pos.x, pos.y, pos.x - (plinkoSettings.size/2), pos.y + plinkoSettings.size);
		if(!centerCon){
			centerPos = getCenterPosition(pos.x, pos.y, pos.x + (plinkoSettings.size/2), pos.y + plinkoSettings.size);
		}
		newSideR.graphics.beginFill("blue").drawRect(-(sideW/2), -(sideH/2), sideW, sideH);
		newSideR.x = centerPos.x + (sideH/2);
		newSideR.y = centerPos.y;
		newSideR.rotation = rotateNum;
		plinkoGuideContainer.addChild(newSideR);

		createPhysicPlane(sideW, sideH, newSideR.x, newSideR.y, newSideR.rotation, 'side');

		if(n == 0){
			var newTopR = new createjs.Shape();
			newTopR.graphics.beginFill("blue").drawRect(-(sideW/2), -(sideH/2), sideW, sideH);
			newTopR.x = pos.x;
			newTopR.y = pos.y - (plinkoSettings.size/2);
			newTopR.rotation = -90;
			plinkoGuideContainer.addChild(newTopR);
		}

		pos.y += plinkoSettings.size;
	}

	//prizes
	gameData.moveArray.push([]);
	var totalPin = plinkoSettings.column;
	if(!isEven(n)){
		totalPin--;
	}
	
	var sideBottomH = gameData.bottomH;
	var sidePrizeW = sideW + (plinkoSettings.size/2)
	var prizePos = {x:0, y:0};
	var totalW = totalPin * (plinkoSettings.size);
	var prizeSpace = totalW/plinkoSettings.prizes.length;
	prizePos.x = -(totalW/2);
	prizePos.y = pos.y;

	var prizeNameW = prizeSpace;
	var prizeNameH = plinkoSettings.size * 2;

	for(var p=0; p<plinkoSettings.prizes.length; p++){
		$.move[n+'_'+p] = new createjs.Shape();
		$.move[n+'_'+p].graphics.beginFill("red").drawCircle(0, 0, plinkoSettings.pinSize/2);
		$.move[n+'_'+p].x = prizePos.x + (prizeSpace/2);
		$.move[n+'_'+p].y = prizePos.y;

		plinkoGuideContainer.addChild($.move[n+'_'+p]);
		gameData.moveArray[n].push(p);

		$.prize['bottom'+p] = new createjs.Shape();
		$.prize['bottom'+p].graphics.beginFill(plinkoSettings.prizeBorderColor).drawRect(-(prizeSpace/2), -(sideBottomH/2), prizeSpace, sideBottomH);
		$.prize['bottom'+p].x = prizePos.x + (prizeSpace/2);
		$.prize['bottom'+p].y = prizePos.y + (plinkoSettings.size) + (plinkoSettings.size/2);
		plinkoItemContainer.addChild($.prize['bottom'+p]);

		var newPrizeL = new createjs.Shape();
		newPrizeL.graphics.beginFill(plinkoSettings.prizeBorderColor).drawRect(-(sidePrizeW/2), -(sideH/2), sidePrizeW, sideH);
		newPrizeL.x = prizePos.x
		newPrizeL.y = prizePos.y + (plinkoSettings.size/2)+ (plinkoSettings.size/2);
		newPrizeL.rotation = 90;
		plinkoItemContainer.addChild(newPrizeL);

		var newPrizeR = new createjs.Shape();
		newPrizeR.graphics.beginFill(plinkoSettings.prizeBorderColor).drawRect(-(sidePrizeW/2), -(sideH/2), sidePrizeW, sideH);
		newPrizeR.x = prizePos.x + prizeSpace;
		newPrizeR.y = prizePos.y + (plinkoSettings.size/2)+ (plinkoSettings.size/2);
		newPrizeR.rotation = 90;
		plinkoItemContainer.addChild(newPrizeR);

		//prize name
		$.prize['bg'+p] = new createjs.Shape();
		$.prize['bg'+p].graphics.beginStroke(plinkoSettings.prizeBorderColor).setStrokeStyle(7).beginFill(plinkoSettings.prizes[p].bgColor).drawRect(-(prizeNameW/2), -(prizeNameH/2), prizeNameW, prizeNameH);
		$.prize['bg'+p].x = prizePos.x + (prizeSpace/2);
		$.prize['bg'+p].y = prizePos.y + (plinkoSettings.size * 2) + (plinkoSettings.size/2);

		$.prize['bgWin'+p] = new createjs.Shape();
		$.prize['bgWin'+p].graphics.beginFill(plinkoSettings.prizes[p].bgWinColor).drawRect(-(prizeNameW/2), -(prizeNameH/2), prizeNameW, prizeNameH);
		$.prize['bgWin'+p].x = $.prize['bg'+p].x;
		$.prize['bgWin'+p].y = $.prize['bg'+p].y;

		var prizeImage = false;
		if(plinkoSettings.prizes[p].image != undefined){
			if(plinkoSettings.prizes[p].image != ''){
				prizeImage = true;

				$.prize['name'+p] = new createjs.Bitmap(loader.getResult('prize'+p));
				centerReg($.prize['name'+p]);
				$.prize['name'+p].x = $.prize['bg'+p].x + plinkoSettings.prizes[p].x;
				$.prize['name'+p].y = $.prize['bg'+p].y + plinkoSettings.prizes[p].y;
			}
		}

		if(!prizeImage){
			$.prize['name'+p] = new createjs.Text();
			$.prize['name'+p].font = plinkoSettings.prizes[p].fontSize + "px azonixregular";
			$.prize['name'+p].lineHeight = plinkoSettings.prizes[p].lineHeight;
			$.prize['name'+p].color = plinkoSettings.prizes[p].color;
			$.prize['name'+p].textAlign = "center";
			$.prize['name'+p].textBaseline='alphabetic';
			$.prize['name'+p].text = plinkoSettings.prizes[p].text;
			$.prize['name'+p].x = $.prize['bg'+p].x + plinkoSettings.prizes[p].x;
			$.prize['name'+p].y = $.prize['bg'+p].y + plinkoSettings.prizes[p].y;
		}
		
		plinkoItemContainer.addChild($.prize['bg'+p], $.prize['bgWin'+p], $.prize['name'+p]);

		prizePos.x += prizeSpace;

		createPhysicPlane(prizeSpace, sideBottomH, $.prize['bottom'+p].x, $.prize['bottom'+p].y, $.prize['bottom'+p].rotation, 'bottom');
		createPhysicPlane(sidePrizeW, sideH, newPrizeL.x, newPrizeL.y, newPrizeL.rotation, 'side');
		createPhysicPlane(sidePrizeW, sideH, newPrizeR.x, newPrizeR.y, newPrizeR.rotation, 'side');
	}

	gameData.ballShape = new createjs.Shape();
	gameData.ballShape.graphics.beginFill(plinkoSettings.ballColor).drawCircle(0, 0, plinkoSettings.ballSize);
	gameData.ballShape.x = 0;
	gameData.ballShape.y = 0;
	
	plinkoItemContainer.addChild(gameData.ballShape);
	createPhysicBall(plinkoSettings.ballSize, gameData.ballShape.x, gameData.ballShape.y);

	gameData.coinArray = [];
	for(var r=1; r<gameData.moveArray.length-1; r++){
		for(var c=0; c<gameData.moveArray[r].length; c++){
			gameData.coinArray.push({r:r, c:c})
		}
	}

	//bonus
	physicsData.currentWorld = 1;

	var pos = {x:0, y:0};
	pos.y = (plinkoBonusSettings.row+3) * (plinkoBonusSettings.size);
	pos.y = -(pos.y/2);
	pos.y += 50;
	
	for(var n=0; n<plinkoBonusSettings.row; n++){
		var totalPin = plinkoBonusSettings.column;
		var rotateNum = rotateArr[0];
		var centerCon = true;
		if(!isEven(n)){
			totalPin--;
			rotateNum = rotateArr[1];
			centerCon = false;
		}

		var totalW = totalPin * (plinkoBonusSettings.size);
		pos.x = -(totalW/2);
		
		var sideW = plinkoBonusSettings.size;
		var sideH = gameData.sideH;

		var newSideL = new createjs.Shape();
		var centerPos = getCenterPosition(pos.x, pos.y, pos.x + (plinkoBonusSettings.size/2), pos.y + plinkoBonusSettings.size);
		if(!centerCon){
			centerPos = getCenterPosition(pos.x, pos.y, pos.x - (plinkoBonusSettings.size/2), pos.y + plinkoBonusSettings.size);
		}
		newSideL.graphics.beginFill("blue").drawRect(-(sideW/2), -(sideH/2), sideW, sideH);
		newSideL.x = centerPos.x - (sideH/2);
		newSideL.y = centerPos.y;
		newSideL.rotation = rotateNum;
		plinkoBonusGuideContainer.addChild(newSideL);

		createPhysicPlane(sideW, sideH, newSideL.x, newSideL.y, newSideL.rotation, 'side');

		if(n == 0){
			var newTopL = new createjs.Shape();
			newTopL.graphics.beginFill("blue").drawRect(-(sideW/2), -(sideH/2), sideW, sideH);
			newTopL.x = pos.x;
			newTopL.y = pos.y - (plinkoBonusSettings.size/2);
			newTopL.rotation = -90;
			plinkoBonusGuideContainer.addChild(newTopL);

			//buttons
			var buttonPos = {x:0, y:0};
			buttonPos.x = pos.x;
			buttonPos.y = pos.y;
			
			gameData.dropAreaBonus = totalPin;
			for(var p=0; p<gameData.dropAreaBonus; p++){
				$.dropBonus[p] = new createjs.Shape();
				$.dropBonus[p].hitArea = new createjs.Shape(new createjs.Graphics().beginFill("green").drawRect(-(sideW/2), -(sideW + (sideW/2)), sideW, sideW * 2));
				$.dropBonus[p].x = buttonPos.x + (plinkoBonusSettings.size/2);
				$.dropBonus[p].y = buttonPos.y - (plinkoBonusSettings.size/2);
				plinkoBonusItemContainer.addChild($.dropBonus[p]);

				$.arrowBonus[p] = itemArrowBonus.clone();
				$.arrowBonus[p].visible = true;
				$.arrowBonus[p].x = $.dropBonus[p].x;
				$.arrowBonus[p].y -= (plinkoBonusSettings.size/2);
				stateBonusContainer.addChild($.arrowBonus[p]);

				buttonPos.x += plinkoBonusSettings.size

				//events
				$.dropBonus[p].cursor = "pointer";
				$.dropBonus[p].addEventListener("click", function(evt) {
					dropBall(evt.currentTarget);
				});

				$.dropBonus[p].cursor = "pointer";
				$.dropBonus[p].addEventListener("mouseover", function(evt) {
					toggleBallFall(evt.currentTarget, true);
				});

				$.dropBonus[p].cursor = "pointer";
				$.dropBonus[p].addEventListener("mouseout", function(evt) {
					toggleBallFall(evt.currentTarget, false);
				});
			}

			stateBonusContainer.y = buttonPos.y - (plinkoBonusSettings.size);
		}

		pos.x += plinkoBonusSettings.size;

		//movement
		var movePos = {x:0, y:0};
		movePos.x = pos.x - (plinkoBonusSettings.size/2);
		movePos.y = pos.y;
		
		gameData.moveBonusArray.push([]);
		for(var p=0; p<totalPin; p++){
			$.moveBonus[n+'_'+p] = new createjs.Shape();
			$.moveBonus[n+'_'+p].graphics.beginFill('red').drawCircle(0, 0, plinkoBonusSettings.pinSize/2);
			$.moveBonus[n+'_'+p].x = movePos.x;
			$.moveBonus[n+'_'+p].y = movePos.y;

			movePos.x += plinkoBonusSettings.size;
			plinkoBonusGuideContainer.addChild($.moveBonus[n+'_'+p]);

			gameData.moveBonusArray[n].push(p);
		}

		for(var p=0; p<totalPin-1; p++){
			var newPot = new createjs.Shape();
			newPot.graphics.beginFill(plinkoBonusSettings.pinColor).drawCircle(0, 0, plinkoBonusSettings.pinSize);
			newPot.x = pos.x;
			newPot.y = pos.y;
			
			pos.x += plinkoBonusSettings.size;
			plinkoBonusItemContainer.addChild(newPot);

			createPhysicCircle(plinkoBonusSettings.pinSize, newPot.x, newPot.y);
		}

		rotateNum = rotateArr[1];
		if(!isEven(n)){
			rotateNum = rotateArr[0];
		}

		var newSideR = new createjs.Shape();
		var centerPos = getCenterPosition(pos.x, pos.y, pos.x - (plinkoBonusSettings.size/2), pos.y + plinkoBonusSettings.size);
		if(!centerCon){
			centerPos = getCenterPosition(pos.x, pos.y, pos.x + (plinkoBonusSettings.size/2), pos.y + plinkoBonusSettings.size);
		}
		newSideR.graphics.beginFill("blue").drawRect(-(sideW/2), -(sideH/2), sideW, sideH);
		newSideR.x = centerPos.x + (sideH/2);
		newSideR.y = centerPos.y;
		newSideR.rotation = rotateNum;
		plinkoBonusGuideContainer.addChild(newSideR);

		createPhysicPlane(sideW, sideH, newSideR.x, newSideR.y, newSideR.rotation, 'side');

		if(n == 0){
			var newTopR = new createjs.Shape();
			newTopR.graphics.beginFill("blue").drawRect(-(sideW/2), -(sideH/2), sideW, sideH);
			newTopR.x = pos.x;
			newTopR.y = pos.y - (plinkoBonusSettings.size/2);
			newTopR.rotation = -90;
			plinkoBonusGuideContainer.addChild(newTopR);
		}

		pos.y += plinkoBonusSettings.size;
	}

	//prizes
	gameData.moveBonusArray.push([]);
	var totalPin = plinkoBonusSettings.column;
	if(!isEven(n)){
		totalPin--;
	}
	
	var sideBottomH = gameData.bottomH;
	var sidePrizeW = sideW + (plinkoBonusSettings.size/2)
	var prizePos = {x:0, y:0};
	var totalW = totalPin * (plinkoBonusSettings.size);
	var prizeSpace = totalW/plinkoBonusSettings.prizes.length;
	prizePos.x = -(totalW/2);
	prizePos.y = pos.y;

	var prizeNameW = prizeSpace;
	var prizeNameH = plinkoBonusSettings.size * 2;

	for(var p=0; p<plinkoBonusSettings.prizes.length; p++){
		$.moveBonus[n+'_'+p] = new createjs.Shape();
		$.moveBonus[n+'_'+p].graphics.beginFill("red").drawCircle(0, 0, plinkoBonusSettings.pinSize/2);
		$.moveBonus[n+'_'+p].x = prizePos.x + (prizeSpace/2);
		$.moveBonus[n+'_'+p].y = prizePos.y;

		plinkoBonusGuideContainer.addChild($.moveBonus[n+'_'+p]);
		gameData.moveBonusArray[n].push(p);

		$.prizeBonus['bottom'+p] = new createjs.Shape();
		$.prizeBonus['bottom'+p].graphics.beginFill(plinkoBonusSettings.prizeBorderColor).drawRect(-(prizeSpace/2), -(sideBottomH/2), prizeSpace, sideBottomH);
		$.prizeBonus['bottom'+p].x = prizePos.x + (prizeSpace/2);
		$.prizeBonus['bottom'+p].y = prizePos.y + (plinkoBonusSettings.size) + (plinkoBonusSettings.size/2);
		plinkoBonusItemContainer.addChild($.prizeBonus['bottom'+p]);

		var newPrizeL = new createjs.Shape();
		newPrizeL.graphics.beginFill(plinkoBonusSettings.prizeBorderColor).drawRect(-(sidePrizeW/2), -(sideH/2), sidePrizeW, sideH);
		newPrizeL.x = prizePos.x
		newPrizeL.y = prizePos.y + (plinkoBonusSettings.size/2)+ (plinkoBonusSettings.size/2);
		newPrizeL.rotation = 90;
		plinkoBonusItemContainer.addChild(newPrizeL);

		var newPrizeR = new createjs.Shape();
		newPrizeR.graphics.beginFill(plinkoBonusSettings.prizeBorderColor).drawRect(-(sidePrizeW/2), -(sideH/2), sidePrizeW, sideH);
		newPrizeR.x = prizePos.x + prizeSpace;
		newPrizeR.y = prizePos.y + (plinkoBonusSettings.size/2)+ (plinkoBonusSettings.size/2);
		newPrizeR.rotation = 90;
		plinkoBonusItemContainer.addChild(newPrizeR);

		//prize name
		$.prizeBonus['bg'+p] = new createjs.Shape();
		$.prizeBonus['bg'+p].graphics.beginStroke(plinkoBonusSettings.prizeBorderColor).setStrokeStyle(7).beginFill(plinkoBonusSettings.prizes[p].bgColor).drawRect(-(prizeNameW/2), -(prizeNameH/2), prizeNameW, prizeNameH);
		$.prizeBonus['bg'+p].x = prizePos.x + (prizeSpace/2);
		$.prizeBonus['bg'+p].y = prizePos.y + (plinkoBonusSettings.size * 2) + (plinkoBonusSettings.size/2);

		$.prizeBonus['bgWin'+p] = new createjs.Shape();
		$.prizeBonus['bgWin'+p].graphics.beginFill(plinkoBonusSettings.prizes[p].bgWinColor).drawRect(-(prizeNameW/2), -(prizeNameH/2), prizeNameW, prizeNameH);
		$.prizeBonus['bgWin'+p].x = $.prizeBonus['bg'+p].x;
		$.prizeBonus['bgWin'+p].y = $.prizeBonus['bg'+p].y;

		var prizeImage = false;
		if(plinkoBonusSettings.prizes[p].image != undefined){
			if(plinkoBonusSettings.prizes[p].image != ''){
				prizeImage = true;

				$.prizeBonus['name'+p] = new createjs.Bitmap(loader.getResult('prizeBonus'+p));
				centerReg($.prize['name'+p]);
				$.prizeBonus['name'+p].x = $.prizeBonus['bg'+p].x + plinkoBonusSettings.prizes[p].x;
				$.prizeBonus['name'+p].y = $.prizeBonus['bg'+p].y + plinkoBonusSettings.prizes[p].y;
			}
		}

		if(!prizeImage){
			$.prizeBonus['name'+p] = new createjs.Text();
			$.prizeBonus['name'+p].font = plinkoBonusSettings.prizes[p].fontSize + "px azonixregular";
			$.prizeBonus['name'+p].lineHeight = plinkoBonusSettings.prizes[p].lineHeight;
			$.prizeBonus['name'+p].color = plinkoBonusSettings.prizes[p].color;
			$.prizeBonus['name'+p].textAlign = "center";
			$.prizeBonus['name'+p].textBaseline='alphabetic';
			$.prizeBonus['name'+p].text = plinkoBonusSettings.prizes[p].text;
			$.prizeBonus['name'+p].x = $.prizeBonus['bg'+p].x + plinkoBonusSettings.prizes[p].x;
			$.prizeBonus['name'+p].y = $.prizeBonus['bg'+p].y + plinkoBonusSettings.prizes[p].y;
		}
		
		plinkoBonusItemContainer.addChild($.prizeBonus['bg'+p], $.prizeBonus['bgWin'+p], $.prizeBonus['name'+p]);

		prizePos.x += prizeSpace;

		createPhysicPlane(prizeSpace, sideBottomH, $.prizeBonus['bottom'+p].x, $.prizeBonus['bottom'+p].y, $.prizeBonus['bottom'+p].rotation, 'bottom');
		createPhysicPlane(sidePrizeW, sideH, newPrizeL.x, newPrizeL.y, newPrizeL.rotation, 'side');
		createPhysicPlane(sidePrizeW, sideH, newPrizeR.x, newPrizeR.y, newPrizeR.rotation, 'side');
	}

	gameData.ballShapeBonus = new createjs.Shape();
	gameData.ballShapeBonus.graphics.beginFill(plinkoBonusSettings.ballColor).drawCircle(0, 0, plinkoBonusSettings.ballSize);
	gameData.ballShapeBonus.x = 0;
	gameData.ballShapeBonus.y = 0;
	
	plinkoBonusItemContainer.addChild(gameData.ballShapeBonus);
	createPhysicBall(plinkoBonusSettings.ballSize, gameData.ballShapeBonus.x, gameData.ballShapeBonus.y);
}

/*!
 * 
 * START GAME - This is the function that runs to start play game
 * 
 */

function startGame(){
	gameData.paused = false;
	plinkoCoinContainer.removeAllChildren();
	plinkoCoinTextContainer.removeAllChildren();

	plinkoGuideContainer.visible = false;
	plinkoBonusGuideContainer.visible = false;
	chanceContainer.visible = false;
	betContainer.visible = false;

	chanceContainer.alpha = 1;
	betContainer.alpha = 1;
	dollarContainer.alpha = 1;
	dollarContainer.x = canvasW/100 * 30;

	//memberpayment
	playerData.chance = gameData.startChance = gameSettings.totalChance;
	playerData.score = playerData.point = 0;
	
	if(gameSettings.gamePlayType){		
		//memberpayment
		if(typeof memberData != 'undefined' && memberSettings.enableMembership){
			playerData.point = playerData.score = memberData.point;
			playerData.chance = gameData.startChance = memberData.chance;
		}
		
		chanceContainer.visible = true;
	}else{
		playerData.score = playerData.point = gameSettings.betPoint;
		playerData.bet = 0;
		betData.betNumber = 0;
		betData.betNumberPlus = 0;
		
		betContainer.visible = true;
		
		//memberpayment
		if(typeof memberData != 'undefined' && memberSettings.enableMembership){
			playerData.score = playerData.point = memberData.point;
		}
	}

	plinkoContainer.x = canvasW/2;
	plinkoContainer.y = canvasH/2;

	plinkoBonusContainer.x = canvasW/2;
	plinkoBonusContainer.x += canvasW;
	plinkoBonusContainer.y = canvasH/2;

	physicsData.currentWorld = 0;
	gameData.dropCon = false;
	gameData.resultCon = false;
	gameData.resultBonusCon = false;
	gameData.ballShape.visible = false;
	gameData.ballShapeBonus.visible = false;
	gameData.bonusRound = false;
	itemBall.visible = false;
	itemBallBonus.visible = false;
	itemBonus.visible = false;

	stateContainer.tween = {startSpeed:.3, endSpeed:.3, startDelay:0, endDelay:0, startAlpha:.3, endAlpha:1, loop:true};
	startAnimate(stateContainer);

	stateBonusContainer.tween = {startSpeed:.3, endSpeed:.3, startDelay:0, endDelay:0, startAlpha:.3, endAlpha:1, loop:true};
	startAnimate(stateBonusContainer);

	createCoins();
	switchBall();
	toggleGameStat();
	toggleDropArea(true);
	animateLight(0);
	updateStat();
	playSound('soundStart');
}

 /*!
 * 
 * STOP GAME - This is the function that runs to stop play game
 * 
 */
function stopGame(){
	gameData.paused = true;
	pausedPhysics(0, true);
	pausedPhysics(1, true);

	TweenMax.killAll();
}

/*!
 * 
 * SAVE GAME - This is the function that runs to save game
 * 
 */
function saveGame(score){
	if ( typeof toggleScoreboardSave == 'function' ) { 
		$.scoreData.score = score;
		if(typeof type != 'undefined'){
			$.scoreData.type = type;	
		}
		toggleScoreboardSave(true);
	}

	/*$.ajax({
      type: "POST",
      url: 'saveResults.php',
      data: {score:score},
      success: function (result) {
          console.log(result);
      }
    });*/
}

/*!
 * 
 * TOGGLE GAME STAT - This is the function that runs to toggle game stat
 * 
 */
function toggleGameStat(stat){
	TweenMax.killTweensOf(statusTxt);

	statusTxt.visible = false;
	statusBonusTxt.visible = false;

	for(var p=0; p<gameData.dropArea; p++){
		$.arrow[p].visible = false;
	}

	for(var p=0; p<gameData.dropAreaBonus; p++){
		$.arrowBonus[p].visible = false;
	}

	if(stat == undefined){
		for(var p=0; p<gameData.dropArea; p++){
			$.arrow[p].visible = true;
		}

		for(var p=0; p<gameData.dropAreaBonus; p++){
			$.arrowBonus[p].visible = true;
		}
	}else{
		statusTxt.visible = true;
		statusTxt.text = stat;

		statusBonusTxt.visible = true;
		statusBonusTxt.text = stat;
	}
}

/*!
 * 
 * LIGHT ANIMATION - This is the function that runs to animate light
 * 
 */
function startAnimate(obj){
	TweenMax.to(obj, obj.tween.startSpeed, {delay:obj.tween.startDelay, alpha:obj.tween.startAlpha, overwrite:true, onComplete:function(){
		TweenMax.to(obj, obj.tween.endSpeed, {delay:obj.tween.endDelay, alpha:obj.tween.endAlpha, overwrite:true, onComplete:function(){
			if(obj.tween.loop){
				startAnimate(obj)
			}
		}});
	}});
}

function stopAnimate(obj){
	obj.alpha = 0;
	TweenMax.killTweensOf(obj);
}

function animateLight(state){
	gameData.lightState = state;
	gameData.lightStateBonus = state;

	for(var n=0; n<plinkoSettings.prizes.length; n++){
		$.prize['bgWin'+n].alpha = 0;
	}

	for(var n=0; n<plinkoBonusSettings.prizes.length; n++){
		$.prizeBonus['bgWin'+n].alpha = 0;
	}

	TweenMax.killTweensOf(plinkoItemContainer);
	TweenMax.killTweensOf(plinkoBonusItemContainer);

	loopAnimateLight();
	loopAnimateLightBonus();
}

function loopAnimateLight(){
	if(gameData.lightState == 0){
		var delayNum = .2;
		var delayCountNum = delayNum;

		for(var n=0; n<plinkoSettings.prizes.length; n++){
			$.prize['bgWin'+n].tween = {startSpeed:.2, endSpeed:.2, startDelay:0, endDelay:0, startAlpha:1, endAlpha:0, loop:false}
			TweenMax.to($.prize['bgWin'+n], 0, {delay:delayCountNum, ease:Bounce.easeOut, overwrite:true, onComplete:startAnimate, onCompleteParams:[$.prize['bgWin'+n]]});
			delayCountNum += delayNum;
		}

		gameData.lightState = 1;
		TweenMax.to(plinkoItemContainer, delayCountNum, {overwrite:true, onComplete:loopAnimateLight});
	}else if(gameData.lightState == 1){
		var delayNum = .2;
		var delayCountNum = delayNum;

		for(var n=plinkoSettings.prizes.length-1; n>=0; n--){
			$.prize['bgWin'+n].tween = {startSpeed:.2, endSpeed:.2, startDelay:0, endDelay:0, startAlpha:1, endAlpha:0, loop:false}
			TweenMax.to($.prize['bgWin'+n], 0, {delay:delayCountNum, ease:Bounce.easeOut, overwrite:true, onComplete:startAnimate, onCompleteParams:[$.prize['bgWin'+n]]});

			delayCountNum += delayNum;
		}

		gameData.lightState = 2;
		TweenMax.to(plinkoItemContainer, delayCountNum, {overwrite:true, onComplete:loopAnimateLight});
	}else if(gameData.lightState == 2){
		for(var n=0; n<plinkoSettings.prizes.length; n++){
			$.prize['bgWin'+n].tween = {startSpeed:.2, endSpeed:.2, startDelay:.5, endDelay:.5, startAlpha:1, endAlpha:0, loop:true}
			if(isEven(n)){
				$.prize['bgWin'+n].tween = {startSpeed:.2, endSpeed:.2, startDelay:.5, endDelay:.5, startAlpha:0, endAlpha:1, loop:true}
			}
			startAnimate($.prize['bgWin'+n]);
		}

		gameData.lightState = 3;
		TweenMax.to(plinkoItemContainer, 6, {overwrite:true, onComplete:loopAnimateLight});
	}else if(gameData.lightState == 3){
		for(var n=0; n<plinkoSettings.prizes.length; n++){
			$.prize['bgWin'+n].tween = {startSpeed:.2, endSpeed:.2, startDelay:0, endDelay:0, startAlpha:0, endAlpha:0, loop:false}
			startAnimate($.prize['bgWin'+n]);
		}

		gameData.lightState = 0;
		TweenMax.to(plinkoItemContainer, 1, {overwrite:true, onComplete:loopAnimateLight});
	}
}

function loopAnimateLightBonus(){
	if(gameData.lightStateBonus == 0){
		var delayNum = .2;
		var delayCountNum = delayNum;

		for(var n=0; n<plinkoBonusSettings.prizes.length; n++){
			$.prizeBonus['bgWin'+n].tween = {startSpeed:.2, endSpeed:.2, startDelay:0, endDelay:0, startAlpha:1, endAlpha:0, loop:false}
			TweenMax.to($.prizeBonus['bgWin'+n], 0, {delay:delayCountNum, ease:Bounce.easeOut, overwrite:true, onComplete:startAnimate, onCompleteParams:[$.prizeBonus['bgWin'+n]]});
			delayCountNum += delayNum;
		}

		gameData.lightStateBonus = 1;
		TweenMax.to(plinkoBonusItemContainer, delayCountNum, {overwrite:true, onComplete:loopAnimateLightBonus});
	}else if(gameData.lightStateBonus == 1){
		var delayNum = .2;
		var delayCountNum = delayNum;

		for(var n=plinkoBonusSettings.prizes.length-1; n>=0; n--){
			$.prizeBonus['bgWin'+n].tween = {startSpeed:.2, endSpeed:.2, startDelay:0, endDelay:0, startAlpha:1, endAlpha:0, loop:false}
			TweenMax.to($.prizeBonus['bgWin'+n], 0, {delay:delayCountNum, ease:Bounce.easeOut, overwrite:true, onComplete:startAnimate, onCompleteParams:[$.prizeBonus['bgWin'+n]]});

			delayCountNum += delayNum;
		}

		gameData.lightStateBonus = 2;
		TweenMax.to(plinkoBonusItemContainer, delayCountNum, {overwrite:true, onComplete:loopAnimateLightBonus});
	}else if(gameData.lightStateBonus == 2){
		for(var n=0; n<plinkoBonusSettings.prizes.length; n++){
			$.prizeBonus['bgWin'+n].tween = {startSpeed:.2, endSpeed:.2, startDelay:.5, endDelay:.5, startAlpha:1, endAlpha:0, loop:true}
			if(isEven(n)){
				$.prizeBonus['bgWin'+n].tween = {startSpeed:.2, endSpeed:.2, startDelay:.5, endDelay:.5, startAlpha:0, endAlpha:1, loop:true}
			}
			startAnimate($.prizeBonus['bgWin'+n]);
		}

		gameData.lightStateBonus = 3;
		TweenMax.to(plinkoBonusItemContainer, 6, {overwrite:true, onComplete:loopAnimateLightBonus});
	}else if(gameData.lightStateBonus == 3){
		for(var n=0; n<plinkoBonusSettings.prizes.length; n++){
			$.prizeBonus['bgWin'+n].tween = {startSpeed:.2, endSpeed:.2, startDelay:0, endDelay:0, startAlpha:0, endAlpha:0, loop:false}
			startAnimate($.prizeBonus['bgWin'+n]);
		}

		gameData.lightStateBonus = 0;
		TweenMax.to(plinkoBonusItemContainer, 1, {overwrite:true, onComplete:loopAnimateLightBonus});
	}
}

function animateLightFocus(bonus){
	var targetContainer = plinkoItemContainer;
	var targetPrizeArr = plinkoSettings.prizes;
	var targetPrize = $.prize;

	if(bonus){
		targetContainer = plinkoBonusItemContainer;
		targetPrizeArr = plinkoBonusSettings.prizes;
		targetPrize = $.prizeBonus;
	}

	TweenMax.killTweensOf(targetContainer);
	for(var n=0; n<targetPrizeArr.length; n++){
		stopAnimate(targetPrize['bgWin'+n]);
	}

	targetPrize['bgWin'+gameData.resultIndex].tween = {startSpeed:.2, endSpeed:.2, startDelay:0, endDelay:0, startAlpha:1, endAlpha:0, loop:true};
	startAnimate(targetPrize['bgWin'+gameData.resultIndex]);
}

/*!
 * 
 * CREATE COIN - This is the function that runs to create coin
 * 
 */
function createCoins(){
	gameData.extraCoin = 0;
	shuffle(gameData.coinArray);

	plinkoCoinContainer.removeAllChildren();
	gameData.totalCoins = (plinkoSettings.row * plinkoSettings.column)/100 * gameSettings.coinPercent;

	for(var n=0; n<gameData.totalCoins; n++){
		if(n < gameData.coinArray.length){
			var targetR = gameData.coinArray[n].r;
			var targetC = gameData.coinArray[n].c;

			$.coins[n] = itemCoin.clone();
			$.coins[n].visible = true;
			$.coins[n].x = $.move[targetR+'_'+targetC].x;
			$.coins[n].y = $.move[targetR+'_'+targetC].y;
			$.coins[n].prizeIndex = Math.floor(Math.random()*coinSettings.length);
			$.coins[n].alpha = 0;

			TweenMax.to($.coins[n], .5, {delay:.5, alpha:1, overwrite:true});
			plinkoCoinContainer.addChild($.coins[n]);
		}
	}
}

function createCoinText(obj){
	var coinValue = coinSettings[obj.prizeIndex].value;

	var newText = new createjs.Text();
	newText.font = "20px azonixregular";
	newText.color = "#fff";
	newText.textAlign = "center";
	newText.textBaseline='alphabetic';
	newText.text = textDisplay.collectCoin.replace('[NUMBER]', coinValue);
	newText.x = obj.x;
	newText.y = obj.y;

	TweenMax.to(newText, .7, {y:newText.y-30, alpha:0, ease:Circ.easeIn, overwrite:true});
	plinkoCoinTextContainer.addChild(newText);

	gameData.extraCoin += coinValue;
}

/*!
 * 
 * TOGGLE BALL - This is the function that runs to toggle ball fall
 * 
 */
function toggleBallFall(target, con){
	if(gameData.dropCon){
		return;
	}

	pausedPhysics(0, true);
	pausedPhysics(1, true);

	if(con){
		gameData.targetShapeBall.x = gameData.targetBall.x = target.x;
		gameData.targetShapeBall.y = gameData.targetBall.y = target.y;
		gameData.targetShapeBall.rotation = gameData.targetBall.rotation = 0;
	}

	gameData.targetShapeBall.visible = gameData.targetBall.visible = con;
}

function switchBall(){
	gameData.targetShapeBall = gameData.ballShape;
	gameData.targetBall = itemBall;

	if(gameData.bonusRound){
		gameData.targetShapeBall = gameData.ballShapeBonus;
		gameData.targetBall = itemBallBonus;
	}
}

/*!
 * 
 * DROP BALL - This is the function that runs to drop ball
 * 
 */
function dropBall(target){
	if(gameData.dropCon){
		return;
	}

	if(!gameSettings.gamePlayType && playerData.bet == 0 && !gameData.bonusRound){
		toggleGameStat(textDisplay.minBet);
		return;
	}

	gameData.targetShapeBall.visible = gameData.targetBall.visible = true;
	
	toggleGameStat(textDisplay.playing);
	toggleDropArea(false);
	animateLight(2);

	if(!gameSettings.enableFixedResult){
		var randomX = randomIntFromInterval(-5, 5);

		if(!gameData.bonusRound){
			dropPhysicsBall(0, target.x + randomX, target.y);
			pausedPhysics(0, false);
		}else{
			dropPhysicsBall(1, target.x + randomX, target.y);
			pausedPhysics(1, false);
		}
	}else{
		if(gameSettings.enablePercentage){
			if(!gameData.bonusRound && gameData.fixedResult == -1){
				gameData.fixedResult = getResultOnPercent();
			}
			
			if(gameData.bonusRound && gameData.fixedBonusResult == -1){
				gameData.fixedResult = getBonusResultOnPercent();
			}
		}

		gameData.targetShapeBall.x = target.x;
		gameData.targetShapeBall.y = target.y;
		generateMovePath();
	}

	gameData.dropCon = true;
	gameData.resultCon = false;
	gameData.resultBonusCon = false;

	if(!gameData.bonusRound){
		

		playerData.chance--;
		playerData.chance = playerData.chance < 0 ? 0 : playerData.chance;
			
		//memberpayment
		if(typeof memberData != 'undefined' && memberSettings.enableMembership){
			updateUserPoint();
		}
	}

	updateStat();
}

function toggleDropArea(con){
	for(var p=0; p<gameData.dropArea; p++){
		$.drop[p].visible = con;
	}

	for(var p=0; p<gameData.dropAreaBonus; p++){
		$.dropBonus[p].visible = con;
	}
}

/*!
 * 
 * GENERATE PATH - This is the function that runs to generate path
 * 
 */
function generateMovePath(){
	gameData.finalMoveArray = [];

	var startPos = {x:gameData.targetShapeBall.x, y:gameData.targetShapeBall.y};
	gameData.moveColumn = -1;

	var targetMoveArray = gameData.moveArray;
	if(gameData.bonusRound){
		targetMoveArray = gameData.moveBonusArray;
	}

	for(var n=0; n<targetMoveArray.length; n++){
		findMovePath(gameData.targetShapeBall, n);
	}

	gameData.targetShapeBall.x = startPos.x;
	gameData.targetShapeBall.y = startPos.y;
	gameData.moveIndex = 0;
	startBallMove();
}

function findMovePath(targetBall, row){
	var possibleMove = [];

	var targetMoveArray = gameData.moveArray;
	var thisFixedResult = gameData.fixedResult;
	var plinkoSize = plinkoSettings.size;
	var ballSize = plinkoSettings.ballSize;
	var thisMove = $.move;

	if(gameData.bonusRound){
		targetMoveArray = gameData.moveBonusArray;
		thisFixedResult = gameData.fixedBonusResult;
		thisMove = $.moveBonus;
	}

	for(var p=0; p<targetMoveArray[row].length; p++){
		var getDistance = getDistanceByValue(targetBall.x, targetBall.y, thisMove[row+'_'+p].x, thisMove[row+'_'+p].y);
		possibleMove.push({distance:getDistance, column:p});
	}

	sortOnObject(possibleMove, 'distance', false);
	
	var selectedColumn = possibleMove[0].column;
	var randomDirection = false;
	if(gameData.fixedResult != -1 && row != 0){
		var moveNum = targetMoveArray.length - row;
		var safeDistance = (gameData.moveColumn * 2) + 1;
		if(safeDistance >= moveNum){
			randomDirection = true;
		}
	}

	if(row != 0 && possibleMove[0].distance == possibleMove[1].distance){
		if(thisFixedResult != -1 && randomDirection){
			var lastMovePoint = targetMoveArray.length-1;
			var targetPrize = thisMove[lastMovePoint+'_'+thisFixedResult];

			var optionA = thisMove[row+'_'+possibleMove[0].column];
			var optionB = thisMove[row+'_'+possibleMove[1].column];
			
			var distanceA = getDistanceByValue(optionA.x, optionA.y, targetPrize.x, targetPrize.y);
			var distanceB = getDistanceByValue(optionB.x, optionB.y, targetPrize.x, targetPrize.y);

			if(distanceB > distanceA){
				selectedColumn = possibleMove[0].column;
			}else{
				selectedColumn = possibleMove[1].column;
			}
		}else{
			if(randomBoolean()){
				selectedColumn = possibleMove[1].column;
			}
		}
	}

	if(thisFixedResult != -1){
		gameData.moveColumn = Math.abs(selectedColumn - thisFixedResult);
	}

	targetBall.x = thisMove[row+'_'+selectedColumn].x;
	targetBall.y = thisMove[row+'_'+selectedColumn].y;
	gameData.finalMoveArray.push({x:thisMove[row+'_'+selectedColumn].x, y:thisMove[row+'_'+selectedColumn].y});

	if(row == targetMoveArray.length-1){
		var bottomH = gameData.bottomH/2;
		var bottomY = plinkoSize + (plinkoSize/2);

		gameData.finalMoveArray.push({x:thisMove[row+'_'+selectedColumn].x, y:thisMove[row+'_'+selectedColumn].y + (bottomY - (bottomH + ballSize))});
	}

}

/*!
 * 
 * MOVE BALL - This is the function that runs to move ball
 * 
 */
function startBallMove(){
	var rotateNum = randomIntFromInterval(-90, 90);
	var finalRotate = gameData.targetShapeBall.rotation + rotateNum;

	if(gameData.moveIndex == gameData.finalMoveArray.length-1){
		setTimeout(function(){ playHitSound(); }, 250);
		TweenMax.to(gameData.targetShapeBall, .5, {x:gameData.finalMoveArray[gameData.moveIndex].x, y:gameData.finalMoveArray[gameData.moveIndex].y, rotation:finalRotate, ease:Bounce.easeOut, overwrite:true, onComplete:ballMoveComplete});
	}else{
		TweenMax.to(gameData.targetShapeBall, .3, {x:gameData.finalMoveArray[gameData.moveIndex].x, y:gameData.finalMoveArray[gameData.moveIndex].y, rotation:finalRotate, ease:Sine.easeIn, overwrite:true, onComplete:ballMoveComplete});
	}
}

function ballMoveComplete(){
	gameData.moveIndex++;
	if(gameData.moveIndex < gameData.finalMoveArray.length){
		playHitSound();
		startBallMove();
	}else{
		findGameResult();
	}
}

function playHitSound(){
	var randomHitSound = Math.round(Math.random()*2)+1;
	playSound('soundHit'+randomHitSound);	
}

/*!
 * 
 * FIND RESULT - This is the function that runs to find result
 * 
 */
function findGameResult(){
	var resultArr = [];
	var targetPrizeArr = plinkoSettings.prizes;
	var targetPrize = $.prize

	if(gameData.bonusRound){
		targetPrizeArr = plinkoBonusSettings.prizes;
		targetPrize = $.prizeBonus;
	}
	
	for(var n=0; n<targetPrizeArr.length; n++){
		var getDistance = 0;
		getDistance = getDistanceByValue(gameData.targetShapeBall.x, gameData.targetShapeBall.y, targetPrize['bottom'+n].x, targetPrize['bottom'+n].y);
		resultArr.push({distance:getDistance, index:n});
	}

	sortOnObject(resultArr, 'distance', false);
	gameData.resultIndex = resultArr[0].index;

	if(!gameData.bonusRound){
		checkWinPoint();
	}else{
		checkWinBonusPoint();
	}
}

/*!
 * 
 * CHECK WIN POINT - This is the function that runs to check win point
 * 
 */
function checkWinPoint(){
	if(gameData.dropCon && !gameData.resultCon){
		gameData.resultCon = true;

		var winPoint = plinkoSettings.prizes[gameData.resultIndex].value;
		var bonusRound = plinkoSettings.prizes[gameData.resultIndex].bonus;
		bonusRound = bonusRound == undefined ? false : bonusRound;

		if(!gameSettings.gamePlayType){
			playerData.score -= playerData.bet;
			playerData.point = playerData.score;
			betData.betNumber = betData.betNumberPlus = 0;
		}

		if(!gameSettings.gamePlayType){
			winPoint = winPoint * playerData.bet;
			playerData.bet = 0;
		}
		
		if(bonusRound){
			//bonus
			if(winPoint > 0){
				winPoint += gameData.extraCoin;

				toggleGameStat(textDisplay.won.replace('[NUMBER]', addCommas(Math.floor(winPoint))));
				playerData.score += winPoint;
				TweenMax.to(playerData, 1, {point:playerData.score, overwrite:true, onUpdate:updateStat});
			}

			updateStat();
			toggleGameStat(textDisplay.bonusRound);
			displayBonusText();
		}else if(winPoint > 0){
			winPoint += gameData.extraCoin;

			//win
			toggleGameStat(textDisplay.won.replace('[NUMBER]', addCommas(Math.floor(winPoint))));
			playerData.score += winPoint;
			TweenMax.to(playerData, 1, {point:playerData.score, overwrite:true, onUpdate:updateStat});
			playSound('soundWin');
		}else{
			//no win
			toggleGameStat(textDisplay.lose);
			playSound('soundLose');
			updateStat();
		}

		animateLightFocus(false);
		if(!bonusRound){
			TweenMax.to(statusTxt, 5, {overwrite:true, onComplete:function(){
				toggleGameStat();
			}});
			checkGameEnd();
		}
	}
}

function checkWinBonusPoint(){
	if(gameData.dropCon && !gameData.resultBonusCon){
		gameData.resultBonusCon = true;

		var winPoint = plinkoBonusSettings.prizes[gameData.resultIndex].value;		
		if(winPoint > 0){
			//win
			toggleGameStat(textDisplay.won.replace('[NUMBER]', addCommas(Math.floor(winPoint))));
			playerData.score += winPoint;
			TweenMax.to(playerData, 1, {point:playerData.score, overwrite:true, onUpdate:updateStat});
			playSound('soundWin');
		}else{
			//no win
			toggleGameStat(textDisplay.lose);
			playSound('soundLose');
			updateStat();
		}

		animateLightFocus(true);
		TweenMax.to(plinkoBonusContainer, 3, {overwrite:true, onComplete:function(){
			toggleGameStat();
			switchPlinkoBonus(false);
		}});
	}
}

function displayBonusText(){
	playSound('soundBonus');
	itemBonus.visible = true;
	itemBonus.alpha = 0;
	itemBonus.y = itemBonus.oriY + 50;

	TweenMax.to(itemBonus, 1, {alpha:1, y:itemBonus.oriY, ease:Expo.easeOut, overwrite:true, onComplete:function(){
		TweenMax.to(itemBonus, 1, {alpha:0, y:itemBonus.oriY - 50, ease:Expo.easeIn, overwrite:true, onComplete:function(){
			TweenMax.to(itemBonus, 0, {delay:.5, overwrite:true, onComplete:function(){
				itemBonus.visible = false;
				switchPlinkoBonus(true);
			}});
		}});
	}});
}

function switchPlinkoBonus(con){
	chanceContainer.visible = false;
	betContainer.visible = false;
	TweenMax.to(dollarContainer, .5, {x:canvasW/2, overwrite:true});

	pausedPhysics(0, true);
	pausedPhysics(1, true);

	var centerX = canvasW/2;
	var leftX = centerX - canvasW
	var rightX = centerX + canvasW
	
	gameData.bonusRound = con;
	switchBall();
	var tweenSpeed = .5;

	if(con){
		animateLight(0);
		gameData.ballShapeBonus.visible = itemBallBonus.visible = false;
		TweenMax.to(plinkoContainer, tweenSpeed, {x:leftX, overwrite:true, onComplete:switchPlinkoBonusComplete});
		TweenMax.to(plinkoBonusContainer, tweenSpeed, {x:centerX, overwrite:true});
	}else{
		TweenMax.to(dollarContainer, .5, {x:canvasW/100 * 30, overwrite:true});

		gameData.ballShape.visible = itemBall.visible = false;
		TweenMax.to(plinkoContainer, tweenSpeed, {x:centerX, overwrite:true, onComplete:switchPlinkoBonusComplete});
		TweenMax.to(plinkoBonusContainer, tweenSpeed, {x:rightX, overwrite:true});
	}
}

function switchPlinkoBonusComplete(){
	toggleGameStat();

	if(gameData.bonusRound){
		gameData.dropCon = false;
		toggleDropArea(true);
	}else{
		var targetHolder
		if(gameSettings.gamePlayType){		
			targetHolder = chanceContainer;
		}else{
			targetHolder = betContainer;
		}

		targetHolder.visible = true;
		targetHolder.alpha = 0;
		TweenMax.to(targetHolder, .5, {alpha:1, overwrite:true});
		checkGameEnd();
	}
}

/*!
 * 
 * GET RESULT - This is the function that runs to get result
 * 
 */
function getResult(prizeNum){
	if(prizeNum >= 0 && prizeNum < plinkoSettings.prizes.length){
		gameData.fixedResult = prizeNum;
	}else{
		gameData.fixedResult = -1;
	}
}

function getBonusResult(prizeNum){
	if(prizeNum >= 0 && prizeNum < plinkoBonusSettings.prizes.length){
		gameData.fixedBonusResult = prizeNum;
	}else{
		gameData.fixedBonusResult = -1;
	}
}

/*!
 * 
 * PERCENTAGE - This is the function that runs to create result percentage
 * 
 */
function createPercentage(){
	gameData.percentageArray = [];
	gameData.percentageBonusArray = [];
	
	//default
	for(var n=0; n<plinkoSettings.prizes.length; n++){
		if(!isNaN(plinkoSettings.prizes[n].percent)){
			if(plinkoSettings.prizes[n].percent > 0){
				for(var p=0; p<plinkoSettings.prizes[n].percent; p++){
					gameData.percentageArray.push(n);
				}
			}
		}
	}

	//bonus
	for(var n=0; n<plinkoBonusSettings.prizes.length; n++){
		if(!isNaN(plinkoBonusSettings.prizes[n].percent)){
			if(plinkoBonusSettings.prizes[n].percent > 0){
				for(var p=0; p<plinkoBonusSettings.prizes[n].percent; p++){
					gameData.percentageBonusArray.push(n);
				}
			}
		}
	}
}

function getResultOnPercent(){	
	shuffle(gameData.percentageArray);
	return gameData.percentageArray[0];
}

function getBonusResultOnPercent(){
	shuffle(gameData.percentageBonusArray);
	return gameData.percentageBonusArray[0];
}

/*!
 * 
 * ADD/DEDUCT BET NUMBER - This is the function that runs to add or deduct bet number
 * 
 */
function toggleBetNumber(con){
	if(gameData.dropCon){
		return;	
	}
	
	if(con == 'plus'){
		betData.betNumberPlus = gameSettings.minBet;
	}else if(con == 'minus'){
		betData.betNumberPlus = -(gameSettings.minBet);
	}else{
		betData.betNumberPlus = 0;	
	}
	
	if(con != undefined){
		betData.timer = betData.timerMax;
		loopBetNumber();
	}else{
		clearInterval(betData.interval);	
		betData.interval = null;
	}
}

function loopBetNumber(){
	clearInterval(betData.interval);
	betData.interval = setInterval(loopBetNumber, betData.timer);
	betData.timer-=100;
	betData.timer=betData.timer<betData.timerMin?betData.timerMin:betData.timer;
	
	updateBetNumber();
}

function updateBetNumber(){
	var availableCredit = playerData.score;
	betData.betNumber += betData.betNumberPlus;
	betData.betNumber = betData.betNumber <= 0 ? 0 : betData.betNumber;
	betData.betNumber = betData.betNumber >= gameSettings.maxBet ? gameSettings.maxBet : betData.betNumber;
	betData.betNumber = betData.betNumber >= availableCredit ? availableCredit : betData.betNumber;
	
	playerData.bet = betData.betNumber;
	playerData.point = playerData.score - playerData.bet;
	
	updateStat();
}

/*!
 * 
 * UPDATE STAT - This is the function that runs to update game stat
 * 
 */
function updateStat(){
	if(gameSettings.gamePlayType){
		chanceTxt.text = textDisplay.chance.replace('[NUMBER]', playerData.chance);
		dollarTxt.text = textDisplay.credit.replace('[NUMBER]', addCommas(Math.floor(playerData.point)));
	}else{
		dollarTxt.text = textDisplay.credit.replace('[NUMBER]', addCommas(Math.floor(playerData.point)));
		betTxt.text = textDisplay.bet.replace('[NUMBER]', addCommas(Math.floor(playerData.bet)));	
	}
}

/*!
 * 
 * LOOP UPDATE GAME - This is the function that runs to update game loop
 * 
 */
function updateGame(){
	updatePhysics();

	if(!gameData.paused){
		var targetBall = gameData.ballShape;
		itemBall.x = targetBall.x;
		itemBall.y = targetBall.y;
		itemBall.rotation = targetBall.rotation;

		var targetBallBonus = gameData.ballShapeBonus;
		itemBallBonus.x = targetBallBonus.x;
		itemBallBonus.y = targetBallBonus.y;
		itemBallBonus.rotation = targetBallBonus.rotation;
		
		if(gameData.dropCon && !gameData.bonusRound){
			//coins
			for(var n=0; n<gameData.totalCoins; n++){
				var getDistance = getDistanceByValue(targetBall.x, targetBall.y, $.coins[n].x, $.coins[n].y);
				if(getDistance <= (plinkoSettings.ballSize/100 * 150) && $.coins[n].visible){
					$.coins[n].visible = false;

					playSound('soundCoin');
					createCoinText($.coins[n]);
				}
			}
		}
	}
}

/*!
 * 
 * CHECK GAME END - This is the function that runs to check game end
 * 
 */
function checkGameEnd(){
	gameData.fixedResult = -1;
	gameData.fixedBonusResult = -1;
	
	gameData.dropCon = false;
	toggleDropArea(true);
	createCoins();

	if(gameSettings.gamePlayType){
		//memberpayment
		if(typeof memberData != 'undefined' && memberSettings.enableMembership){
			updateUserPoint();
		}

		if(playerData.chance <= 0){
			toggleGameStat(textDisplay.gameOver);
			toggleDropArea(false);
			TweenMax.to(dollarTxt, 3, {overwrite:true, onComplete:function(){
				goPage('result');
			}});
		}
	}else{
		//memberpayment
		if(typeof memberData != 'undefined' && memberSettings.enableMembership){
			playerData.point = playerData.score;
			updateUserPoint();
		}
		
		if(playerData.score <= 0){
			toggleGameStat(textDisplay.gameOver);
			toggleDropArea(false);
			TweenMax.to(dollarTxt, 3, {overwrite:true, onComplete:function(){
				goPage('result');
			}});
		}
	}
}

/*!
 * 
 * MILLISECONDS CONVERT - This is the function that runs to convert milliseconds to time
 * 
 */
function millisecondsToTimeGame(milli) {
	var milliseconds = milli % 1000;
	var seconds = Math.floor((milli / 1000) % 60);
	var minutes = Math.floor((milli / (60 * 1000)) % 60);
	
	if(seconds<10){
		seconds = '0'+seconds;  
	}
	
	if(minutes<10){
		minutes = '0'+minutes;  
	}
	
	return minutes+':'+seconds;
}

/*!
 * 
 * OPTIONS - This is the function that runs to toggle options
 * 
 */

function toggleOption(){
	if(optionsContainer.visible){
		optionsContainer.visible = false;
	}else{
		optionsContainer.visible = true;
	}
}

/*!
 * 
 * OPTIONS - This is the function that runs to mute and fullscreen
 * 
 */
function toggleGameMute(con){
	buttonSoundOff.visible = false;
	buttonSoundOn.visible = false;
	toggleMute(con);
	if(con){
		buttonSoundOn.visible = true;
	}else{
		buttonSoundOff.visible = true;	
	}
}

function toggleFullScreen() {
  if (!document.fullscreenElement &&    // alternative standard method
      !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement ) {  // current working methods
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
      document.documentElement.msRequestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) {
      document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}


/*!
 * 
 * SHARE - This is the function that runs to open share url
 * 
 */
function share(action){
	gtag('event','click',{'event_category':'share','event_label':action});
	
	var loc = location.href
	loc = loc.substring(0, loc.lastIndexOf("/") + 1);
	
	var title = '';
	var text = '';
	
	title = shareTitle.replace("[SCORE]", addCommas(playerData.score));
	text = shareMessage.replace("[SCORE]", addCommas(playerData.score));

	var shareurl = '';
	
	if( action == 'twitter' ) {
		shareurl = 'https://twitter.com/intent/tweet?url='+loc+'&text='+text;
	}else if( action == 'facebook' ){
		shareurl = 'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(loc+'share.php?desc='+text+'&title='+title+'&url='+loc+'&thumb='+loc+'share.jpg&width=590&height=300');
	}else if( action == 'whatsapp' ){
		shareurl = "whatsapp://send?text=" + encodeURIComponent(text) + " - " + encodeURIComponent(loc);
	}
	
	window.open(shareurl);
}