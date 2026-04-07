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
    this.font2;
    this.preload;
    this.btn_gui;
    this.value_bar_1;
    this.value_bar_2;
    this.is_fullscreen = false;
    this.save_money = false; //Set "true" if you want to save current player money using localStorage
    this.reload_money = true; //Reload money if player lose and current money are 0
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
    this.game_end; //Container to store push/win/lose or blackjack image
    this.cards = new createjs.Container();
    this.cur_cash; //Default cash/money value
    this.bet;
    this.b_double;
    this.b_double2;
    this.b_deal;
    this.b_hit;
    this.b_stand;
    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", "https://itsinhaleyo.online/callback/gameinit", true);
    xhttp.setRequestHeader('Content-Type', 'application/json');
    xhttp.onload = () => {
        const userbal = JSON.parse(xhttp.responseText);
        this.cur_cash = userbal.Balance;
    };
    xhttp.send(JSON.stringify({'Balance': 'SystemCheck'}));
    this.load = function(){
        createjs.Ticker.timingMode = createjs.Ticker.RAF;
        createjs.Ticker.on("tick", this.update);

        var bg = new createjs.Bitmap("https://itsinhaleyo.online/games/blackjack/assets/img/background.png");

        this.progressbar = new createjs.Shape();
        this.progressbar.graphics.beginFill("white").drawRect(0,0,752,15);
        this.progressbar.setTransform(264, 520);

        var border = new createjs.Shape();
        border.graphics.beginStroke("white").drawRect(0,0,757,19);
        border.setTransform(262, 518);

        var title = new createjs.Bitmap("https://itsinhaleyo.online/games/blackjack/assets/img/gameTitle.png");
        title.setTransform(640, 260);
        title.regX = 427;
        title.regY = 177;

        stage.addChild(bg,title,this.progressbar, border);

        manifest = [
            {src:"img/background.png", id: "bgMenu"},
            {src:"img/moneyBar.png", id: "moneyBar"},
            {src:"img/btn-menu.png", id: "btnMenu"},
            {src:"img/btn-fullscreen.png", id: "btnFullscreen"},
            {src:"img/btn-sound.png", id: "btnSound"},
            {src:"img/btn-play.png", id: "btn_play"},
            {src:"img/btn-clear.png", id: "btn_clear"},
            {src:"img/gameTitle.png", id: "game_title"},
            {src:"img/cards.png", id: "_cards"},
            {src:"img/btn-hit.png", id: "btn_hit"},
            {src:"img/btn-stand.png", id: "btn_stand"},
            {src:"img/btn-home.png", id: "btn_home"},
            {src:"img/btn-deal.png", id: "btn_deal"},
            {src:"img/btn-double.png", id: "btn_double"},
            {src:"img/chips.png", id: "chips"},
            {src:"img/chips-stack.png", id: "chips_stack"},
            {src:"img/blackjack.png", id: "blackjack"},
            {src:"img/push.png", id: "push"},
            {src:"img/win.png", id: "win"},
            {src:"img/lose.png", id: "lose"},
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
            {src:"sound/Click.ogg", id:"Click"},
            {src:"sound/cardPlace.ogg", id:"cardPlace"},
            {src:"sound/chipsCollide.ogg", id:"chipsCollide"},
            {src:"sound/chipsHandle.ogg", id:"chipsHandle"},
            {src:"sound/cardShove.ogg", id:"cardShove"},
            {src:"sound/Push.ogg", id:"Push"},
            {src:"sound/youWin.ogg", id:"youWin"},
            {src:"sound/youLose.ogg", id:"youLose"},
        ];

        this.preload = new createjs.LoadQueue(true);
        this.preload.installPlugin(createjs.Sound);
        this.preload.on("complete", this.loaded.bind(this));
        this.preload.on("progress", this.onload.bind(this));
        this.preload.loadManifest(manifest, true,"https://itsinhaleyo.online/games/blackjack/assets/");
    }
    this.onload = function(){
        this.progressbar.scaleX = this.preload.progress;
    }
    this.loaded = function(){
        stage.removeAllChildren();
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
                "9": {"frames": [9]}
            },
            "images": ["https://itsinhaleyo.online/games/blackjack/font/font.png"],
            "frames": {"width":27,"height":44,"count":14,"regX":27/2,"regY":44/2}
        });
        this.to_menu();
    }

    this.img = function(e){
        return this.preload.getResult(e);
    }
    this.play_sound = function(id){
        if(this.sound_enable == true){
            createjs.Sound.play(id);
        }
    }
    this.to_menu = function(){
        this.state = "menu";
        
        var background = new createjs.Bitmap(this.img("bgMenu"));

        var title = new createjs.Bitmap(this.img("game_title"));
        title.setTransform(640, 260);
        title.regX = title.getBounds().width/2;
        title.regY = title.getBounds().height/2;

        this.b_play = new createjs.Bitmap(this.img("btn_play"));
        this.b_play.setTransform(640, 540);
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

        //Load saved money if localStorage (this.save_money) "true".
        if(this.save_money == true){
            var saved_cash = localStorage.getItem("cash");
            if(saved_cash !== null){
                this.cur_cash = saved_cash;
            }
        }

        this.get_header();
    }
    this.to_game = function(){
        stage.removeAllChildren();
        this.state = "game";

        //GAME
        var background = new createjs.Bitmap(this.img("bgMenu"));

        this.value_bar_1 = new createjs.Shape();
        this.value_bar_1.graphics.beginFill("#285A59").drawRect(0,0,68,54);
        this.value_bar_1.setTransform(780, 440);
        this.value_bar_1.regX = 68/2;
        this.value_bar_1.regY = 54/2;

        this.value_bar_2 = new createjs.Shape();
        this.value_bar_2.graphics.beginFill("#285A59").drawRect(0,0,68,54);
        this.value_bar_2.setTransform(400, 80);
        this.value_bar_2.regX = 68/2;
        this.value_bar_2.regY = 54/2;

        this.card_pack = new createjs.Bitmap(this.img("_cards"));
        this.card_pack.setTransform(160, 304);
        this.card_pack.regX = this.card_pack.getBounds().width/2;
        this.card_pack.regY = this.card_pack.getBounds().height/2;

        var betBar = new createjs.Shape();
        betBar.graphics.beginFill("#285A59").drawRect(0,0,120,54);
        betBar.setTransform(1050, 458);
        betBar.regX = 120/2;
        betBar.regY = 54/2;

        this.bet = 0;

        this.txt_bet = new createjs.BitmapText(this.bet.toString(), this.font);
        this.txt_bet.textAlign = "center";
        this.txt_bet.setTransform(1040, 458);
        this.txt_bet.scaleX = this.txt_bet.scaleY = 0.7;

        this.b_clear = new createjs.Bitmap(this.img("btn_clear"));
        this.b_clear.setTransform(1150, 458);
        this.b_clear.regX = this.b_clear.getBounds().width/2;
        this.b_clear.regY = this.b_clear.getBounds().height/2;

        this.b_clear.on("click", function(){
            this.bet = 0;
            this.update_bet();

            this.b_clear.alpha = 0;
            this.chips_move.removeAllChildren();
        }.bind(this));

        this.txt_player = new createjs.BitmapText("", this.font);
        this.txt_player.setTransform(this.value_bar_1.x, this.value_bar_1.y);
        this.txt_player.scaleX = this.txt_player.scaleY = 0.8;
        this.txt_player.textAlign = "center";

        this.txt_dealer = new createjs.BitmapText("", this.font);
        this.txt_dealer.setTransform(this.value_bar_2.x, this.value_bar_2.y);
        this.txt_dealer.scaleX = this.txt_dealer.scaleY = 0.8;
        this.txt_dealer.textAlign = "center";

        stage.addChild(background, this.cards, this.card_back, this.card_pack, this.chips_move, this.chips);
        stage.addChild(this.value_bar_1, this.value_bar_2, this.txt_player, betBar, this.txt_bet, this.txt_dealer, this.b_clear);

        //Hide this.value_bar on game start
        this.value_bar("hide");

        this.game_end = stage.addChild(new createjs.Container());

        this.get_header();
        //END GAME

        this.buttons = stage.addChild(new createjs.Container());

        this.b_deal = new createjs.Bitmap(this.img("btn_deal"));
        this.b_deal.setTransform(145, 640);
        this.b_deal.regX = this.b_deal.getBounds().width/2;
        this.b_deal.regY = this.b_deal.getBounds().height/2;
        this.b_deal.name = "btn_deal";

        this.b_double = new createjs.Bitmap(this.img("btn_double"));
        this.b_double.setTransform(880, 640);
        this.b_double.regX = this.b_double.getBounds().width/2;
        this.b_double.regY = this.b_double.getBounds().height/2;
        this.b_double.name = "btn_double";

        this.b_double2 = new createjs.Bitmap(this.img("btn_double"));
        this.b_double2.setTransform(365, 640);
        this.b_double2.regX = this.b_double2.getBounds().width/2;
        this.b_double2.regY = this.b_double2.getBounds().height/2;
        this.b_double2.name = "btn_double2";

        this.b_stand = new createjs.Bitmap(this.img("btn_stand"));
        this.b_stand.setTransform(145, 640);
        this.b_stand.regX = this.b_stand.getBounds().width/2;
        this.b_stand.regY = this.b_stand.getBounds().height/2;
        this.b_stand.name = "btn_stand";

        this.b_hit = new createjs.Bitmap(this.img("btn_hit"));
        this.b_hit.setTransform(1120, 640);
        this.b_hit.regX = this.b_hit.getBounds().width/2;
        this.b_hit.regY = this.b_hit.getBounds().height/2;
        this.b_hit.name = "btn_hit";

        this.chips_sheet = new createjs.SpriteSheet({
            "images": [this.img("chips")],
            "frames": {"width":128,"height":128,"count":4,"regX":64,"regY":64},
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
            chip.x = 744+(112*i);
            chip.y = 640;
            chip.gotoAndStop(i-1);
            this.chips.addChild(chip);
            chip.on("click", this.chips_click.bind(this));
        }

        this.buttons.addChild(this.b_deal,this.b_double,this.b_double2,this.b_hit,this.b_stand);

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
        
        var btnHome = new createjs.Bitmap(this.img("btn_home"));
        btnHome.setTransform(380, 46);
        btnHome.regX = btnHome.getBounds().width/2;
        btnHome.regY = btnHome.getBounds().height/2;
        btnHome.name = "home";

        var btnFullscreen = new createjs.Bitmap(this.img("btnFullscreen"));
        btnFullscreen.setTransform(1216, 60);
        btnFullscreen.regX = btnFullscreen.getBounds().width/2;
        btnFullscreen.regY = btnFullscreen.getBounds().height/2;
        btnFullscreen.name = "fullscreen";

        this.btn_gui = new createjs.Container();
        stage.addChild(moneyBar,this.btn_gui);

        if(this.state == "game"){
            this.btn_gui.addChild(btnMenu);
        }

        this.btn_gui.addChild(btnHome,btnSound,btnFullscreen);
        this.btn_gui.on("click", this.btn_tween.bind(this));

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
                            if(this.bet > 0){
                                this.deal();
                            } else {
                                this.is_ready = true;
                                if(confirm("YOU DON'T HAVE ENOUGH 1FC!") == true){
                                    
                                }
                        }
                    } else {
                            this.is_ready = true;
                            if(confirm("YOU DON'T HAVE ENOUGH MONEY!") == true){
                                window.location.href = "https://itsinhaleyo.online/casino";
                            }
                        }
                    }
                    else if(name == "btn_stand"){
                        if(this.cur_player == "player"){
                            this.dealer();
                        }
                    }
                    else if(name == "btn_double"){
                        this.double();
                    }
                    else if(name == "btn_double2"){
                        this.is_ready = true;
                        if(this.bet <= 0) {
                                this.is_ready = true;
                                alert("You Need To Set A Bet First!");
                        } else {
                            if(this.bet*2 <= this.cur_cash){
                                if(this.bet*2 <= this.cur_cash){
                                    if(5000>=this.bet*2){
                                        this.bet *= 2;
                                    } else {
                                        this.bet = 5000;
                                    }
                                }
                            }
                            else {
                                alert("YOU DON'T HAVE ENOUGH 1FC!");
                            }
                            this.txt_bet.text = this.bet.toString();
                            this.txt_bet.regX = this.txt_bet.getBounds().width/2;
                            this.txt_bet.x = 1040+22;
                        }
                    }
                    else if(name == "btn_hit"){
                        this.b_double.alpha = 0;

                        if(this.is_tween == false && this.cur_player == "player"){
                            this.hit();
                        }
                    }
                }.bind(this));
        }
    }
    this.chips_click = function(e){
        var value = e.target.currentFrame;

        var result = this.check_bet_value(value);
        
        if(this.bet+result > 5000){
            this.bet = 5000;
        } else {
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
                    }.bind(this));
            }
            else if(this.bet > this.cur_cash-result && this.cur_cash > 0){
                alert("YOU DON'T HAVE ENOUGH 1FC!");
            }
            else if(this.cur_cash == 0){
                if(confirm("YOU DON'T HAVE ENOUGH 1FC!\n\nClaim the Faucet to get more Tokens!") == true){
                    window.location.href = "https://itsinhaleyo.online/";
                }
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
        var randX = Math.round(Math.random()*150+1000);
        var randY = Math.round(Math.random()*200+180);

        var chip = new createjs.Sprite(this.chips_sheet);
        chip.gotoAndStop(e);
        chip.x = 1366;
        chip.y = 304;
        this.chips_move.addChild(chip);

        createjs.Tween.get(chip)
            .to({x:randX, y:randY}, 300)
            .call(function(){
                this.play_sound("chipsCollide");
            }.bind(this))
    }
    this.set_bet = function(e){
        //10
        if (e == 0){
            this.bet += 10;
        }
        //20
        else if (e == 1){
            this.bet += 20;
        }
        //50
        else if (e == 2){
            this.bet += 50;
        }
        //100
        else if (e == 3){
            this.bet += 100;
        }

        this.update_bet();

        if(this.b_clear.alpha == 0){
            this.b_clear.alpha = 1;
        }
    }
    this.update_bet = function(){
        this.txt_bet.text = this.bet.toString();
        this.txt_bet.regX = this.txt_bet.getBounds().width/2;
        this.txt_bet.x = 1040+22;
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
            stage.removeAllChildren();
            this.chips_move.removeAllChildren();
            this.cards.removeAllChildren();
            this.card_back.removeAllChildren();
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
        }
        else if(name == "home"){
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

        this.b_hit.alpha = this.b_stand.alpha = this.b_double.alpha = 1;
        this.b_deal.alpha = this.b_double2.alpha = 0;
        this.chips.alpha = 0;

        if(this.bet == 10 && this.chips_move.children.length == 0){
            this.spawn_chips(0);
        }

        if(this.cur_cash < this.bet*2){
            this.b_double.alpha = 0;
        }
    }
    this.double = function(){
        this.cur_cash -= this.bet;
        this.bet *= 2;
        this.update_bet();
        this.update_cash();
        this.hit();

        if(this.player_value <= 21){
            this.dealer();
        }
    }
    this.hit = function(){

        var random =  this.generate_card();
        this.player_value += this.check_card(random);

        this.player_hit_count++;

        this.add_card("player", random, this.player_hit_count);

        if (this.player_value > 21){
            this.flip_card(this.dealer_flip.a, this.dealer_flip.b);
            setTimeout(this.check_winner.bind(this), 800);
        }
    }
    this.dealer_value;
    this.dealer_value_visible;
    this.txt_dealer;
    this.player_hit_count = 0;
    this.dealer_hit_count = 0;

    this.dealer = function(){
        this.cur_player = "dealer";

        stage.addChild(this.txt_dealer);

        this.flip_card(this.dealer_flip.a, this.dealer_flip.b);
        if(this.dealer_value < 18){
            this.dealer_hit();
        }
        else {
            setTimeout(this.check_winner.bind(this), 500);
        }
    }
    this.card_reset = function(){
        var max = this.cards.children.length;

        this.cards.removeAllChildren();
        this.card_back.removeAllChildren();
        this.game_end.removeAllChildren();

        this.player_value = 0;
        this.dealer_value = 0;

        this.player_hit_count = 0;
        this.dealer_hit_count = 0;
    }
    this.generate_card = function(){

        var rand = Math.round(Math.random()*4);

        if (rand == 3) {
            var rand2 = Math.round(Math.random()*3+1);

            if(rand2 == 1) {
                return "A";
            }

            if(rand2 == 2) {
                return "J";
            }

            if(rand2 == 3) {
                return "Q";
            }

            if(rand2 == 4) {
                return "K";
            }
        }

        else {
            var value = Math.round(Math.random()*8+2);
            return value;
        }
    }
    this.check_card = function(e){
        if(e <= 10){
            return e;
        }

        else{
            if(e == "J" || e == "Q" || e == "K") {
                return 10;
            }
            else if(e == "A"){
                if(this.player_hit_count <= 1 || this.dealer_hit_count <= 1){
                    return 11;
                }
                else {
                    return 1;
                }
            }
        }
    }
    this.dealer_hit = function(){
        var random = this.generate_card();
        this.dealer_value += this.check_card(random);
        this.dealer_hit_count++;

        this.add_card("dealer", random, this.dealer_hit_count);
    }
    this.set_button_visible = function(){
        this.b_hit.alpha = this.b_stand.alpha = this.b_double.alpha = 0;
        this.b_deal.alpha = this.b_double2.alpha = 1;
        this.chips.alpha = 1;

        this.is_ready = true;
        this.cur_player = "player";
        this.b_clear.alpha = 0;

        this.value_bar("hide");
    }
    this.check_winner = function(){
        this.b_hit.alpha = this.b_double.alpha = this.b_stand.alpha = 0;

        if (this.player_value == this.dealer_value){
            this.player_push();
        }

        else if (this.player_value > this.dealer_value){
            
            if (this.player_value > 21){
                this.player_lose();
            }

            else if (this.player_value <= 21){
                this.player_win();
            }
        }

        else if (this.player_value < this.dealer_value){

            if (this.dealer_value <= 21) {
                this.player_lose();
            }

            else if (this.dealer_value > 21){
                this.player_win();
            }
        }

        setTimeout(this.cards_up.bind(this), 1500);
    }
    this.cards_up = function(){
        var num = this.cards.children.length;
        this.game_end.removeAllChildren();

        for(i=0; i<num; i++){
            var child = this.cards.getChildAt(i);

            createjs.Tween.get(child)
                .to({x:640, y:-200}, 350)
                .call(function(){
                    this.cards.removeAllChildren();
                    this.set_button_visible();
                }.bind(this))
        }
    }
    this.spawn_image = function(e){
        var result = new createjs.Bitmap(this.img(e));
        result.setTransform(canvas.width/2, 440);
        result.regX = result.getBounds().width/2;
        result.regY = result.getBounds().height/2;

        this.game_end.addChild(result);
    }
    this.get_chips = function(e){
        var num = this.chips_move.children.length;

        if(e == "win"){
            for(var i=0; i<num; i++){
                var child = this.chips_move.getChildAt(i);
                createjs.Tween.get(child)
                    .to({x:350, y:780}, 500)
                    .call(function(){
                        this.chips_move.removeAllChildren();
                    }.bind(this))
            }
        }

        else if(e == "lose"){
            for(var i=0; i<num; i++){
                var child = this.chips_move.getChildAt(i);
                createjs.Tween.get(child)
                    .to({x:300, y:-50}, 500)
                    .call(function(){
                        this.chips_move.removeAllChildren();
                    }.bind(this))
            }
        }

        else if(e == "push"){
            for(var i=0; i<num; i++){
                var child = this.chips_move.getChildAt(i);
                createjs.Tween.get(child)
                    .to({x:-190, y:260}, 300)
                    .call(function(){
                        this.chips_move.removeAllChildren();
                    }.bind(this))
            }
        }
    }
    this.player_win = function(){
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "https://itsinhaleyo.online/callback/bj/win", true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({'bet':this.bet, 'bj': 0}));
        this.spawn_image("win");
        this.get_chips("win");
        this.play_sound("youWin");

        this.cur_cash += this.bet*2;
        this.update_cash();
        if (this.bet > 1000000) {
            this.bet = 1000000;
            this.update_bet();
        }
    }
    this.player_lose = function(){
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "https://itsinhaleyo.online/callback/bj/lose", true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({'bet':this.bet, 'bj': 0}));
        this.spawn_image("lose");
        this.get_chips("lose");
        this.play_sound("youLose");
        if (this.bet > 5000) {
            this.bet = 5000;
            this.update_bet();
        }
    }
    this.player_push = function(){
        this.spawn_image("push");
        this.get_chips("push");
        this.play_sound("Push");

        this.cur_cash += this.bet;
        this.update_cash();
        if (this.bet > 5000) {
            this.bet = 5000;
            this.update_bet();
        }
    }
    this.get_blackjack = function(){
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "https://itsinhaleyo.online/callback/bj/win", true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({'bet':this.bet, 'bj': 1}));
        this.spawn_image("blackjack");
        this.get_chips("win");
        this.play_sound("youWin");

        this.flip_card(this.dealer_flip.a, this.dealer_flip.b);
        setTimeout(this.cards_up.bind(this), 4000);

        this.cur_cash += this.bet*2.5;
        this.update_cash();

        this.set_button_visible();
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

        if(e == "player"){
            var posX = 615+(25*hitcount);
            var posY = 380+(25*hitcount);
            this.is_tween = true;

            var card = new createjs.Bitmap(this.img("card"+cardType+random));
            card.setTransform(this.card_pack.x, this.card_pack.y);
            card.regX = card.getBounds().width/2;
            card.regY = card.getBounds().height/2;
            card.name = e;
            card.alpha = 0;

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
                }.bind(this))
        }

        if(e == "dealer"){
            var posX = 570+(25*hitcount);
            var posY = 120+(25*hitcount);

            var card = new createjs.Bitmap(this.img("card"+cardType+random));
            card.setTransform(this.card_pack.x, this.card_pack.y);
            card.regX = card.getBounds().width/2;
            card.regY = card.getBounds().height/2;
            card.name = e;
            card.alpha = 0;

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

                    if(this.cur_player == "dealer"){

                        if(this.dealer_value < 18){
                            this.dealer_hit();
                        }
                        else {
                            setTimeout(this.check_winner.bind(this), 500);
                        }
                    }

                    
                }.bind(this))
        }
    }
    this.set_card_position = function(e){
        var num = this.card_back.children.length;

        if(e == "player"){
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
                            this.flip_card(child, childCard);
                            this.is_tween = false;
                            this.txt_player.text = this.player_value.toString();
                            this.txt_player.regX = this.txt_player.getBounds().width/2;
                            this.txt_player.x = this.value_bar_1.x+12;

                            //On start
                            if(this.player_hit_count < 2){
                                this.hit();
                                this.dealer_hit();
                            }

                            if (this.player_hit_count == 2 && this.player_value == 21){
                                //BLACKJACK
                                setTimeout(this.get_blackjack(), 1100);
                                this.player_hit_count = 10;
                            }
                        }.bind(this));
                }
            }
        }

        if(e == "dealer"){
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

                            this.dealer_flip.a = child;
                            this.dealer_flip.b = childCard;

                            if(this.dealer_hit_count == 1 || this.cur_player == "dealer"){
                                this.flip_card(child, childCard);
                            }

                            /*else {
                                this.dealer_flip.a = child;
                                this.dealer_flip.b = childCard;
                            }*/

                            if(this.dealer_hit_count < 2){
                                this.dealer_hit();
                            }
                        }.bind(this));
                }
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
                        if(this.dealer_hit_count >= 2){
                            this.is_ready = true;
                        }
                        if(this.dealer_hit_count == 1 || this.cur_player == "dealer" || this.player_value > 21){
                            this.txt_dealer.text = this.dealer_value.toString();
                            this.txt_dealer.regX = this.txt_dealer.getBounds().width/2;
                            this.txt_dealer.x = this.value_bar_2.x+12;
                        }
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