var canvas = document.getElementById("canvas");
var stage = new createjs.Stage(canvas);

function tick(){
	stage.update();
}

function Game(){
	this.state;
	this.is_ready = true;
	this.chips_ready = true;
	this.sound_enable = true;
	this.cur_player = "player";
	this.txt_cash;
	this.txt_player;
	this.txt_bet;
	this.player_value;
	this.card_pack;
	this.progressbar;
	this.font;
	this.preload;
	this.btn_gui;
	this.value_bar_1;
	this.value_bar_2;
	this.audio_format = 'ogg';
	this.is_fullscreen = false;
	this.save_money = true; //Set "true" if you want to save current player money using localStorage
	this.reload_money = false; //Reload money if player lose and current money are 0
	this.reload_money_amount = 0; //Default amount to reload money
	this.chips_move = new createjs.Container();
	this.card_back = new createjs.Container();
	this.chips = new createjs.Container();
	this.is_tween = false;
	this.is_ready = true;
	this.chips_sheet;
	this.chips_stack_sheet;
	this.b_play;
	this.b_clear;
	this.buttons;
	this.game_end; //Container to store tie/win/lose image
	this.cards = new createjs.Container();
	this.cur_cash = 0; //Default cash/money value
	this.bet = 0;
	this.b_deal;
	this.player_natural = false;
	this.dealer_natural = false;
	this.highlights = new createjs.Container();
	this.selected = new createjs.Container();
	this.selected_opt = "player";
	this.cur_pos = [0,0];
	this.bet_bar = new createjs.Container();
	this.bet_txts = new createjs.Container();
	this.txt_history = new createjs.Container();
	this.bet_value = [0,0,0];
	this.history_value = [];

	var xhttp = new XMLHttpRequest();
    xhttp.open("POST", "https://itsinhaleyo.online/callback/gameinit", true);
    xhttp.setRequestHeader('Content-Type', 'application/json');
    xhttp.onload = () => {
        const userbal = JSON.parse(xhttp.responseText);
        this.cur_cash = userbal.Balance;
    };
    xhttp.send(JSON.stringify({'Balance': 'SystemCheck'}));

	//Load game all assets
	this.load = function(){
		createjs.Ticker.timingMode = createjs.Ticker.RAF;
		createjs.Ticker.on("tick", this.update);

		var bg = new createjs.Bitmap("https://itsinhaleyo.online/games/baccarat/assets/img/background.jpg");

		this.progressbar = new createjs.Shape();
		this.progressbar.graphics.beginFill("white").drawRect(0,0,752,22);
		this.progressbar.setTransform(264, 450);

		var border = new createjs.Shape();
		border.graphics.beginStroke("white").drawRect(0,0,760,30);
		border.setTransform(260, 446);

		var title = new createjs.Bitmap("https://itsinhaleyo.online/games/baccarat/assets/img/game_title.png");
		title.setTransform(600, 260);
		title.regX = 732/2;
		title.regY = 312/2;

		stage.addChild(bg,title,this.progressbar, border);

		manifest = [
			{src:"img/background.jpg", id: "bgMenu"},
			{src:"img/about_window.png", id: "about_window"},
			{src:"img/about-content.png", id: "about_content"},
			{src:"img/moneyBar.png", id: "moneyBar"},
			{src:"img/btn-menu.png", id: "btnMenu"},
			{src:"img/btn-about.png", id: "btnAbout"},
			{src:"img/btn-home.png", id: "btnHome"},
			{src:"img/btn-fullscreen.png", id: "btnFullscreen"},
			{src:"img/btn-sound.png", id: "btnSound"},
			{src:"img/btn-play.png", id: "btn_play"},
			{src:"img/btn-clear.png", id: "btn_clear"},
			{src:"img/btn-home.png", id: "btn_home"},
			{src:"img/game_title.png", id: "game_title"},
			{src:"img/cards.png", id: "_cards"},
			{src:"img/btn-stand.png", id: "btn_stand"},
			{src:"img/btn-deal.png", id: "btn_deal"},
			{src:"img/bet_bar.png", id: "bet_bar"},
			{src:"img/chips.png", id: "chips"},
			{src:"img/chips-stack.png", id: "chips_stack"},
			{src:"img/txt_player.png", id: "txt_player"},
			{src:"img/txt_banker.png", id: "txt_banker"},
			{src:"img/card-value.png", id: "card_value"},
			{src:"img/total-bet-bar.png", id: "total_bet_bar"},
			{src:"img/history.png", id: "history"},
			{src:"img/highlight.png", id: "highlight"},
			{src:"img/selected_player.png", id: "selected_player"},
			{src:"img/selected_tie.png", id: "selected_tie"},
			{src:"img/selected_banker.png", id: "selected_banker"},
			//
			{src:"img/tie.png", id: "tie"},
			{src:"img/win.png", id: "win"},
			{src:"img/lose.png", id: "lose"},
			//CardsClubs
			{src:"img/card-club-2.png", id:"card-club-2"},
			{src:"img/card-club-3.png", id:"card-club-3"},
			{src:"img/card-club-4.png", id:"card-club-4"},
			{src:"img/card-club-5.png", id:"card-club-5"},
			{src:"img/card-club-6.png", id:"card-club-6"},
			{src:"img/card-club-7.png", id:"card-club-7"},
			{src:"img/card-club-8.png", id:"card-club-8"},
			{src:"img/card-club-9.png", id:"card-club-9"},
			{src:"img/card-club-10.png", id:"card-club-10"},
			{src:"img/card-club-1.png", id:"card-club-A"},
			{src:"img/card-club-j.png", id:"card-club-J"},
			{src:"img/card-club-q.png", id:"card-club-Q"},
			{src:"img/card-club-k.png", id:"card-club-K"},
			//CardsDiamonds
			{src:"img/card-diamond-2.png", id:"card-diamond-2"},
			{src:"img/card-diamond-3.png", id:"card-diamond-3"},
			{src:"img/card-diamond-4.png", id:"card-diamond-4"},
			{src:"img/card-diamond-5.png", id:"card-diamond-5"},
			{src:"img/card-diamond-6.png", id:"card-diamond-6"},
			{src:"img/card-diamond-7.png", id:"card-diamond-7"},
			{src:"img/card-diamond-8.png", id:"card-diamond-8"},
			{src:"img/card-diamond-9.png", id:"card-diamond-9"},
			{src:"img/card-diamond-10.png", id:"card-diamond-10"},
			{src:"img/card-diamond-1.png", id:"card-diamond-A"},
			{src:"img/card-diamond-j.png", id:"card-diamond-J"},
			{src:"img/card-diamond-q.png", id:"card-diamond-Q"},
			{src:"img/card-diamond-k.png", id:"card-diamond-K"},
			//CardsHearts
			{src:"img/card-heart-2.png", id:"card-heart-2"},
			{src:"img/card-heart-3.png", id:"card-heart-3"},
			{src:"img/card-heart-4.png", id:"card-heart-4"},
			{src:"img/card-heart-5.png", id:"card-heart-5"},
			{src:"img/card-heart-6.png", id:"card-heart-6"},
			{src:"img/card-heart-7.png", id:"card-heart-7"},
			{src:"img/card-heart-8.png", id:"card-heart-8"},
			{src:"img/card-heart-9.png", id:"card-heart-9"},
			{src:"img/card-heart-10.png", id:"card-heart-10"},
			{src:"img/card-heart-1.png", id:"card-heart-A"},
			{src:"img/card-heart-j.png", id:"card-heart-J"},
			{src:"img/card-heart-q.png", id:"card-heart-Q"},
			{src:"img/card-heart-k.png", id:"card-heart-K"},
			//CardsSpades
			{src:"img/card-spade-2.png", id:"card-spade-2"},
			{src:"img/card-spade-3.png", id:"card-spade-3"},
			{src:"img/card-spade-4.png", id:"card-spade-4"},
			{src:"img/card-spade-5.png", id:"card-spade-5"},
			{src:"img/card-spade-6.png", id:"card-spade-6"},
			{src:"img/card-spade-7.png", id:"card-spade-7"},
			{src:"img/card-spade-8.png", id:"card-spade-8"},
			{src:"img/card-spade-9.png", id:"card-spade-9"},
			{src:"img/card-spade-10.png", id:"card-spade-10"},
			{src:"img/card-spade-1.png", id:"card-spade-A"},
			{src:"img/card-spade-j.png", id:"card-spade-J"},
			{src:"img/card-spade-q.png", id:"card-spade-Q"},
			{src:"img/card-spade-k.png", id:"card-spade-K"},
			//Card Back
			{src:"img/card-back.png", id:"card_back_img"},
			//Load all sound
			//Ogg
			{src:"sound/Click.ogg", id:"Click_ogg"},
			{src:"sound/cardPlace.ogg", id:"cardPlace_ogg"},
			{src:"sound/chipsCollide.ogg", id:"chipsCollide_ogg"},
			{src:"sound/chipsHandle.ogg", id:"chipsHandle_ogg"},
			{src:"sound/cardShove.ogg", id:"cardShove_ogg"},
			{src:"sound/tie.ogg", id:"Tie_ogg"},
			{src:"sound/youWin.ogg", id:"youwin_ogg"},
			{src:"sound/youLose.ogg", id:"youlose_ogg"},
			//M4a
			{src:"sound/Click.m4a", id:"Click_m4a"},
			{src:"sound/cardPlace.m4a", id:"cardPlace_m4a"},
			{src:"sound/chipsCollide.m4a", id:"chipsCollide_m4a"},
			{src:"sound/chipsHandle.m4a", id:"chipsHandle_m4a"},
			{src:"sound/cardShove.m4a", id:"cardShove_m4a"},
			{src:"sound/tie.m4a", id:"Tie_m4a"},
			{src:"sound/youWin.m4a", id:"youwin_m4a"},
			{src:"sound/youLose.m4a", id:"youlose_m4a"},
		];

		this.preload = new createjs.LoadQueue(true);
		this.preload.installPlugin(createjs.Sound);
		this.preload.on("complete", this.loaded.bind(this));
		this.preload.on("progress", this.onload.bind(this));
		this.preload.loadManifest(manifest, true,"https://itsinhaleyo.online/games/baccarat/assets/");
	}
	this.onload = function(){
		this.progressbar.scaleX = this.preload.progress;
	}
	this.loaded = function(){
		stage.removeAllChildren();
		//Check audio format supported
		if(document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"') == ''){
			//Ogg not supported
			this.audio_format = 'm4a';
		}
		this.initialize();
	}
	this.update = function(){
		stage.update();
	}
	this.initialize = function(){
		this.font = new createjs.SpriteSheet({
			"animations": {
				"0": {"frames": [0]},
				"1": {"frames": [1]},
				"2": {"frames": [2]},
				"3": {"frames": [3]},
				"4": {"frames": [4]},
				"5": {"frames": [5]},
				"6": {"frames": [6]},
				"7": {"frames": [7]},
				"8": {"frames": [8]},
				"9": {"frames": [9]},
			},
			"images": ["https://itsinhaleyo.online/games/baccarat/font/font.png"],
			"frames": {"width":27,"height":44,"count":10,"regX":27/2,"regY":44/2}
		});
		
		this.to_menu();
	}
	this.img = function(e){
		return this.preload.getResult(e);
	}
	this.center = function(obj){
		obj.regX = obj.getBounds().width/2;
		obj.regY = obj.getBounds().height/2;
	}
	this.play_sound = function(id){
		if(this.sound_enable == true){
			createjs.Sound.play(id+"_"+this.audio_format);
		}
	}
	this.to_menu = function(){
		this.state = "menu";
		
		var background = new createjs.Bitmap(this.img("bgMenu"));

		var title = new createjs.Bitmap(this.img("game_title"));
		title.setTransform(600, 260);
		title.regX = title.getBounds().width/2;
		title.regY = title.getBounds().height/2;

		this.b_play = new createjs.Bitmap(this.img("btn_play"));
		this.b_play.setTransform(640, 500);
		this.b_play.regX = this.b_play.getBounds().width/2;
		this.b_play.regY = this.b_play.getBounds().height/2;

		stage.addChild(background, this.b_play, title);

		this.b_play.on("click", function(e){
			this.play_sound("Click");
			createjs.Tween.get(e.target)
				.to({scaleX: 0.9,scaleY:0.9},100)
				.to({scaleX: 1,scaleY:1},100)
				.call(this.to_game.bind(this));
			}.bind(this));

		this.get_header();
	}
	this.to_game = function(){
		stage.removeAllChildren();
		this.state = "game";
		this.selected_opt = "player";

		//GAME
		var background = new createjs.Bitmap(this.img("bgMenu"));

		var t_player = new createjs.Bitmap(this.img("txt_player"));
		t_player.setTransform(464, 340);
		this.center(t_player);

		var t_banker = new createjs.Bitmap(this.img("txt_banker"));
		t_banker.setTransform(816, 340);
		this.center(t_banker);

		var h_player = new createjs.Bitmap(this.img("highlight"));
		h_player.setTransform(464, 448);
		h_player.name = "player";
		h_player.alpha = 0.05;
		this.center(h_player);

		var h_tie = new createjs.Bitmap(this.img("highlight"));
		h_tie.setTransform(640, 468);
		h_tie.name = "tie";
		h_tie.alpha = 0.05;
		this.center(h_tie);

		var h_banker = new createjs.Bitmap(this.img("highlight"));
		h_banker.setTransform(816, 448);
		h_banker.name = "banker";
		h_banker.alpha = 0.05;
		this.center(h_banker);

		this.highlights.addChild(h_player, h_tie, h_banker);

		//Set HitArea for highlights
		for(var i=0; i<3; i++){
			var child = this.highlights.getChildAt(i);
			var hit = new createjs.Shape();
			hit.graphics.beginFill("#000").drawRect(0, 0, child.getBounds().width, child.getBounds().height);
			child.hitArea = hit;
		} //end
		this.highlights.on("click", function(e){
			this.selected_option(e.target.name);
		}.bind(this));

		//Generate selected bet
		for(var i=0; i<3; i++){
			var child = this.highlights.getChildAt(i);
			var s = new createjs.Bitmap(this.img("selected_"+child.name));
			s.setTransform(child.x, child.y);
			//s.alpha = 0;
			s.name = child.name;
			this.center(s);
			if(child.name == "player"){
				child.alpha = 1;
				this.cur_pos[0] = s.x;
				this.cur_pos[1] = s.y;
			}
			this.selected.addChild(s);
		} //end

		//Generate bet bar
		for(var i=0; i<3; i++){
			var child = this.highlights.getChildAt(i);
			var s = new createjs.Bitmap(this.img("bet_bar"));
			s.setTransform(child.x, child.y);
			s.alpha = 0;
			s.name = child.name;
			this.center(s);
			s.y += 90;
			this.bet_bar.addChild(s);
		} //end

		//Generate text bet value
		for(var i=0; i<3; i++){
			var child = this.bet_bar.getChildAt(i);
			var s = new createjs.BitmapText("", this.font);
			s.textAlign = "center";
			s.setTransform(child.x, child.y);
			s.name = child.name;
			s.scaleX = s.scaleY = 0.5;
			this.bet_txts.addChild(s);
		} //end

		var history = new createjs.Bitmap(this.img("history"));
		history.setTransform(1168, 240);
		this.center(history);

		var start_x =1136;
		var start_y =170;
		var space_x = 64;
		var space_y = 33;
		var count_x = 0;
		var count_y = 0;
		for(var i=0; i<10; i++){
			var s = new createjs.BitmapText("", this.font);
			s.textAlign = "center";
			s.setTransform(start_x+(space_x*count_x), start_y+(space_y*count_y));
			s.id = i;
			s.scaleX = s.scaleY = 0.4;
			this.txt_history.addChild(s);

			count_x++;
			if(count_x == 2){
				count_y++;
				count_x = 0;
			}
		}

		this.value_bar_1 = new createjs.Bitmap(this.img("card_value"));
		this.value_bar_1.setTransform(400, 280);
		this.center(this.value_bar_1);

		this.value_bar_2 = new createjs.Bitmap(this.img("card_value"));
		this.value_bar_2.setTransform(720, 280);
		this.center(this.value_bar_2);

		this.card_pack = new createjs.Bitmap(this.img("_cards"));
		this.card_pack.setTransform(160, 280);
		this.card_pack.regX = this.card_pack.getBounds().width/2;
		this.card_pack.regY = this.card_pack.getBounds().height/2;

		var betBar = new createjs.Bitmap(this.img("total_bet_bar"));
		betBar.setTransform(1050, 478);
		this.center(betBar);

		this.bet = 0;

		this.txt_bet = new createjs.BitmapText(this.bet.toString(), this.font);
		this.txt_bet.textAlign = "center";
		this.txt_bet.setTransform(1040, 478);
		this.txt_bet.scaleX = this.txt_bet.scaleY = 0.7;

		this.b_clear = new createjs.Bitmap(this.img("btn_clear"));
		this.b_clear.setTransform(1160, 478);
		this.b_clear.regX = this.b_clear.getBounds().width/2;
		this.b_clear.regY = this.b_clear.getBounds().height/2;

		this.b_clear.on("click", function(){
			this.bet = 0;
			this.update_bet_child(0, "clear");
			this.update_bet();

			this.b_clear.alpha = 0;
			this.b_deal.alpha = 0;
			this.chips_move.removeAllChildren();
		}.bind(this));

		this.txt_player = new createjs.BitmapText("", this.font);
		this.txt_player.setTransform(this.value_bar_1.x, this.value_bar_1.y);
		this.txt_player.scaleX = this.txt_player.scaleY = 0.6;
		this.txt_player.textAlign = "center";

		this.txt_dealer = new createjs.BitmapText("", this.font);
		this.txt_dealer.setTransform(this.value_bar_2.x, this.value_bar_2.y);
		this.txt_dealer.scaleX = this.txt_dealer.scaleY = 0.6;
		this.txt_dealer.textAlign = "center";

		stage.addChild(background, t_player, t_banker, history, this.txt_history, this.highlights, this.selected, this.cards, this.card_back, this.card_pack, this.chips_move, this.chips);
		stage.addChild(this.value_bar_1, this.value_bar_2, this.txt_player, betBar, this.txt_bet, this.txt_dealer, this.b_clear, this.bet_bar, this.bet_txts);

		//Hide this.value_bar on game start
		this.value_bar("hide");

		this.game_end = stage.addChild(new createjs.Container());

		this.get_header();
		//END GAME

		this.buttons = stage.addChild(new createjs.Container());

		this.b_deal = new createjs.Bitmap(this.img("btn_deal"));
		this.b_deal.setTransform(1110, 640);
		this.b_deal.regX = this.b_deal.getBounds().width/2;
		this.b_deal.regY = this.b_deal.getBounds().height/2;
		this.b_deal.alpha = 0;
		this.b_deal.name = "btn_deal";

		this.chips_sheet = new createjs.SpriteSheet({
			"images": [this.img("chips")],
			"frames": {"width":64,"height":64,"count":4,"regX":32,"regY":32},
			"animations": {
				"animate": [0,3]
			}
		})
		this.chips_stack_sheet = new createjs.SpriteSheet({
			"images": [this.img("chips_stack")],
			"frames": {"width":128,"height":128,"count":4,"regX":64,"regY":64},
			"animations": {
				"animate": [0,3]
			}
		})

		for(i=4; i>0; i--){
			var chip = new createjs.Sprite(this.chips_stack_sheet);
			chip.x = 0+(128*i);
			chip.y = 640;
			chip.gotoAndStop(i-1);
			this.chips.addChild(chip);
			chip.on("click", this.chips_click.bind(this));
		}

		this.buttons.addChild(this.b_deal);

		this.buttons.on("click", this.btn_click.bind(this));

		this.set_button_visible();
	}
	this.get_header = function(){
		var moneyBar = new createjs.Bitmap(this.img("moneyBar"));
		moneyBar.setTransform(148, 54);
		moneyBar.regX = moneyBar.getBounds().width/2;
		moneyBar.regY = moneyBar.getBounds().height/2;

		var btnSound = new createjs.Bitmap(this.img("btnSound"));
		btnSound.setTransform(1134, 60);
		btnSound.regX = btnSound.getBounds().width/2;
		btnSound.regY = btnSound.getBounds().height/2;
		btnSound.name = "sound";

		var btnMenu = new createjs.Bitmap(this.img("btnMenu"));
		btnMenu.setTransform(1052, 60);
		btnMenu.regX = btnMenu.getBounds().width/2;
		btnMenu.regY = btnMenu.getBounds().height/2;
		btnMenu.name = "menu";

		var btnAbout = new createjs.Bitmap(this.img("btnAbout"));
		btnAbout.setTransform(1052, 60);
		btnAbout.regX = btnAbout.getBounds().width/2;
		btnAbout.regY = btnAbout.getBounds().height/2;
		btnAbout.name = "about";

		var btnFullscreen = new createjs.Bitmap(this.img("btnFullscreen"));
		btnFullscreen.setTransform(1216, 60);
		btnFullscreen.regX = btnFullscreen.getBounds().width/2;
		btnFullscreen.regY = btnFullscreen.getBounds().height/2;
		btnFullscreen.name = "fullscreen";

		var btnHome = new createjs.Bitmap(this.img('btnHome'));
		btnHome.setTransform(970,60);
		btnHome.regX = btnHome.getBounds().width/2;
		btnHome.regY = btnHome.getBounds().height/2;
		btnHome.name = 'btn_home';

		this.btn_gui = new createjs.Container();
		stage.addChild(moneyBar,this.btn_gui);

		if(this.state == "game"){
			this.btn_gui.addChild(btnMenu);
		} else {
			this.btn_gui.addChild(btnAbout);
		}

		this.btn_gui.addChild(btnSound,btnFullscreen,btnHome);
		this.btn_gui.on("click", this.btn_tween.bind(this));

		var about_c = stage.addChild(new createjs.Container());

		//About
		btnAbout.on('click', function(){
			if(this.state == 'menu'){
				var popup = new createjs.Bitmap(this.img("about_window"));
				popup.setTransform(640, 340);
				popup.regX = popup.getBounds().width/2;
				popup.regY = popup.getBounds().height/2;
				popup.shadow = new createjs.Shadow("#000000", -1, 1, 20);

				var content = new createjs.Bitmap(this.img("about_content"));
				content.setTransform(640, 340);
				content.regX = content.getBounds().width/2;
				content.regY = content.getBounds().height/2;

				about_c.addChild(popup, content);
				setTimeout(function(){
					this.state = 'about';
				}.bind(this), 100)
			}
		}.bind(this))

		about_c.on('click', function(){
			if(this.state == 'about'){
				this.state = 'menu';
				about_c.removeAllChildren();
			}
		}.bind(this))

		//Fullscreen button
		btnFullscreen.on("click", function(){
			if(this.is_fullscreen == false){
				screenfull.request();
				this.is_fullscreen = true;
			}
			else {
				screenfull.exit();
				this.is_fullscreen = false;
			}
		}.bind(this));

		if(this.sound_enable == false){
			btnSound.alpha = 0.4;
		}
		
		this.txt_cash = new createjs.BitmapText(this.cur_cash.toString(), this.font);
		this.txt_cash.setTransform(140, 54);
		this.txt_cash.scaleX = this.txt_cash.scaleY = 0.7;
		stage.addChild(this.txt_cash);
	}
	this.update_history = function(){
		for(var i=0; i<10; i++){
			if(this.history_value[i] >= 0){
				var child = this.txt_history.getChildAt(i);
				child.text = this.history_value[i].toString();
			}
		}
	}
	this.value_bar = function(e){
		if(e == "hide"){
			this.value_bar_1.alpha = this.value_bar_2.alpha = 0;
			this.txt_dealer.text = this.txt_player.text = "";
		}
		else{
			this.value_bar_1.alpha = this.value_bar_2.alpha = 1;
		}
	}
	this.btn_click = function(e){
		this.play_sound("Click");

		if(this.is_ready == true && this.cur_player == "player"){
			this.is_ready = false;
			createjs.Tween.get(e.target)
				.to({scaleX:0.8, scaleY:0.8},100)
				.to({scaleX:1, scaleY:1},100)
				.call(function(){
					var name = e.target.name;
					
					//Button click
					if(name == "btn_deal"){
						if(this.cur_cash > 0){
							this.deal();
						}
						else {
							if(this.reload_money){
								this.is_ready = true;
								if(confirm("YOU DON'T HAVE ENOUGH MONEY!\n\nPress \"OK\" to get 500 coins!") == true){
									//Reload money if 0
									this.cur_cash = this.reload_money_amount;
									this.txt_cash.text = this.cur_cash.toString();

									if(this.save_money == true){
										localStorage.setItem("cash", this.cur_cash);
									}
								}
							} else {
								alert("YOU DON'T HAVE ENOUGH MONEY!");
							}
						}
					}
				}.bind(this));
		}
	}
	this.selected_option = function(e){
		this.selected_opt = e;
		for(var i=0; i<3; i++){
			var child = this.selected.getChildAt(i);
			var child_hl = this.highlights.getChildAt(i);
			child_hl.alpha = 0.05;
			if(child.name == e){
				child_hl.alpha = 1;
				this.cur_pos[0] = child.x;
				this.cur_pos[1] = child.y;
			}
		}
	}
	this.flash = function(e){
		for(var i=0; i<3; i++){
			var child = this.highlights.getChildAt(i);
			child.alpha = 0.05;

			if(child.name == e){
				var count = 0;
				var sw = 0;
				var time = setInterval(hl_flash, 150);

				function hl_flash(){
					count++;
					if(sw == 0){
						child.alpha = 1;
						sw = 1;
					} else {
						child.alpha = 0.05;
						sw = 0;
					}
					if(count == 14){
						clearInterval(time);
					}
				}
				break;
			}
		}
	}
	this.chips_click = function(e){
		var value = e.target.currentFrame;

		var result = this.check_bet_value(value);

		if(this.bet <= this.cur_cash-result && this.chips_ready == true){
			this.chips_ready = false;
			this.play_sound("chipsHandle");
			createjs.Tween.get(e.target)
				.to({scaleX:0.9, scaleY:0.9},100)
				.to({scaleX:1, scaleY:1},100)
				.call(function(){
					this.set_bet(value);
					this.spawn_chips(value);
					this.chips_ready = true;
					this.b_deal.alpha = 1;
				}.bind(this));
		}
		else if(this.bet > this.cur_cash-result && this.cur_cash > 0){
			alert("YOU DON'T HAVE ENOUGH MONEY!");
		}
		else if(this.cur_cash == 0){
			if(this.reload_money){
				if(confirm("YOU DON'T HAVE ENOUGH MONEY!\n\nPress \"OK\" to get 500 coins!") == true){
					//Reload money if 0
					this.cur_cash = this.reload_money_amount;
					this.txt_cash.text = this.cur_cash.toString();

					if(this.save_money == true){
						localStorage.setItem("cash", this.cur_cash);
					}
				}
			}
			else {
				alert("YOU DON'T HAVE ENOUGH MONEY!");
			}
		}
	}
	this.check_bet_value = function(e){
		//10
		if (e == 0){
			return 10;
		}
		//20
		else if (e == 1){
			return 20;
		}
		//50
		else if (e == 2){
			return 50;
		}
		//100
		else if (e == 3){
			return 100;
		}
	}
	this.spawn_chips = function(e){
		var t_x = this.cur_pos[0];
		var t_y = this.cur_pos[1];
		var randX = Math.round(Math.random()*40+(t_x-20));
		var randY = Math.round(Math.random()*40+(t_y-20));

		var chip = new createjs.Sprite(this.chips_sheet);
		chip.gotoAndStop(e);
		chip.tag = this.selected_opt;
		chip.x = 640;
		chip.y = 760;
		this.chips_move.addChild(chip);

		createjs.Tween.get(chip)
			.to({x:randX, y:randY}, 300)
			.call(function(){
				this.play_sound("chipsCollide");
			}.bind(this))
	}
	this.set_bet = function(e){
		var result = 0;
		//10
		if (e == 0){
			result = 10;
		}
		//20
		else if (e == 1){
			result = 20;
		}
		//50
		else if (e == 2){
			result = 50;
		}
		//100
		else if (e == 3){
			result = 100;
		}

		this.bet += result;

		this.update_bet();
		this.update_bet_child(result, "update");

		if(this.b_clear.alpha == 0){
			this.b_clear.alpha = 1;
		}
	}
	this.update_bet = function(){
		this.txt_bet.text = this.bet.toString();
		this.txt_bet.regX = this.txt_bet.getBounds().width/2;
		this.txt_bet.x = 1040+22;
	}
	this.update_bet_child = function(e, type){
		if(type == "update"){
			this.bet_bar.alpha = 1;

			for(var i=0; i<3; i++){
				var child = this.bet_txts.getChildAt(i);

				if(child.name == this.selected_opt){
					if(this.bet_value[i] == 0){
						var bet = this.bet_bar.getChildAt(i);
						bet.alpha = 1;
					}
					this.bet_value[i] += e;
					child.text = this.bet_value[i].toString();
					child.regX = child.getBounds().width/2;
				} else {
					if(this.bet_value[i] == 0){
						var bet = this.bet_bar.getChildAt(i);
						bet.alpha = 0;
					}
				}
			}
		} else if(type == "clear"){
			this.bet_value = [0,0,0];
			this.bet_bar.alpha = 0;
			for(var i=0; i<3; i++){
				var child = this.bet_txts.getChildAt(i);
				child.text = "";
			}
		}	
	}
	this.btn_tween = function(e){
		var child = e.target;
		createjs.Tween.get(child)
			.to({scaleX:0.9,scaleY:0.9},100)
			.to({scaleX:1,scaleY:1},100)
			.call(function(){
				this.btn_ui(e);
			}.bind(this))
	}
	this.btn_ui = function(e){
		var name = e.target.name;
		
		if(name == "menu"){
			//Go to main menu
			this.update_bet_child(0, "clear");
			stage.removeAllChildren();
			this.chips_move.removeAllChildren();
			this.cards.removeAllChildren();
			this.card_back.removeAllChildren();
			this.selected.removeAllChildren();
			this.bet_txts.removeAllChildren();
			this.highlights.removeAllChildren();
			this.bet_bar.removeAllChildren();
			this.txt_history.removeAllChildren();
			this.to_menu();
		}
		else if(name == "sound"){
			//Set sound
			if(this.sound_enable == true){
				this.sound_enable = false;
				e.target.alpha = 0.4;
			}
			else {
				this.sound_enable = true;
				e.target.alpha = 1;
			}
		} else if (name == "btn_home") {
            window.location.href = "https://itsinhaleyo.online/casino";
		}
	}
	this.update_cash = function(){
		this.txt_cash.text = this.cur_cash.toString();

		//Save current money
		if(this.save_money == true){
			localStorage.setItem("cash", this.cur_cash);
		}
	}
	this.deal = function(){
		this.card_reset();
		this.value_bar("show");

		this.b_clear.alpha = 0;

		this.player_value = 0;

		this.hit();

		this.cur_cash -= this.bet;
		this.update_cash();

		this.b_deal.alpha = 0;
		this.chips.alpha = 0;

		/*if(this.bet == 10 && this.chips_move.children.length == 0){
			this.spawn_chips(0);
		}*/
	}
	this.hit = function(){

		var random =  this.generate_card("player");
		this.player_value += this.check_card(random);
		if(this.player_value > 9){
			this.player_value -= 10;
		}

		this.player_hit_count++;

		if(this.player_hit_count == 2){
			if(this.player_value == 8 || this.player_value == 9){
				this.player_natural = true;
			}
		}

		this.add_card("player", random, this.player_hit_count);
	}

	this.dealer_hit = function(){
		var random = this.generate_card("dealer");
		this.dealer_value += this.check_card(random);
		if(this.dealer_value > 9){
			this.dealer_value -= 10;
		}
		this.dealer_hit_count++;

		if(this.dealer_hit_count == 2){
			if(this.dealer_value == 8 || this.dealer_value == 9){
				this.dealer_natural = true;
			}
		}

		this.add_card("dealer", random, this.dealer_hit_count);
	}

	this.dealer_value;
	this.dealer_value_visible;
	this.txt_dealer;
	this.player_hit_count = 0;
	this.dealer_hit_count = 0;

	this.card_reset = function(){
		var max = this.cards.children.length;

		this.cards.removeAllChildren();
		this.card_back.removeAllChildren();
		this.game_end.removeAllChildren();

		this.player_value = 0;
		this.dealer_value = 0;

		this.player_hit_count = 0;
		this.dealer_hit_count = 0;

		this.player_natural = false;
		this.dealer_natural = false;
	}
	this.generate_card = function(type){

		var rand = Math.round(Math.random()*4);
		var result;

		if (rand == 3) {
			var rand2 = Math.round(Math.random()*3+1);

			if(rand2 == 1) {
				result = "A";
			}

			if(rand2 == 2) {
				result = "J";
			}

			if(rand2 == 3) {
				result = "Q";
			}

			if(rand2 == 4) {
				result = "K";
			}
		}

		else {
			var value = Math.round(Math.random()*8+2);
			result = value;
		}

		if(type !== "tie" && this.dealer_hit_count >= 1){
			var plus = this.check_card(result);
			var r = Math.round(Math.random()*1);
			if(type == "player"){
				if(this.player_value+plus == this.dealer_value){
					result = this.generate_card("tie");
				}
			} else if(type == "dealer"){
				if(this.player_value == this.dealer_value+plus){
					result = this.generate_card("tie");
				}
			}
		}

		if(type !== "tie"){
			var data = {
				type: type,
				card: result,
				value: this.check_card(result),
			};
		}

		return result;
	}
	this.check_card = function(e){
		var tmp;
		if(e <= 10){
			if( e <= 9){
				tmp = e;
			} else if(e == 10){
				tmp = 0;
			}
		}

		else{
			if(e == "J" || e == "Q" || e == "K") {
				tmp = 0;
			}
			else if(e == "A"){
				if(this.player_hit_count <= 1 || this.dealer_hit_count <= 1){
					tmp = 1;
				}
				else {
					tmp = 1;
				}
			}
		}

		return tmp;
	}
	this.set_button_visible = function(){
		//this.b_deal.alpha = 1;
		this.chips.alpha = 1;

		this.is_ready = true;
		this.cur_player = "player";
		this.b_clear.alpha = 0;

		this.value_bar("hide");
	}
	this.check_winner = function(){
		var result;
		var id;

		if (this.player_value > this.dealer_value){
			if (this.player_value <= 9){
				result = "player"; //Player win
				id = 0;
			}
		} else if (this.player_value == this.dealer_value){
			result = "tie"; //Push
			id = 1;
		} else if (this.player_value < this.dealer_value){
			if (this.dealer_value <= 9) {
				result = "banker"; //Banker win
				id = 2;
			}
		}
		this.flash(result);

		this.history_value.unshift(this.player_value, this.dealer_value);
		this.update_history();

		function is_win(){
			var lose_count = 0;
			var win_count = 0;
			for(var i=0; i<3; i++){
				if(i == id){
					if(this.bet_value[i] > 0){
						win_count++;
						if(result == "tie"){
							this.cur_cash += this.bet_value[i]*8;
						} else {
							this.cur_cash += this.bet_value[i]*2;
						}
						this.get_chips("win", i);
					} else {
						lose_count++;
					}
				} else {
					if(this.bet_value[i] > 0){
						lose_count++;
						if(result == "tie"){
							this.cur_cash += this.bet_value[i];
							this.get_chips("win", i);
						} else {
							this.get_chips("lose", i);
						}
					}
				}
			}
			if(result == "tie") {
				this.play_sound("Tie");
				this.spawn_image("tie");
			} else if(lose_count == 0){
				this.play_sound("youwin");
				this.spawn_image("win");
				var xhr = new XMLHttpRequest();
				xhr.open("POST", "https://itsinhaleyo.online/callback/baccarat/win", true);
				xhr.setRequestHeader('Content-Type', 'application/json');
				xhr.send(JSON.stringify({'bet':this.bet_value}));
			} else if(win_count == 0){
				this.play_sound("youlose");
				this.spawn_image("lose");
				var xhr = new XMLHttpRequest();
				xhr.open("POST", "https://itsinhaleyo.online/callback/baccarat/lose", true);
				xhr.setRequestHeader('Content-Type', 'application/json');
				xhr.send(JSON.stringify({'bet':this.bet_value}));
			}
			
			this.update_cash();
		}
		setTimeout(is_win.bind(this), 1000);
		setTimeout(this.cards_up.bind(this), 4000);
	}
	this.cards_up = function(){
		var num = this.cards.children.length;
		var _type = typeof this.game_end.getChildAt(0);
		if(_type == "object"){
			createjs.Tween.get(this.game_end.getChildAt(0))
			.to({y:700}, 300, createjs.Ease.sineIn)
			.call(function(){
				this.game_end.removeAllChildren()
			}.bind(this));
		}

		var target_x = this.card_pack.x;
		var target_y = this.card_pack.y;

		for(i=0; i<num; i++){
			var child = this.cards.getChildAt(i);

			createjs.Tween.get(child)
				.to({x:target_x, y:target_y}, 350)
				.call(function(){
					this.cards.removeAllChildren();

					this.bet = 0;
					this.update_bet_child(0, "clear");
					this.update_bet();

					this.set_button_visible();
					for(var j=0; j<3; j++){
						var child2 = this.highlights.getChildAt(j);
						if(child2.name == this.selected_opt){
							child2.alpha = 1;
						}
					}
				}.bind(this))
		}
	}
	this.spawn_image = function(e){
		var result = new createjs.Bitmap(this.img(e));
		result.setTransform(canvas.width/2, 700);
		result.regX = result.getBounds().width/2;
		result.regY = result.getBounds().height/2;

		this.game_end.addChild(result);

		createjs.Tween.get(result)
		.to({y:360}, 500, createjs.Ease.backOut);
	}
	this.get_chips = function(e, id){
		var num = this.chips_move.children.length;
		var name = define_id(id);

		function define_id(x){
			if(x == 0){
				return "player";
			} else if(x == 1){
				return "tie";
			} else if(x == 2){
				return "banker";
			}
		}

		if(e == "win"){
			for(var i=0; i<num; i++){
				var child = this.chips_move.getChildAt(i);
				if(child.tag == name){
					createjs.Tween.get(child)
						.to({x:640, y:780}, 500)
						.call(function(){
							this.chips_move.removeAllChildren();
						}.bind(this))
				}	
			}
		}

		else if(e == "lose"){
			for(var i=0; i<num; i++){
				var child = this.chips_move.getChildAt(i);
				if(child.tag == name){
					createjs.Tween.get(child)
						.to({x:640, y:-50}, 500)
						.call(function(){
							this.chips_move.removeAllChildren();
						}.bind(this))
				}
			}
		}
	}
	this.random_card = function(){
		var num = Math.round(Math.random()*3+1);

		if (num == 1){
			return "-club-";
		}

		else if (num == 2){
			return "-diamond-";
		}

		else if (num == 3){
			return "-spade-";
		}

		else if (num == 4){
			return "-heart-";
		}
	}
	this.dealer_flip = {
		a: 0,
		b: 0,
	}
	this.add_card = function(e, random, hitcount){
		var cardSpeed = 400;
		var cardType = this.random_card();
		this.play_sound("cardShove");
		
		var posX;
		if(e == "player"){
			posX = 480+(25*hitcount);
		} else if(e == "dealer"){
			posX = 800+(25*hitcount);
		}
		var posY = 220;
		this.is_tween = true;

		var card = new createjs.Bitmap(this.img("card"+cardType+random));
			card.setTransform(this.card_pack.x, this.card_pack.y);
		card.regX = card.getBounds().width/2;
		card.regY = card.getBounds().height/2;
		card.name = e;
		card.alpha = 0;
		card.shadow = new createjs.Shadow("#000000", -1, 1, 20);

		var cardB = new createjs.Bitmap(this.img("card_back_img"));
		cardB.setTransform(card.x, card.y);
		cardB.regX = cardB.getBounds().width/2;
		cardB.regY = cardB.getBounds().height/2;
			
		this.cards.addChild(card);
		this.card_back.addChild(cardB);

		createjs.Tween.get(cardB)
			.to({x:posX, y:posY}, cardSpeed)
			.call(function(){
				this.set_card_position(e);
				this.play_sound("cardPlace");
			}.bind(this));
	}

	this.set_card_position = function(e){
		var num = this.card_back.children.length;
		var trigger = true;
		
		for(i=0; i<num; i++){
			if(this.cards.children[i].name == e){
				var child = this.card_back.getChildAt(i);
				var childCard = this.cards.getChildAt(i);
				var target = child.x-25;

				createjs.Tween.get(childCard)
					.to({x:target},100);

				createjs.Tween.get(child)
					.to({x:target},100)
					.call(function(){

							//this.dealer_flip.a = child;
							//this.dealer_flip.b = childCard;

						if(trigger == true) {

							this.flip_card(child, childCard);
									
							if(e == "player") {
								this.is_tween = false;
								this.txt_player.text = this.player_value.toString();
								this.txt_player.regX = this.txt_player.getBounds().width/2;
								this.txt_player.x = this.value_bar_1.x+12;

								//On start
								if(this.dealer_hit_count < 2){
									//this.hit();
									this.dealer_hit();
								} else if(this.dealer_hit_count == 2 && this.dealer_value < 6 && this.player_natural == false){
									this.dealer_hit();
								} else if(this.dealer_hit_count == 2 && this.player_hit_count == 2 && this.player_value < 6 && this.dealer_natural == false){
									this.hit();
								} else {
									this.check_winner();
								}
							}

							if(e == "dealer") {
								this.txt_dealer.text = this.dealer_value.toString();
								this.txt_dealer.regX = this.txt_dealer.getBounds().width/2;
								this.txt_dealer.x = this.value_bar_2.x+12;

								if(this.player_hit_count < 2){
									//this.dealer_hit();
									this.hit();
								} else if(this.player_hit_count == 2 && this.player_value < 6 && this.dealer_natural == false){
									this.hit();
								} else if(this.player_hit_count == 2 && this.dealer_hit_count == 2 && this.dealer_value < 6 && this.player_natural == false){
									this.dealer_hit();
								} else {
									this.check_winner();
								}
							}
						}
						trigger = false;

					}.bind(this));
			}
		}
		
	}
	this.flip_card = function(e, i){
		createjs.Tween.get(e)
			.to({scaleX:0},100)
			.call(function(){
				
				var child = i;
				child.alpha = 1;

				child.x = e.x;
				child.y = e.y;
				child.scaleX = 0;
				createjs.Tween.get(child)
					.to({scaleX:1},100)
					.call(function(){
						/*if(this.dealer_hit_count >= 2){
							this.is_ready = true;
						}*/
					}.bind(this))
			}.bind(this))
	}
}

var p = new Game();

(function () {
  
  var game = {
	  element: document.getElementById("canvas"),
	  width: canvas.width,
	  height: canvas.height
  },
  
  resizeGame = function () {
		
	  var viewport, newGameWidth, newGameHeight, newGameX, newGameY;
				
	  // Get the dimensions of the viewport
	  viewport = {
		  width: window.innerWidth,
		  height: window.innerHeight
	  };
	  
	  // Determine game size
	  if (game.height / game.width > viewport.height / viewport.width) {
		newGameHeight = viewport.height;
		newGameWidth = newGameHeight * game.width / game.height;  
	  } else {
		newGameWidth = viewport.width;
		newGameHeight = newGameWidth * game.height / game.width;		 
	  }
  
	  game.element.style.width = newGameWidth + "px";
	  game.element.style.height = newGameHeight + "px";
	  
	  newGameX = (viewport.width - newGameWidth) / 2;
	  newGameY = (viewport.height - newGameHeight) / 2;

	  // Set the new padding of the game so it will be centered
	  game.element.style.padding = newGameY + "px " + newGameX + "px";
  };
  
  window.addEventListener("resize", resizeGame);
  resizeGame();
}())