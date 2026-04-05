////////////////////////////////////////////////////////////
// CANVAS
////////////////////////////////////////////////////////////
var stage
var canvasW=0;
var canvasH=0;

/*!
 * 
 * START GAME CANVAS - This is the function that runs to setup game canvas
 * 
 */
function initGameCanvas(w,h){
	var gameCanvas = document.getElementById("gameCanvas");
	gameCanvas.width = w;
	gameCanvas.height = h;
	
	canvasW=w;
	canvasH=h;
	stage = new createjs.Stage("gameCanvas");
	
	createjs.Touch.enable(stage);
	stage.enableMouseOver(20);
	stage.mouseMoveOutside = true;
	
	createjs.Ticker.framerate = 60;
	createjs.Ticker.addEventListener("tick", tick);	
}

var guide = false;
var canvasContainer, mainContainer, gameContainer, resultContainer, confirmContainer;
var guideline, bg, logo, buttonStart, buttonRestart, buttonFacebook, buttonTwitter, buttonWhatsapp, buttonFullscreen, buttonSoundOn, buttonSoundOff;

$.drop = {};
$.move = {};
$.prize = {};
$.coins = {};
$.arrow = {};

$.dropBonus = {};
$.moveBonus = {};
$.prizeBonus = {};
$.arrowBonus = {};

/*!
 * 
 * BUILD GAME CANVAS ASSERTS - This is the function that runs to build game canvas asserts
 * 
 */
function buildGameCanvas(){
	canvasContainer = new createjs.Container();
	mainContainer = new createjs.Container();
	gameContainer = new createjs.Container();
	stateContainer = new createjs.Container();
	stateBonusContainer = new createjs.Container();
	plinkoContainer = new createjs.Container();
	plinkoItemContainer = new createjs.Container();
	plinkoCoinContainer = new createjs.Container();
	plinkoCoinTextContainer = new createjs.Container();
	plinkoGuideContainer = new createjs.Container();
	plinkoBonusContainer = new createjs.Container();
	plinkoBonusItemContainer = new createjs.Container();
	plinkoBonusGuideContainer = new createjs.Container();
	dollarContainer = new createjs.Container();
	betContainer = new createjs.Container();
	chanceContainer = new createjs.Container();
	resultContainer = new createjs.Container();
	confirmContainer = new createjs.Container();
	optionsContainer = new createjs.Container();
	
	bg = new createjs.Bitmap(loader.getResult('background'));
	logo = new createjs.Bitmap(loader.getResult('logo'));
	
	buttonStart = new createjs.Bitmap(loader.getResult('buttonStart'));
	centerReg(buttonStart);
	buttonStart.x = canvasW/2;
	buttonStart.y = canvasH/100 * 65;
	
	//game
	itemPlinko = new createjs.Bitmap(loader.getResult('itemPlinko'));
	centerReg(itemPlinko);
	
	itemCoin = new createjs.Bitmap(loader.getResult('itemCoin'));
	centerReg(itemCoin);
	itemCoin.visible = false;

	itemBall = new createjs.Bitmap(loader.getResult('itemBall'));
	centerReg(itemBall);

	itemDollar = new createjs.Bitmap(loader.getResult('itemDollar'));
	centerReg(itemDollar);

	itemArrow = new createjs.Bitmap(loader.getResult('itemArrow'));
	centerReg(itemArrow);
	itemArrow.visible = false;

	statusTxt = new createjs.Text();
	statusTxt.font = "25px azonixregular";
	statusTxt.color = '#fff';
	statusTxt.textAlign = "center";
	statusTxt.textBaseline='alphabetic';
	statusTxt.text = '';

	dollarTxt = new createjs.Text();
	dollarTxt.font = "30px azonixregular";
	dollarTxt.color = '#fff';
	dollarTxt.textAlign = "center";
	dollarTxt.textBaseline='alphabetic';
	dollarTxt.text = '1,000';

	dollarContainer.addChild(itemDollar, dollarTxt);

	itemBet = new createjs.Bitmap(loader.getResult('itemBet'));
	centerReg(itemBet);

	buttonPlus = new createjs.Bitmap(loader.getResult('buttonPlus'));
	centerReg(buttonPlus);

	buttonMinus = new createjs.Bitmap(loader.getResult('buttonMinus'));
	centerReg(buttonMinus);

	buttonPlus.x += 105;
	buttonMinus.x -= 105;

	betTxt = new createjs.Text();
	betTxt.font = "30px azonixregular";
	betTxt.color = '#fff';
	betTxt.textAlign = "center";
	betTxt.textBaseline='alphabetic';
	betTxt.text = '100';

	dollarContainer.x = canvasW/100 * 30;
	betContainer.addChild(itemBet, betTxt, buttonPlus, buttonMinus);

	itemChance = new createjs.Bitmap(loader.getResult('itemBet'));
	centerReg(itemChance);

	chanceTxt = new createjs.Text();
	chanceTxt.font = "30px azonixregular";
	chanceTxt.color = '#fff';
	chanceTxt.textAlign = "center";
	chanceTxt.textBaseline='alphabetic';
	chanceTxt.text = 'x7';

	chanceContainer.addChild(itemChance, chanceTxt);

	//bonus
	itemBonus = new createjs.Bitmap(loader.getResult('itemBonus'));
	centerReg(itemBonus);
	itemBonus.x = itemBonus.oriX = canvasW/2;
	itemBonus.y = itemBonus.oriY = canvasH/2;

	itemPlinkoBonus = new createjs.Bitmap(loader.getResult('itemPlinkoBonus'));
	centerReg(itemPlinkoBonus);

	itemBallBonus = new createjs.Bitmap(loader.getResult('itemBallBonus'));
	centerReg(itemBallBonus);

	itemArrowBonus = new createjs.Bitmap(loader.getResult('itemArrowBonus'));
	centerReg(itemArrowBonus);
	itemArrowBonus.visible = false;

	statusBonusTxt = new createjs.Text();
	statusBonusTxt.font = "25px azonixregular";
	statusBonusTxt.color = '#fff';
	statusBonusTxt.textAlign = "center";
	statusBonusTxt.textBaseline='alphabetic';
	statusBonusTxt.text = '';
	
	//result
	itemResult = new createjs.Bitmap(loader.getResult('itemResult'));

	resultShareTxt = new createjs.Text();
	resultShareTxt.font = "20px azonixregular";
	resultShareTxt.color = '#5e06b2';
	resultShareTxt.textAlign = "center";
	resultShareTxt.textBaseline='alphabetic';
	resultShareTxt.text = textDisplay.share;
	resultShareTxt.x = canvasW/2;
	resultShareTxt.y = canvasH/100 * 52;
	
	resultTitleTxt = new createjs.Text();
	resultTitleTxt.font = "50px azonixregular";
	resultTitleTxt.color = '#fff';
	resultTitleTxt.textAlign = "center";
	resultTitleTxt.textBaseline='alphabetic';
	resultTitleTxt.text = textDisplay.resultTitle;
	resultTitleTxt.x = canvasW/2;
	resultTitleTxt.y = canvasH/100 * 33;

	resultDescTxt = new createjs.Text();
	resultDescTxt.font = "30px azonixregular";
	resultDescTxt.color = '#fff';
	resultDescTxt.textAlign = "center";
	resultDescTxt.textBaseline='alphabetic';
	resultDescTxt.text = textDisplay.resultDesc;
	resultDescTxt.x = canvasW/2;
	resultDescTxt.y = canvasH/100 * 40;

	resultScoreTxt = new createjs.Text();
	resultScoreTxt.font = "80px azonixregular";
	resultScoreTxt.color = '#fff';
	resultScoreTxt.textAlign = "center";
	resultScoreTxt.textBaseline='alphabetic';
	resultScoreTxt.text = '1,000';
	resultScoreTxt.x = canvasW/2;
	resultScoreTxt.y = canvasH/100 * 47;
	
	buttonFacebook = new createjs.Bitmap(loader.getResult('buttonFacebook'));
	buttonTwitter = new createjs.Bitmap(loader.getResult('buttonTwitter'));
	buttonWhatsapp = new createjs.Bitmap(loader.getResult('buttonWhatsapp'));
	centerReg(buttonFacebook);
	createHitarea(buttonFacebook);
	centerReg(buttonTwitter);
	createHitarea(buttonTwitter);
	centerReg(buttonWhatsapp);
	createHitarea(buttonWhatsapp);
	buttonFacebook.x = canvasW/100 * 40;
	buttonTwitter.x = canvasW/2;
	buttonWhatsapp.x = canvasW/100 * 60;
	buttonFacebook.y = buttonTwitter.y = buttonWhatsapp.y = canvasH/100*57;
	
	buttonContinue = new createjs.Bitmap(loader.getResult('buttonContinue'));
	centerReg(buttonContinue);
	buttonContinue.x = canvasW/2;
	buttonContinue.y = canvasH/100 * 70;
	
	//option
	buttonFullscreen = new createjs.Bitmap(loader.getResult('buttonFullscreen'));
	centerReg(buttonFullscreen);
	buttonSoundOn = new createjs.Bitmap(loader.getResult('buttonSoundOn'));
	centerReg(buttonSoundOn);
	buttonSoundOff = new createjs.Bitmap(loader.getResult('buttonSoundOff'));
	centerReg(buttonSoundOff);
	buttonSoundOn.visible = false;
	buttonExit = new createjs.Bitmap(loader.getResult('buttonExit'));
	centerReg(buttonExit);
	buttonSettings = new createjs.Bitmap(loader.getResult('buttonSettings'));
	centerReg(buttonSettings);
	
	createHitarea(buttonFullscreen);
	createHitarea(buttonSoundOn);
	createHitarea(buttonSoundOff);
	createHitarea(buttonExit);
	createHitarea(buttonSettings);
	
	//exit
	itemExit = new createjs.Bitmap(loader.getResult('itemExit'));
	
	buttonConfirm = new createjs.Bitmap(loader.getResult('buttonConfirm'));
	centerReg(buttonConfirm);
	buttonConfirm.x = canvasW/100* 35;
	buttonConfirm.y = canvasH/100 * 70;
	
	buttonCancel = new createjs.Bitmap(loader.getResult('buttonCancel'));
	centerReg(buttonCancel);
	buttonCancel.x = canvasW/100 * 65;
	buttonCancel.y = canvasH/100 * 70;

	popTitleTxt = new createjs.Text();
	popTitleTxt.font = "50px azonixregular";
	popTitleTxt.color = "#fff";
	popTitleTxt.textAlign = "center";
	popTitleTxt.textBaseline='alphabetic';
	popTitleTxt.text = textDisplay.exitTitle;
	popTitleTxt.x = canvasW/2;
	popTitleTxt.y = canvasH/100 * 36;
	
	popDescTxt = new createjs.Text();
	popDescTxt.font = "30px azonixregular";
	popDescTxt.lineHeight = 35;
	popDescTxt.color = "#fff";
	popDescTxt.textAlign = "center";
	popDescTxt.textBaseline='alphabetic';
	popDescTxt.text = textDisplay.exitMessage;
	popDescTxt.x = canvasW/2;
	popDescTxt.y = canvasH/100 * 48;
	
	confirmContainer.addChild(itemExit, popTitleTxt, popDescTxt, buttonConfirm, buttonCancel);
	confirmContainer.visible = false;
	
	if(guide){
		guideline = new createjs.Shape();
		guideline.graphics.setStrokeStyle(2).beginStroke('red').drawRect((stageW-contentW)/2, (stageH-contentH)/2, contentW, contentH);
	}
	
	mainContainer.addChild(logo, buttonStart);
	stateContainer.addChild(itemArrow, statusTxt);
	stateBonusContainer.addChild(itemArrowBonus, statusBonusTxt);
	
	plinkoContainer.addChild(itemPlinko, plinkoGuideContainer, plinkoItemContainer, plinkoCoinContainer, plinkoCoinTextContainer, stateContainer, itemBall);
	plinkoBonusContainer.addChild(itemPlinkoBonus, plinkoBonusGuideContainer, plinkoBonusItemContainer, stateBonusContainer, itemBallBonus);
	gameContainer.addChild(itemCoin, plinkoContainer, plinkoBonusContainer, dollarContainer, betContainer, chanceContainer, itemBonus);
	resultContainer.addChild(itemResult, resultShareTxt, resultTitleTxt, resultScoreTxt, resultDescTxt, buttonContinue);
	optionsContainer.addChild(buttonExit, buttonFullscreen, buttonSoundOn, buttonSoundOff);
	optionsContainer.visible = false;
	
	if(shareEnable){
		resultContainer.addChild(buttonFacebook, buttonTwitter, buttonWhatsapp);
	}
	
	canvasContainer.addChild(bg, mainContainer, gameContainer, resultContainer, confirmContainer, optionsContainer, buttonSettings, guideline);
	stage.addChild(canvasContainer);
	
	resizeCanvas();
}


/*!
 * 
 * RESIZE GAME CANVAS - This is the function that runs to resize game canvas
 * 
 */
function resizeCanvas(){
 	if(canvasContainer!=undefined){
		buttonSettings.x = (canvasW - offset.x) - 60;
		buttonSettings.y = offset.y + 60;
		
		var distanceNum = 105;
		if(curPage != 'game'){
			buttonExit.visible = false;
			buttonSoundOn.x = buttonSoundOff.x = buttonSettings.x;
			buttonSoundOn.y = buttonSoundOff.y = buttonSettings.y+distanceNum;
			buttonSoundOn.x = buttonSoundOff.x;
			buttonSoundOn.y = buttonSoundOff.y = buttonSettings.y+(distanceNum);
			
			buttonFullscreen.x = buttonSettings.x;
			buttonFullscreen.y = buttonSettings.y+(distanceNum*2);
		}else{
			buttonExit.visible = true;
			buttonSoundOn.x = buttonSoundOff.x = buttonSettings.x;
			buttonSoundOn.y = buttonSoundOff.y = buttonSettings.y+distanceNum;
			buttonSoundOn.x = buttonSoundOff.x;
			buttonSoundOn.y = buttonSoundOff.y = buttonSettings.y+(distanceNum);
			
			buttonFullscreen.x = buttonSettings.x;
			buttonFullscreen.y = buttonSettings.y+(distanceNum*2);
			
			buttonExit.x = buttonSettings.x;
			buttonExit.y = buttonSettings.y+(distanceNum*3);

			betContainer.x = canvasW/100 * 67;
			chanceContainer.x = canvasW/100 * 74;
			dollarContainer.y = betContainer.y = chanceContainer.y = (canvasH - offset.y) - 55;
		}
		
	}
}

/*!
 * 
 * REMOVE GAME CANVAS - This is the function that runs to remove game canvas
 * 
 */
 function removeGameCanvas(){
	 stage.autoClear = true;
	 stage.removeAllChildren();
	 stage.update();
	 createjs.Ticker.removeEventListener("tick", tick);
	 createjs.Ticker.removeEventListener("tick", stage);
 }

/*!
 * 
 * CANVAS LOOP - This is the function that runs for canvas loop
 * 
 */ 
function tick(event) {
	updateGame();
	stage.update(event);
}

/*!
 * 
 * CANVAS MISC FUNCTIONS
 * 
 */
function centerReg(obj){
	obj.regX=obj.image.naturalWidth/2;
	obj.regY=obj.image.naturalHeight/2;
}

function createHitarea(obj){
	obj.hitArea = new createjs.Shape(new createjs.Graphics().beginFill("#000").drawRect(0, 0, obj.image.naturalWidth, obj.image.naturalHeight));
}