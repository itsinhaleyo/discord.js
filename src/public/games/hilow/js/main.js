var canvas = document.getElementById('gameCanvas');
var stage = new createjs.Stage(canvas);

resize();

var Sound = true; 
var isFullscreen = false;
var saveMoney = false;
var reloadCash = 0;
var Cash;
var reloadCoin = false;
var xhttp = new XMLHttpRequest();
xhttp.open("POST", "https://itsinhaleyo.online/callback/gameinit", true);
xhttp.setRequestHeader('Content-Type', 'application/json');
xhttp.onload = () => {
    const userbal = JSON.parse(xhttp.responseText);
    Cash = +userbal.Balance;
};
xhttp.send(JSON.stringify({'Balance': 'SystemCheck'}));
var Game = {
    ready: true,

    load: function(){
        createjs.Ticker.on('tick', this.update);
        createjs.Ticker.setFPS(60);
        createjs.Ticker.timingMode = createjs.Ticker.RAF;

        var bg = new createjs.Bitmap('https://itsinhaleyo.online/games/hilow/assets/img/bgMenu.png');

        progressbar = new createjs.Shape();
        progressbar.graphics.beginFill('white').drawRect(0,0,752,15);
        progressbar.setTransform(264, 440);

        var border = new createjs.Shape();
        border.graphics.beginStroke('white').drawRect(0,0,757,19);
        border.setTransform(262, 438);

        var title = new createjs.Bitmap('https://itsinhaleyo.online/games/hilow/assets/img/gameTitle.png');
        title.setTransform(640, 200);
        title.regX = 377;
        title.regY = 159;

        stage.addChild(bg, title, progressbar, border);

        manifest = [
            {src:"img/bg.png", id:"bg"},
            {src:"img/bgMenu.png", id:"bgMenu"},
            {src:"img/btnHigh.png", id:"btnHigh"},
            {src:"img/btnLow.png", id:"btnLow"},
            {src:"img/btnClear.png", id:"btnClear"},
            {src:"img/btnDouble.png", id:"btnDouble"},
            {src:"img/btnFullscreen.png", id:"btnFullscreen"},
            {src:"img/btnMenu.png", id:"btnMenu"},
            {src:"img/btnHome.png", id:"btnHome"},
            {src:"img/btnSound.png", id:"btnSound"},
            {src:"img/btnPlay.png", id:"btnPlay"},
            {src:"img/gameTitle.png", id:"gameTitle"},
            {src:"img/moneyBar.png", id:"moneyBar"},
            {src:"img/betBar.png", id:"betBar"},
            {src:"img/chips.png", id:"chips"},
            {src:"img/chipArrow.png", id:"chipArrow"},
            {src:"img/win.png", id:"win"},
            {src:"img/lose.png", id:"lose"},
            {src:"img/btnClose.png", id:"btnClose"},
            {src:"img/tutor.png", id:"tutor"},
            {src:"img/cardClubs2.png", id:"cardClubs2"},
            {src:"img/cardClubs3.png", id:"cardClubs3"},
            {src:"img/cardClubs4.png", id:"cardClubs4"},
            {src:"img/cardClubs5.png", id:"cardClubs5"},
            {src:"img/cardClubs6.png", id:"cardClubs6"},
            {src:"img/cardClubs7.png", id:"cardClubs7"},
            {src:"img/cardClubs8.png", id:"cardClubs8"},
            {src:"img/cardClubs9.png", id:"cardClubs9"},
            {src:"img/cardClubs10.png", id:"cardClubs10"},
            {src:"img/cardClubsA.png", id:"cardClubsA"},
            {src:"img/cardClubsJ.png", id:"cardClubsJ"},
            {src:"img/cardClubsQ.png", id:"cardClubsQ"},
            {src:"img/cardClubsK.png", id:"cardClubsK"},
            {src:"img/cardDiamonds2.png", id:"cardDiamonds2"},
            {src:"img/cardDiamonds3.png", id:"cardDiamonds3"},
            {src:"img/cardDiamonds4.png", id:"cardDiamonds4"},
            {src:"img/cardDiamonds5.png", id:"cardDiamonds5"},
            {src:"img/cardDiamonds6.png", id:"cardDiamonds6"},
            {src:"img/cardDiamonds7.png", id:"cardDiamonds7"},
            {src:"img/cardDiamonds8.png", id:"cardDiamonds8"},
            {src:"img/cardDiamonds9.png", id:"cardDiamonds9"},
            {src:"img/cardDiamonds10.png", id:"cardDiamonds10"},
            {src:"img/cardDiamondsA.png", id:"cardDiamondsA"},
            {src:"img/cardDiamondsJ.png", id:"cardDiamondsJ"},
            {src:"img/cardDiamondsQ.png", id:"cardDiamondsQ"},
            {src:"img/cardDiamondsK.png", id:"cardDiamondsK"},
            {src:"img/cardHearts2.png", id:"cardHearts2"},
            {src:"img/cardHearts3.png", id:"cardHearts3"},
            {src:"img/cardHearts4.png", id:"cardHearts4"},
            {src:"img/cardHearts5.png", id:"cardHearts5"},
            {src:"img/cardHearts6.png", id:"cardHearts6"},
            {src:"img/cardHearts7.png", id:"cardHearts7"},
            {src:"img/cardHearts8.png", id:"cardHearts8"},
            {src:"img/cardHearts9.png", id:"cardHearts9"},
            {src:"img/cardHearts10.png", id:"cardHearts10"},
            {src:"img/cardHeartsA.png", id:"cardHeartsA"},
            {src:"img/cardHeartsJ.png", id:"cardHeartsJ"},
            {src:"img/cardHeartsQ.png", id:"cardHeartsQ"},
            {src:"img/cardHeartsK.png", id:"cardHeartsK"},
            {src:"img/cardSpades2.png", id:"cardSpades2"},
            {src:"img/cardSpades3.png", id:"cardSpades3"},
            {src:"img/cardSpades4.png", id:"cardSpades4"},
            {src:"img/cardSpades5.png", id:"cardSpades5"},
            {src:"img/cardSpades6.png", id:"cardSpades6"},
            {src:"img/cardSpades7.png", id:"cardSpades7"},
            {src:"img/cardSpades8.png", id:"cardSpades8"},
            {src:"img/cardSpades9.png", id:"cardSpades9"},
            {src:"img/cardSpades10.png", id:"cardSpades10"},
            {src:"img/cardSpadesA.png", id:"cardSpadesA"},
            {src:"img/cardSpadesJ.png", id:"cardSpadesJ"},
            {src:"img/cardSpadesQ.png", id:"cardSpadesQ"},
            {src:"img/cardSpadesK.png", id:"cardSpadesK"},
            {src:"img/cardBack_red4.png", id:"cardBack_red4"},
            {src:"sound/Click.ogg", id:"Click"},
            {src:"sound/cardPlace.ogg", id:"cardPlace"},
            {src:"sound/chipsCollide.ogg", id:"chipsCollide"},
            {src:"sound/chipsHandle.ogg", id:"chipsHandle"},
            {src:"sound/cardShove.ogg", id:"cardShove"},
            {src:"sound/youWin.ogg", id:"youWin"},
            {src:"sound/youLose.ogg", id:"youLose"},
        ];

        preload = new createjs.LoadQueue(true);
        preload.installPlugin(createjs.Sound);
        preload.on('complete', this.loaded);
        preload.on("progress", loadProgress);
        preload.loadManifest(manifest, true, "https://itsinhaleyo.online/games/hilow/assets/");

        function loadProgress(){
            progressbar.scaleX = preload.progress;
        }
    },
    loaded: function(){
        stage.removeAllChildren();

        Game.init(); 
        Game.gameMenu(); 
    },

    img: function(id){ 
        return preload.getResult(id);
    },
    playSound: function(id){
        if(Sound == true){ 
            createjs.Sound.play(id);
        }
    },
    pointCenter: function(obj){ 
        obj.regX = obj.getBounds().width/2;
        obj.regY = obj.getBounds().height/2;
    },
    init: function(){ //Initialize
        bitmapFont = new createjs.SpriteSheet({
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
            "images": ["https://itsinhaleyo.online/games/hilow/font/spritefont.png"],
            "frames": {"width":31,"height":40,"count":10,"regX":15,"regY":20}
        });

        Bet = 0;
        arrow = 0;

        chips = new createjs.Container();
        chipsMove = new createjs.Container();
        buttons = new createjs.Container();

        buttons.on('click', this.buttonClick);
    },
    gameMenu: function(){
        var bg = new createjs.Bitmap(this.img('bgMenu'));

        var title = new createjs.Bitmap(this.img('gameTitle'));
        title.setTransform(640,200);
        this.pointCenter(title);

        var bPlay = new createjs.Bitmap(this.img('btnPlay'));
        bPlay.setTransform(640,500);
        bPlay.name = 'play';
        this.pointCenter(bPlay);

        buttons.addChild(bPlay);
        stage.addChild(bg, title);
        this.drawHeader();

        buttons.removeChildAt(1); //Remove menu button in main menu

        Game.ready = true;
    },
    gamePlay: function(){
        Bet = 0;
        var bg = new createjs.Bitmap(this.img('bg'));

        bClear = new createjs.Bitmap(this.img('btnClear'));
        bClear.setTransform(152, 640);
        bClear.name = 'clear';
        this.pointCenter(bClear);

        var bDouble = new createjs.Bitmap(this.img('btnDouble'));
        bDouble.setTransform(384, 640);
        bDouble.name = 'double';
        this.pointCenter(bDouble);

        chipSheet = new createjs.SpriteSheet({
            "images": [this.img('chips')],
            "frames": {width: 100, height: 100, regX: 50, regY:50, count:4},
            "animations": {
                "animate": [0,3]
            }
        });

        for(i=4; i>0; i--){
            var chip = new createjs.Sprite(chipSheet);
            chip.x = 744+(112*i);
            chip.y = 640;
            chip.gotoAndStop(i-1);
            chips.addChild(chip);
            chip.on('click', this.chipsClick);
        }

        var bHigh = new createjs.Bitmap(this.img('btnHigh'));
        bHigh.setTransform(448, 440);
        bHigh.name = 'high';
        this.pointCenter(bHigh);

        var bLow = new createjs.Bitmap(this.img('btnLow'));
        bLow.setTransform(832, 440);
        bLow.name = 'low';
        this.pointCenter(bLow);

        var betBar = new createjs.Bitmap(this.img('betBar'));
        betBar.setTransform(640, 522);
        this.pointCenter(betBar);

        txtBet = new createjs.BitmapText(Bet.toString(), bitmapFont);
        txtBet.textAlign = "center";
        txtBet.setTransform(630, 536);
        txtBet.scaleX = txtBet.scaleY = 0.7;

        buttons.addChild(bClear, bDouble, bHigh, bLow);

        stage.addChild(bg, chips, chipsMove, betBar, txtBet);

        this.drawHeader();

        this.cards();
    },

    drawHeader: function(){
        var btnHome = new createjs.Bitmap(this.img("btnHome"));
        btnHome.setTransform(373, 46);
        btnHome.name = 'home';
        this.pointCenter(btnHome);

        var btnSound = new createjs.Bitmap(this.img("btnSound"));
        btnSound.setTransform(1144, 44);
        btnSound.name = 'sound';
        this.pointCenter(btnSound);

        if(Sound == false){
            btnSound.alpha = 0.5;
        }

        var btnMenu = new createjs.Bitmap(this.img("btnMenu"));
        btnMenu.setTransform(1072, 44);
        btnMenu.name = 'menu';
        this.pointCenter(btnMenu);

        var btnFullscreen = new createjs.Bitmap(this.img("btnFullscreen"));
        btnFullscreen.setTransform(1216, 44);
        btnFullscreen.name = 'fullscreen';
        this.pointCenter(btnFullscreen);

        var moneyBar = new createjs.Bitmap(this.img("moneyBar"));
        moneyBar.setTransform(148, 44);
        this.pointCenter(moneyBar);

        txtCash = new createjs.BitmapText(Cash.toString(), bitmapFont);
        txtCash.setTransform(110, 45);
        txtCash.scaleX = txtCash.scaleY = 0.7;

        buttons.addChild(btnMenu, btnSound, btnFullscreen, btnHome);
        stage.addChild(moneyBar, txtCash, buttons);
    },

    updateBet: function(){
        txtBet.text = Bet.toString();
        txtBet.regX = txtBet.getBounds().width/2;
        txtBet.x = canvas.width/2+12;
    },

    buttonClick: function(obj){ //All buttons click function
        var name = obj.target.name;
        Game.playSound('Click');

        //Set sound
        if(name == 'sound'){
            if(Sound == true){
                Sound = false;
                obj.target.alpha = 0.5;
            }
            else {
                Sound = true;
                obj.target.alpha = 1;
            }
        }
        else if(name == 'menu'){
            setTimeout(function(){
                stage.removeAllChildren();
                buttons.removeAllChildren();
                chips.removeAllChildren();
                chipsMove.removeAllChildren();
                Game.gameMenu(); //Go to main menu
            }, 300)
        }
        else if(name == 'fullscreen'){
            if(isFullscreen == false){
                isFullscreen = true;
                screenfull.request();
            }
            else if(isFullscreen == true){
                isFullscreen = false;
                screenfull.exit();
            }
        }
        if(name == 'home'){
            window.location.href = "https://itsinhaleyo.online/casino";
        }
        
        if(Game.ready == true){

            createjs.Tween.get(obj.target).to({scaleX: 0.9, scaleY: 0.9}, 100).to({scaleX: 1, scaleY: 1}, 100);

            if(name == 'clear'){

                Bet = 0;
                Game.updateBet();

                var num = chipsMove.children.length;
                for(i=0; i<num; i++){
                    var child = chipsMove.getChildAt(i);

                    createjs.Tween.get(child).to({x: -200, y: 250}, 400).call(function(){
                        chipsMove.removeChildAt(i);
                    });
                }
            }
            else if(name == 'double'){
                if(Bet*2 <= Cash){
                    if(250>=Bet*2){
                        Bet *= 2;
                    } else {
                        Bet = 250;
                    }
                }
                else {
                    Bet = 250;
                }

                Game.updateBet();
            }
            else if(name == 'high' || name == 'low'){

                if(Bet > 0){

                    if(name == 'high'){
                        Game.check('high');
                    }
                    if(name == 'low'){
                        Game.check('low');
                    }
                }
                else if(Bet == 0){
                    alert('YOU NEED SET BET FIRST!');

                    stage.removeChild(arrow);
                    showArrow(); //Show chip arrow

                    function showArrow(){
                        arrow = new createjs.Bitmap(Game.img('chipArrow'));
                        arrow.setTransform(856, 500);
                        Game.pointCenter(arrow);

                        createjs.Tween.get(arrow, {loop: -1}).to({y: 530}, 300).to({y: 500}, 300);

                        stage.addChild(arrow);
                    }
                }
            }
            else if(name == 'play'){
                setTimeout(function(){
                    stage.removeAllChildren();
                    buttons.removeAllChildren();
                    Game.gamePlay(); //Play game
                }, 300);
            }
        }
    },

    chipsClick: function(e){
        if(Game.ready == true){
            Game.ready = false;
            var value = e.target.currentFrame;

            var result = checkBetValue();

            if(Bet+result > 1000000){
                alert("The Max bet is 1000000");
                Game.updateBet();
                Game.ready = true;
            } else if( Bet <= Cash-result ) {
                Game.playSound('chipsHandle');

                if(arrow !== undefined){
                    stage.removeChild(arrow);
                }

                createjs.Tween.get(e.target)
                    .to({scaleX:0.9, scaleY:0.9},100)
                    .to({scaleX:1, scaleY:1},100)
                    .call(function(){
                        setBet(value);
                        spawnChips(value);
                        Game.ready = true;
                    });
            } else if( Bet > Cash-result && Cash > 0 ){
                alert("YOU DON'T HAVE ENOUGH 1FC!");
                Game.ready = true;
            }

            function checkBetValue(){
                //10
                if (value == 0){
                    return 10;
                }
                //20
                else if (value == 1){
                    return 20;
                }
                //50
                else if (value == 2){
                    return 50;
                }
                //100
                else if (value == 3){
                    return 100;
                }
            }

            function spawnChips(e){
                var randX = Math.round(Math.random()*150+100);
                var randY = Math.round(Math.random()*200+150);

                var chip = new createjs.Sprite(chipSheet);
                chip.gotoAndStop(e);
                chip.x = -50;
                chip.y = 260;
                chipsMove.addChild(chip);

                createjs.Tween.get(chip)
                    .to({x:randX, y:randY}, 300)
                    .call(function(){
                        Game.playSound('chipsCollide');
                    })
            }

            function setBet(e){
                //10
                if (e == 0){
                    Bet += 10;
                }
                //20
                else if (e == 1){
                    Bet += 20;
                }
                //50
                else if (e == 2){
                    Bet += 50;
                }
                //100
                else if (e == 3){
                    Bet += 100;
                }

                Game.updateBet();
            }
        }
    },

    getChips: function(e){
        var num = chipsMove.children.length;

        if(e == "win"){
            for(var i=0; i<num; i++){
                var child = chipsMove.getChildAt(i);
                createjs.Tween.get(child)
                    .to({x:350, y:780}, 500)
                    .call(function(){
                        chipsMove.removeAllChildren();
                    })
            }
        }

        else if(e == "lose"){
            for(var i=0; i<num; i++){
                var child = chipsMove.getChildAt(i);
                createjs.Tween.get(child)
                    .to({x:300, y:-50}, 500)
                    .call(function(){
                        chipsMove.removeAllChildren();
                    })
            }
        }

        else if(e == "push"){
            for(var i=0; i<num; i++){
                var child = chipsMove.getChildAt(i);
                createjs.Tween.get(child)
                    .to({x:-190, y:260}, 300)
                    .call(function(){
                        chipsMove.removeAllChildren();
                    })
            }
        }
    },

    check: function(button){
        this.ready = false;

        var Card3 = Game.randomCard('card3');
        var Card2 = this.randomCard('card2');

        var win, lose;

        var cardBack = new createjs.Bitmap(this.img('cardBack_red4'));
        cardBack.setTransform(760, 248);
        this.pointCenter(cardBack);

        var firstCard = new createjs.Bitmap(this.img(Card3));
        firstCard.setTransform(640, 248);
        firstCard.scaleX = 0;
        this.pointCenter(firstCard);;

        var secondCard = new createjs.Bitmap(this.img(Card2));
        secondCard.setTransform(760, 248);
        secondCard.scaleX = 0;
        this.pointCenter(secondCard);

        createjs.Tween.get(cardBack).to({scaleX:0}, 300).call(function(){
            createjs.Tween.get(secondCard).to({scaleX: 1}, 300).call(function(){
                setTimeout(function(){
                    Game.playSound('cardShove');
                    check();
                    createjs.Tween.get(secondCard)
                        .to({x: 520}, 300)
                        .call(function(){
                            Game.playSound('cardPlace');
                            card1 = card3; //Swap card value
                            cardBack.scaleX = 1;
                            createjs.Tween.get(cardBack).to({x: 640, scaleX: 0}, 300).call(function(){
                                createjs.Tween.get(firstCard)
                                    .to({x: 520, scaleX: 1}, 300)
                                    .call(function(){
                                        Game.playSound('cardPlace');
                                        stage.removeChild(secondCard);
                                        Game.ready = true;

                                        setTimeout(function(){
                                            stage.removeChild(win);
                                            stage.removeChild(lose);
                                        }, 1000)
                                    })
                            });
                        });
                }, 1000);
            });
        });

        stage.addChild(secondCard, firstCard, cardBack);

        function check(){
            if(button == 'high'){
                if(card1 > card2){
                    win();
                }
                else if(card1 <= card2){
                    lose();
                }
            }
            else if(button == 'low'){
                if(card1 < card2){
                    win();
                }
                else if(card1 >= card2){
                    lose();
                }
            }
        }

        function win(){
            Game.playSound('youWin');

            Cash += Bet;
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "https://itsinhaleyo.online/callback/hilow/win", true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify({'bet':Bet}));
            txtCash.text = Cash.toString();
            win = new createjs.Bitmap(Game.img('win'));
            win.setTransform(640, 300);
            Game.pointCenter(win);
            stage.addChild(win);
            Game.getChips('win');
            if (Bet > 250) {
                Bet = 250;
            }
        }

        function lose(){
            Game.playSound('youLose');
            Cash -= Bet;
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "https://itsinhaleyo.online/callback/hilow/lose", true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify({'bet':Bet}));
            txtCash.text = Cash.toString();
            lose = new createjs.Bitmap(Game.img('lose'));
            lose.setTransform(640, 300);
            Game.pointCenter(lose);
            stage.addChild(lose);
            Game.getChips('lose');
            if (Bet > 250) {
                Bet = 250;
            }
        }
    },

    cards: function(){
        var card = this.randomCard('card1'); //Get random card

        var cardOpen = new createjs.Bitmap(this.img(card));
        cardOpen.setTransform(520, 248);
        cardOpen.scaleX = 0;
        this.pointCenter(cardOpen);

        var cBack = new createjs.Bitmap(this.img('cardBack_red4'));
        cBack.setTransform(520, 248);
        this.pointCenter(cBack);

        createjs.Tween.get(cBack).to({scaleX: 0}, 300).call(function(){
            createjs.Tween.get(cardOpen).to({scaleX: 1}, 300)
        });

        var cardBack = new createjs.Bitmap(this.img('cardBack_red4'));
        cardBack.setTransform(760, 248);
        this.pointCenter(cardBack);

        stage.addChild(cardOpen, cBack,cardBack);
    },
    randomCard: function(type){
        var curCard = type;
        var cardType = getCardType();
        var random = generateCard();

        return "card"+cardType+random;

        function getCardType(){
            var num = Math.round(Math.random()*3+1);

            if (num == 1){
                return "Clubs";
            }

            else if (num == 2){
                return "Diamonds";
            }

            else if (num == 3){
                return "Spades";
            }

            else if (num == 4){
                return "Hearts";
            }
        }
        function generateCard(){
            var rand = 1;

            if(curCard == 'card2'){
                rand = Math.round(Math.random()*4);
            }

            if (rand == 3) {
                var rand2 = Math.round(Math.random()*3+1);

                if(rand2 == 1) {
                    setCardValue(11);
                    return "A";
                }

                if(rand2 == 2) {
                    setCardValue(10);
                    return "J";
                }

                if(rand2 == 3) {
                    setCardValue(10);
                    return "Q";
                }

                if(rand2 == 4) {
                    setCardValue(10);
                    return "K";
                }
            }

            else {
                var value;

                if(curCard == 'card2'){
                    value = Math.round(Math.random()*8+2);
                }
                else {
                    value = Math.round(Math.random()*4+5);
                }

                setCardValue(value);

                return value;
            }

            function setCardValue(value){
                if(curCard == 'card1'){
                    card1 = value;
                }
                else if(curCard == 'card2'){
                    card2 = value;
                }
                else if(curCard == 'card3'){
                    card3 = value;
                }
            }
        }
    },
    update: function(){
        stage.update();
    },
}

//Resize canvas (letterbox scale)
function resize() {

var game = {
    element: canvas,
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
};