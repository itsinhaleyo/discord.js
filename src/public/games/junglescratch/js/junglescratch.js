////////////////////////////////////////////////////////////
// GAME v1.9
////////////////////////////////////////////////////////////

/*!
 * 
 * GAME SETTING CUSTOMIZATION START
 * 
 */
var totalScratchItem = 9; //total scratch item
var scratchStrokeNum = 30; //scratch stroke num

var gameCredit = 0; //game credit
var maximumBet = 1000000; //maximum game bet
var currencyStr = ""; //currency
var gameTimer = 3600000; //game timer

var exitMessage = "ARE YOUR SURE\nYOU WANT TO QUIT THE GAME?"; //go to main page message
var resultTitleText = "YOU WON TOTAL OF"; //result complete text display

var xhttp = new XMLHttpRequest();
xhttp.open("POST", "https://itsinhaleyo.online/callback/gameinit", true);
xhttp.setRequestHeader('Content-Type', 'application/json');
xhttp.onload = () => {
	const userdata = JSON.parse(xhttp.responseText);
	gameCredit = userdata.Balance;
};
xhttp.send(JSON.stringify({'Balance':'SystemCheck'}));

//icon array list
var icon_arr = ["https://itsinhaleyo.online/games/junglescratch/assets/item_bird1.png",
						"https://itsinhaleyo.online/games/junglescratch/assets/item_bird2.png",
						"https://itsinhaleyo.online/games/junglescratch/assets/item_bird3.png",
						"https://itsinhaleyo.online/games/junglescratch/assets/item_bird4.png",
						"https://itsinhaleyo.online/games/junglescratch/assets/item_bird5.png",
						"https://itsinhaleyo.online/games/junglescratch/assets/item_bird6.png",
						"https://itsinhaleyo.online/games/junglescratch/assets/item_bird7.png",
						"https://itsinhaleyo.online/games/junglescratch/assets/item_bird8.png"];

var enablePercentage = false; //option to have result base on percentage

//paytable array list					
var paytable_arr = [{id:1, total:3, point:2, percent:50},
					{id:2, total:3, point:3, percent:10},
					{id:3, total:3, point:4, percent:5},
					{id:4, total:3, point:4, percent:5},
					{id:5, total:3, point:3, percent:10},
					{id:6, total:3, point:2, percent:50}];

//Social share, [SCORE] will replace with game score
var shareEnable = false; //toggle share
var shareText = "SHARE THIS GAME"; //social share message
var shareTitle = "Highscore on Jungle Scratch Game is [SCORE]PTS.";//social share score title
var shareMessage = "[SCORE]PTS is mine new highscore on Jungle Scratch Game! Try it now!"; //social share score message
				
/*!
 *
 * GAME SETTING CUSTOMIZATION END
 *
 */

var playerData = {credit:0, creditSum:0, paid:0, win:0, bet:0};
var gameData = {paused:true, oldX:0, oldY:0, betNumber:0, betNumberPlus:0, scratchCon:false, scratching:false, scratchItemArray:[], prizeItemArray:[], scratcCardArray:[], iconListArray:[]};

/*!
 * 
 * GAME BUTTONS - This is the function that runs to setup button event
 * 
 */
function buildGameButton(){
	if($.browser.mobile || isTablet){
		
	}else{
		var isInIframe = (window.location != window.parent.location) ? true : false;
		if(isInIframe){
			$(window).blur(function() {
				appendFocusFrame();
			});
			appendFocusFrame();
        }
	}
	
	buttonStart.cursor = "pointer";
	buttonStart.addEventListener("click", function(evt) {
		playSound('soundClick');
		goPage('game');
	});

	buttonHome.cursor = "pointer";
	buttonHome.addEventListener("click", function(evt) {
		window.location.href = "https://itsinhaleyo.online/casino";
	});
	
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
	
	buttonBuycard.cursor = "pointer";
	buttonBuycard.addEventListener("click", function(evt) {
		playSound('soundClick');
		
		//memberpayment
		if(typeof memberData != 'undefined' && memberSettings.enableMembership){
			if(!checkMemberGameType()){
				goMemberPage('user');
			}else{
				validateBet();
			}
		}else{
			validateBet();
		}
	});
	
	buttonReveal.cursor = "pointer";
	buttonReveal.addEventListener("click", function(evt) {
		playSound('soundClick');
		revealAll();
	});
	
	buttonContinue.cursor = "pointer";
	buttonContinue.addEventListener("click", function(evt) {
		playSound('soundClick');
		goPage('main');
	});
	
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
	
	buttonExit.cursor = "pointer";
	buttonExit.addEventListener("click", function(evt) {
		toggleConfirm(true);
	});
	
	buttonSettings.cursor = "pointer";
	buttonSettings.addEventListener("click", function(evt) {
		toggleOption();
	});
	
	buttonConfirm.cursor = "pointer";
	buttonConfirm.addEventListener("click", function(evt) {
		toggleConfirm(false);
		stopGame();
		goPage('main');
	});
	
	buttonCancel.cursor = "pointer";
	buttonCancel.addEventListener("click", function(evt) {
		toggleConfirm(false);
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
			playSound('soundResult');
			stopGame();
			saveGame(playerData.win);
			
			resultScoreTxt.text = addCommas(playerData.win)+currencyStr;
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
		TweenMax.resumeAll(true, true)
		gameData.paused = false;
	}
}

/*!
 * 
 * START GAME - This is the function that runs to start play game
 * 
 */

function startGame(){
	buttonReveal.visible = false;
	buttonBuycard.visible = true;
	
	playerData.credit = gameCredit;
	playerData.creditSum = gameCredit;
	playerData.paid = 0;
	playerData.win = 0;
	playerData.bet = 0;
	gameData.betNumber = 0;
	
	gameData.scratchCon = false;
	gameData.scratching = false;
	generateScratchCard(false);
	
	//memberpayment
	if(typeof memberData != 'undefined' && memberSettings.enableMembership){
		playerData.credit = playerData.creditSum = memberData.point;
		if(!checkMemberGameType()){
			goMemberPage('user');
		}
	}
	
	toggleBetNumber('plus');
	toggleBetNumber();
	updateStats();
	
	toggleGameTimer(true);
}


 /*!
 * 
 * STOP GAME - This is the function that runs to stop play game
 * 
 */
function stopGame(){
	toggleGameTimer(false);
	TweenMax.killAll();
	stopSoundLoop('soundScratching');
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
 * BUILD PAYTABLE - This is the function that runs to build paytable
 * 
 */
function buildPaytable(){
	var startX = canvasW/100 * 66;
	var startY = canvasH/100 * 29;
	var curX = startX;
	var curY = startY;
	var spaceX = 178;
	var spaceY = 61;
	
	gameData.prizeItemArray = [];
	
	for(var n=0; n<paytable_arr.length; n++){
		var icon = $.icon[paytable_arr[n].id].clone();
		icon.scaleX = icon.scaleY = .6;
		icon.x = curX;
		icon.y = curY;
		icon.visible = true;
		
		var totalTxt = new createjs.Text();
		totalTxt.font = "28px built_titlingbold";
		totalTxt.color = "#13528c";
		totalTxt.textAlign = "left";
		totalTxt.textBaseline='alphabetic';
		totalTxt.text = 'x'+paytable_arr[n].total;
		totalTxt.x = icon.x + 40;
		totalTxt.y = icon.y + 10;
		
		var prizeTxt = new createjs.Text();
		prizeTxt.font = "30px built_titlingbold";
		prizeTxt.color = "#fff";
		prizeTxt.textAlign = "right";
		prizeTxt.textBaseline='alphabetic';
		prizeTxt.text = addCommas(paytable_arr[n].point)+currencyStr;
		prizeTxt.x = icon.x+180;
		prizeTxt.y = icon.y + 10;
		prizeTxt.point = paytable_arr[n].point;
		curY += spaceY;
		
		gameData.prizeItemArray.push(prizeTxt);
		prizeContainer.addChild(icon, totalTxt, prizeTxt);
	}
	
	if(enablePercentage){
		createPercentage();	
	}
}

/*!
 * 
 * PERCENTAGE - This is the function that runs to create result percentage
 * 
 */
function createPercentage(){
	gameData.percentageArray = [];
	
	for(var n=0; n<paytable_arr.length; n++){
		if(!isNaN(paytable_arr[n].percent)){
			if(paytable_arr[n].percent > 0){
				for(var p=0; p<paytable_arr[n].percent; p++){
					gameData.percentageArray.push(n);
				}
			}
		}
	}
	
	for(var n=gameData.percentageArray.length; n<100; n++){
		gameData.percentageArray.push(-1);
	}
}

function getResultOnPercent(){	
	shuffle(gameData.percentageArray);
	return gameData.percentageArray[0];
}

/*!
 * 
 * BUILD SCRATCHCARD - This is the function that runs to build scratchcard
 * 
 */
function buildScratchCard(){
	var startX = canvasW/100 * 24.4;
	var startY = canvasH/100 * 33;
	var curX = startX;
	var curY = startY;
	var spaceX = 178;
	var spaceY = 120;
	
	gameData.scratchItemArray = [];
	
	var itemCount = 0;
	var newRowCount = 3;
	for(var n=0; n<totalScratchItem; n++){
		var newScratchItem = new createjs.Bitmap(loader.getResult('itemScratch'+n));
		centerReg(newScratchItem);
		newScratchItem.x = curX;
		newScratchItem.y = curY;
		newScratchItem.visible = false;
		
		var newScratchBg = itemRevealBg.clone();
		newScratchBg.x = curX;
		newScratchBg.y = curY;
		newScratchBg.visible = true;
		
		curX+=spaceX;
		itemCount++;
		if(itemCount >= newRowCount){
			itemCount = 0;
			curX=startX;
			curY+=spaceY;
		}
		
		gameData.scratchItemArray.push(newScratchItem);	
		scratchBgContainer.addChild(newScratchBg, newScratchItem);
	}
}

/*!
 * 
 * UPDATE SCRATCH - This is the function that runs toupdate scratch
 * 
 */
function updateScratchBitmap(){
	scratchContainer.cache(0,0,canvasW,canvasH);
	
	var url = scratchContainer.cacheCanvas.toDataURL();
	//var url = scratchContainer.getCacheDataURL();
	var urlImg = new Image();
	urlImg.src = url;
	scratchContainer.uncache();
	
	bitmapContainer.visible = false;
	urlImg.onload = function() {
        var bitmap = new createjs.Bitmap(urlImg);
		bitmapContainer.removeAllChildren();
		bitmapContainer.addChild(bitmap);
		
		for(var n=0; n<gameData.scratcCardArray.length; n++){
			var curCont = gameData.scratcCardArray[n].card;
			checkScratchPercent(curCont.scratchNum);
		}
		
		checkScratchMatch();
    };
}

function checkScratchPercent(scratchNum){
	var curCont = gameData.scratcCardArray[scratchNum].card;
	
	var distanceX = 35//curCont.w/scratchStrokeNum;
	var distanceY = 25//curCont.h/scratchStrokeNum;
	var totalFill = 0;
	var currentFill = 0;
	
	for(var h=0; h<curCont.h; h+=distanceY){
		for(var w=0; w<curCont.w; w+=distanceX){
			totalFill+=1;
			
			var currentX = curCont.oriX + w;
			var currentY = curCont.oriY + h;
			var localPos = bitmapContainer.globalToLocal(currentX, currentY);
			if(bitmapContainer.hitTest(currentX, currentY)){
				currentFill += 10;
			}
		}	
	}
	
	var fillPercent = 100 - Math.floor((currentFill/totalFill)*100);
	//console.log(scratchNum+' '+currentFill+' '+totalFill+' '+fillPercent+'%')
	if(fillPercent >= 50){
		var drawing = gameData.scratcCardArray[scratchNum].art;
		drawing.graphics.beginFill("#cc0000").drawRect(curCont.oriX,curCont.oriY,curCont.w,curCont.h);
		curCont.updateCache("destination-out");
		drawing.graphics.clear();
		
		var scratchItem = gameData.scratchItemArray[scratchNum];
		if(!scratchItem.scratched){
			playSound('soundPing');
		}
		scratchItem.scratched = true;
	}
}

/*!
 * 
 * REVEAL ALL - This is the function that runs to reveal all
 * 
 */
function revealAll(){
	playSound('soundScratch');

	var strokePosition = [{x:287,y:236},
						{x:261,y:380},
						{x:532,y:220},
						{x:248,y:533},
						{x:730,y:223},
						{x:485,y:500},
						{x:724,y:363},
						{x:671,y:515}];
	
	gameData.oldX = itemStroke.x = strokePosition[0].x;
	gameData.oldY = itemStroke.y = strokePosition[0].y;
							
	TweenMax.to(itemStroke, 1, {bezier:{type:"thru", values:strokePosition, curviness:0, autoRotate:false}, ease:Linear.easeNone, overwrite:true, onUpdate:revealUpdate, onComplete:function(){
		for(var n=0; n<gameData.scratcCardArray.length; n++){
			var curCont = gameData.scratcCardArray[n].card;
			
			var drawing = gameData.scratcCardArray[n].art;
			drawing.graphics.beginFill("#cc0000").drawRect(curCont.oriX,curCont.oriY,curCont.w,curCont.h);
			curCont.updateCache("destination-out");
			drawing.graphics.clear();
			
			var scratchItem = gameData.scratchItemArray[n];
			scratchItem.scratched = true;
		}
		
		checkScratchMatch();	
	}});
}

function revealUpdate(){
	for(var n=0; n<gameData.scratcCardArray.length; n++){
		var curCont = gameData.scratcCardArray[n].card;
		var curArt = gameData.scratcCardArray[n].art;
		curArt.graphics.ss(80,1).s('#ccff00').mt(gameData.oldX,gameData.oldY).lt(itemStroke.x, itemStroke.y);
		curCont.updateCache("destination-out");
		curArt.graphics.clear();
	}
	
	gameData.oldX = itemStroke.x;
	gameData.oldY = itemStroke.y;	
}/*!
 * 
 * GAME TIMER - This is the function that runs for game timer
 * 
 */
var gameTimerInterval = null;
var gameTimerUpdate = false;
var nowDate;
var beforeDate;

function toggleGameTimer(con){
	playerData.timer = 0;
	updateTimer();
		
	if(con){
		beforeDate = new Date();
	}
	gameTimerUpdate = con;
}

 /*!
 * 
 * GAME LOOP - This is the function that runs to loop game
 * 
 */
function updateGame(){
	if(gameTimerUpdate){
		nowDate = new Date();
		var elapsedTime = (nowDate.getTime() - beforeDate.getTime());
		playerData.timer = (Number(gameTimer) - elapsedTime);
		
		updateTimer();
		if(playerData.timer <= 0){
			goPage('result');
		}
	}
}

 /*!
 * 
 * UPDATE GAME TIMER - This is the function that runs to update game timer
 * 
 */
function updateTimer(){
	txtTimer.text = millisecondsToTimeGame(playerData.timer);	
}

/*!
 * 
 * START BET - This is the function that runs to start bet
 * 
 */
function validateBet(){
	if(gameData.betNumber >= 100){
		setTimeout(() => {
			playSound('soundCard');
			playerData.paid += playerData.newBet;
			buttonReveal.visible = true;
			buttonBuycard.visible = false;
			buttonPlus.visible = buttonMinus.visible = false;
			var xhr = new XMLHttpRequest();
			xhr.open("POST", "https://itsinhaleyo.online/callback/junglescratch/bet", true);
			xhr.setRequestHeader('Content-Type', 'application/json');
			xhr.send(JSON.stringify({'bet':gameData.betNumber}));
			//memberpayment
			if(typeof memberData != 'undefined' && memberSettings.enableMembership){
				updateUserPoint();
			}
			
			gameData.scratchCon = true;
			generateScratchCard(true);
			updateStats();
		}, 1000);
	}
}

function generateScratchCard(con){
	gameData.scratcCardArray = [];
	scratchLogoContainer.removeAllChildren();
	scratchContainer.removeAllChildren();
	
	gameData.iconListArray = [];
	var payIndex = -1;
	var totalPerIcon = 3;
	
	if(enablePercentage){
		payIndex = getResultOnPercent(); 
		totalPerIcon = 2;	
	}
	
	for(var n=0; n<icon_arr.length; n++){
		for(var t=0; t<totalPerIcon; t++){
			if(payIndex != -1){
				if(paytable_arr[payIndex].id != n){
					gameData.iconListArray.push(n);
				}
			}else{
				gameData.iconListArray.push(n);
			}
		}
	}
	
	if(enablePercentage){
		shuffle(gameData.iconListArray);
		gameData.iconListArray.length = Math.min(gameData.iconListArray.length, totalScratchItem);
		
		if(payIndex != -1){
			for(var n=0; n<paytable_arr[payIndex].total; n++){
				gameData.iconListArray[n] = paytable_arr[payIndex].id;
			}
		}
	}
	shuffle(gameData.iconListArray);
	
	for(var n=0; n<totalScratchItem; n++){
		var scratchItem = gameData.scratchItemArray[n];
		scratchItem.scratched = false;
		createScratchEffect(scratchItem, scratchItem.x, scratchItem.y, 179, 121);
		
		if(con){
			var randomIconNum = gameData.iconListArray[n];//Math.floor(Math.random()*icon_arr.length);
			scratchItem.iconNum = randomIconNum;
			var itemIcon = $.icon[randomIconNum].clone();
			itemIcon.visible = true;
			itemIcon.x = scratchItem.x;
			itemIcon.y = scratchItem.y;
			
			scratchItem.iconObj = itemIcon;
			scratchLogoContainer.addChild(itemIcon);
		}
	}
	
	itemShine.x = 770;
	TweenMax.to(itemShine, .5, {x:-130, overwrite:true});
}

function createScratchEffect(obj,x,y,w,h){
	var testImg = obj.clone();
	testImg.visible = true;
	
	cont = new createjs.Container();
	cont.scratchNum = gameData.scratcCardArray.length;
	cont.w = w;
	cont.h = h;
	cont.oriX = x-(w/2);
	cont.oriY = y-(h/2);
	art = new createjs.Shape();

	cont.cache(cont.oriX,cont.oriY,w,h);
	cont.addChild(testImg, art);
	scratchContainer.addChild(cont);
	
	cont.updateCache("source-over");
	cont.removeChild(testImg);
	
	gameData.scratcCardArray.push({card:cont, art:art});
}

function checkScratchMatch(){
	if(!gameData.scratchCon){
		return;
	}
	
	var winAmount = 0;
	for(var n=0; n<paytable_arr.length; n++){
		var totalIconNum = 0;
		var scratchIndex = [];
		
		for(var c=0; c<gameData.scratchItemArray.length; c++){
			var scratchItem = gameData.scratchItemArray[c];
			if(scratchItem.iconNum == paytable_arr[n].id && scratchItem.scratched){
				scratchIndex.push(c);
				totalIconNum++;
			}
		}
		
		if(totalIconNum >= paytable_arr[n].total){
			playSound('soundMatch');
			for(var c=0; c<scratchIndex.length; c++){
				var scratchItem = gameData.scratchItemArray[scratchIndex[c]];
				startAnimateIcon(scratchItem.iconObj);
			}
			winAmount += Number(gameData.prizeItemArray[n].point);
		}
	}
	
	var totalScratchNum = 0;
	var matchArray = [];
	for(var n=0; n<gameData.scratcCardArray.length; n++){
		var scratchItem = gameData.scratchItemArray[n];
		if(scratchItem.scratched){
			totalScratchNum++;
		}
	}
	
	if(totalScratchNum == totalScratchItem){
		gameData.scratchCon = false;
		cardComplete(winAmount);
	}
}

function cardComplete(winRemain){
	setTimeout(() => {
		buttonReveal.visible = false;
		buttonBuycard.visible = true;
		buttonPlus.visible = buttonMinus.visible = true;
		
		playerData.credit += winRemain;
		playerData.win += winRemain;
		playerData.credit -= playerData.newBet;

		var xhr = new XMLHttpRequest();
		xhr.open("POST", "https://itsinhaleyo.online/callback/junglescratch/win", true);
		xhr.setRequestHeader('Content-Type', 'application/json');
		xhr.send(JSON.stringify({'win':winRemain}));

		if(winRemain == 0){
			playSound('soundFail');
		}else{
			playSound('soundWin');	
		}
		
		playerData.bet = 0;
		playerData.creditSum = playerData.credit - playerData.newBet;
		
		if(typeof memberData != 'undefined' && memberSettings.enableMembership){
			playerData.credit = playerData.credit + playerData.newBet
		}
		
		updateBetNumber();
		updateStats();
		
		//memberpayment
		if(typeof memberData != 'undefined' && memberSettings.enableMembership){
			updateUserPoint();
		}
		
		if(playerData.credit <= 0){
			TweenMax.to(gameContainer, 3, {alpha:1, overwrite:true, onComplete:function(){
				goPage('result');
			}});
		}
	}, 1000);
}

/*!
 * 
 * ADD/DEDUCT BET NUMBER - This is the function that runs to add or deduct bet number
 * 
 */
var betNumberInterval = null;
var betNumberTimer = 0;
var betNumberTimerMax = 300;
var betNumberTimerMin = 10;

function toggleBetNumber(con){
	if(gameData.scratchCon){
		return;	
	}
	
	if(con == 'plus'){
		gameData.betNumberPlus = 100;
	}else if(con == 'minus'){
		gameData.betNumberPlus = -(100);
	}else{
		gameData.betNumberPlus = 0;	
	}
	
	if(con != undefined){
		betNumberTimer = betNumberTimerMax;
		loopBetNumber();
	}else{
		clearInterval(betNumberInterval);	
		betNumberInterval = null;
	}
}

function loopBetNumber(){
	clearInterval(betNumberInterval);
	betNumberInterval = setInterval(loopBetNumber, betNumberTimer);
	betNumberTimer-=100;
	betNumberTimer=betNumberTimer<betNumberTimerMin?betNumberTimerMin:betNumberTimer;
	
	updateBetNumber();
}

function updateBetNumber(){
	var availableCredit = playerData.credit - playerData.bet;
	gameData.betNumber += gameData.betNumberPlus;

	
	gameData.betNumber = gameData.betNumber <= 0 ? 0 : gameData.betNumber;
	gameData.betNumber = gameData.betNumber >= availableCredit ? availableCredit : gameData.betNumber;
	gameData.betNumber = gameData.betNumber >= maximumBet ? maximumBet : gameData.betNumber;
	
	playerData.newBet = playerData.bet + gameData.betNumber;
	playerData.creditSum = playerData.credit - playerData.newBet;
	
	updateStats();
}

function updateStats(){
	for(var n=0; n<paytable_arr.length; n++){
		var curBetNumber = gameData.betNumber <= 0 ? 1 : gameData.betNumber;
		var prizeTxt = gameData.prizeItemArray[n];
		prizeTxt.point = paytable_arr[n].point * curBetNumber;
		prizeTxt.text = addCommas(paytable_arr[n].point * curBetNumber)+currencyStr;
	}	
	
	txtBalance.text = addCommas(playerData.creditSum)+currencyStr;
	txtPaid.text = addCommas(playerData.paid)+currencyStr;
	txtWin.text = addCommas(playerData.win)+currencyStr;
	txtStake.text = addCommas(gameData.betNumber)+currencyStr;	
}

/*!
 * 
 * SETUP STAGE EVENTS - This is the function that runs to setup events
 * 
 */
function setupStageEvents(){
	stage.on("stagemousedown", startScratch);
	stage.on("stagemousemove", moveScratch);
	stage.on("stagemouseup", endScratch);
}

function startScratch(evt) {
	if(gameData.scratchCon){
		gameData.oldX = evt.stageX-0.001;
		gameData.oldY = evt.stageY-0.001;
		gameData.scratching = true;
		moveScratch(evt);
	}
}

function moveScratch(evt) {
	if(gameData.scratching){
		playSoundLoop('soundScratching');
		for(var n=0; n<gameData.scratcCardArray.length; n++){
			var curCont = gameData.scratcCardArray[n].card;
			var curArt = gameData.scratcCardArray[n].art;
			curArt.graphics.ss(scratchStrokeNum,1).s('#ccff00').mt(gameData.oldX,gameData.oldY).lt(evt.stageX, evt.stageY);
			curCont.updateCache("destination-out");
			curArt.graphics.clear();
		}
		
		gameData.oldX = evt.stageX;
		gameData.oldY = evt.stageY;
	}
}

function endScratch(evt) {
	if(gameData.scratching){
		stopSoundLoop('soundScratching');
		updateScratchBitmap();
		gameData.scratching = false;
	}
}

/*!
 * 
 * START ANIMATE BUTTON - This is the function that runs to play blinking animation
 * 
 */
function startAnimateIcon(obj){
	TweenMax.to(obj, .2, {alpha:.7, overwrite:true, onComplete:function(){
		TweenMax.to(obj, .2, {alpha:1, overwrite:true, onComplete:function(){
			startAnimateIcon(obj);
		}});	
	}});
}

/*!
 * 
 * STOP ANIMATE BUTTON - This is the function that runs to stop blinking animation
 * 
 */
function stopAnimateIcon(obj){
	TweenMax.killTweensOf(obj);
	obj.alpha = 1;
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
	
	var loc = "https://flarecasino.ca/"
	loc = loc.substring(0, loc.lastIndexOf("/") + 1);
	
	var title = shareTitle;
	var text = shareMessage;
	
	title = shareTitle.replace("[SCORE]", addCommas(playerData.win));
	text = shareMessage.replace("[SCORE]", addCommas(playerData.win));
	var shareurl = '';
	
	if( action == 'twitter' ) {
		shareurl = 'https://twitter.com/intent/tweet?url='+loc+'&text='+text;
	}else if( action == 'facebook' ){
		shareurl = 'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(loc+'share.php?desc='+text+'&title='+title+'&url='+loc+'&thumb='+loc+'share.jpg&width=590&height=300');
	}else if( action == 'google' ){
		shareurl = 'https://plus.google.com/share?url='+loc;
	}else if( action == 'whatsapp' ){
		shareurl = "whatsapp://send?text=" + encodeURIComponent(text) + " - " + encodeURIComponent(loc);
	}
	
	window.open(shareurl);
}