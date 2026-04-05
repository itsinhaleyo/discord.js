////////////////////////////////////////////////////////////
// CANVAS LOADER
////////////////////////////////////////////////////////////

 /*!
 * 
 * START CANVAS PRELOADER - This is the function that runs to preload canvas asserts
 * 
 */
function initPreload(){
	toggleLoader(true);
	
	checkMobileEvent();
	
	$(window).resize(function(){
		resizeGameFunc();
	});
	resizeGameFunc();
	
	loader = new createjs.LoadQueue(false);
	manifest=[
			{src:'https://itsinhaleyo.online/games/superplinko/assets/background.png', id:'background'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/logo.png', id:'logo'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/button_start.png', id:'buttonStart'},
			
			{src:'https://itsinhaleyo.online/games/superplinko/assets/item_plinko.png', id:'itemPlinko'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/item_plinko_bonus.png', id:'itemPlinkoBonus'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/item_ball.png', id:'itemBall'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/item_ball_bonus.png', id:'itemBallBonus'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/item_dollar.png', id:'itemDollar'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/item_bet.png', id:'itemBet'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/button_plus.png', id:'buttonPlus'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/button_minus.png', id:'buttonMinus'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/item_droparrow.png', id:'itemArrow'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/item_droparrow_bonus.png', id:'itemArrowBonus'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/item_coin.png', id:'itemCoin'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/item_bonus.png', id:'itemBonus'},

			{src:'https://itsinhaleyo.online/games/superplinko/assets/button_confirm.png', id:'buttonConfirm'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/button_cancel.png', id:'buttonCancel'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/item_exit.png', id:'itemExit'},
		
			{src:'https://itsinhaleyo.online/games/superplinko/assets/button_continue.png', id:'buttonContinue'},
			
			{src:'https://itsinhaleyo.online/games/superplinko/assets/item_result.png', id:'itemResult'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/button_facebook.png', id:'buttonFacebook'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/button_twitter.png', id:'buttonTwitter'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/button_whatsapp.png', id:'buttonWhatsapp'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/button_fullscreen.png', id:'buttonFullscreen'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/button_sound_on.png', id:'buttonSoundOn'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/button_sound_off.png', id:'buttonSoundOff'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/button_exit.png', id:'buttonExit'},
			{src:'https://itsinhaleyo.online/games/superplinko/assets/button_settings.png', id:'buttonSettings'}];

	for(var n=0; n<plinkoSettings.prizes.length; n++){
		if(plinkoSettings.prizes[n].image != undefined){
			if(plinkoSettings.prizes[n].image != ''){
				manifest.push({src:plinkoSettings.prizes[n].image, id:'prize'+n});
			}
		}
	}

	for(var n=0; n<plinkoBonusSettings.prizes.length; n++){
		if(plinkoBonusSettings.prizes[n].image != undefined){
			if(plinkoBonusSettings.prizes[n].image != ''){
				manifest.push({src:plinkoBonusSettings.prizes[n].image, id:'prizeBonus'+n});
			}
		}
	}
	
	//memberpayment
	if(typeof memberData != 'undefined' && memberSettings.enableMembership){
		addMemberRewardAssets();
	}
	
	if ( typeof addScoreboardAssets == 'function' ) { 
		addScoreboardAssets();
	}
	
	soundOn = true;
	if($.browser.mobile || isTablet){
		if(!enableMobileSound){
			soundOn=false;
		}
	}
	
	if(soundOn){
		manifest.push({src:'https://itsinhaleyo.online/games/superplinko/assets/sounds/sound_result.ogg', id:'soundResult'});
		manifest.push({src:'https://itsinhaleyo.online/games/superplinko/assets/sounds/sound_button.ogg', id:'soundClick'});
		manifest.push({src:'https://itsinhaleyo.online/games/superplinko/assets/sounds/sound_start.ogg', id:'soundStart'});
		manifest.push({src:'https://itsinhaleyo.online/games/superplinko/assets/sounds/sound_nowin.ogg', id:'soundLose'});
		manifest.push({src:'https://itsinhaleyo.online/games/superplinko/assets/sounds/sound_score.ogg', id:'soundWin'});
		manifest.push({src:'https://itsinhaleyo.online/games/superplinko/assets/sounds/sound_hit1.ogg', id:'soundHit1'});
		manifest.push({src:'https://itsinhaleyo.online/games/superplinko/assets/sounds/sound_hit2.ogg', id:'soundHit2'});
		manifest.push({src:'https://itsinhaleyo.online/games/superplinko/assets/sounds/sound_hit3.ogg', id:'soundHit3'});
		manifest.push({src:'https://itsinhaleyo.online/games/superplinko/assets/sounds/sound_coin.ogg', id:'soundCoin'});
		manifest.push({src:'https://itsinhaleyo.online/games/superplinko/assets/sounds/sound_chips.ogg', id:'soundChips'});
		manifest.push({src:'https://itsinhaleyo.online/games/superplinko/assets/sounds/sound_bonus.ogg', id:'soundBonus'});
		
		createjs.Sound.alternateExtensions = ["mp3"];
		loader.installPlugin(createjs.Sound);
	}
	
	loader.addEventListener("complete", handleComplete);
	loader.addEventListener("fileload", fileComplete);
	loader.addEventListener("error",handleFileError);
	loader.on("progress", handleProgress, this);
	loader.loadManifest(manifest);
}

/*!
 * 
 * CANVAS FILE COMPLETE EVENT - This is the function that runs to update when file loaded complete
 * 
 */
function fileComplete(evt) {
	var item = evt.item;
	//console.log("Event Callback file loaded ", evt.item.id);
}

/*!
 * 
 * CANVAS FILE HANDLE EVENT - This is the function that runs to handle file error
 * 
 */
function handleFileError(evt) {
	console.log("error ", evt);
}

/*!
 * 
 * CANVAS PRELOADER UPDATE - This is the function that runs to update preloder progress
 * 
 */
function handleProgress() {
	$('#mainLoader span').html(Math.round(loader.progress/1*100)+'%');
}

/*!
 * 
 * CANVAS PRELOADER COMPLETE - This is the function that runs when preloader is complete
 * 
 */
function handleComplete() {
	toggleLoader(false);
	initMain();
};

/*!
 * 
 * TOGGLE LOADER - This is the function that runs to display/hide loader
 * 
 */
function toggleLoader(con){
	if(con){
		$('#mainLoader').show();
	}else{
		$('#mainLoader').hide();
	}
}