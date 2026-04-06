var game_config={
    main:{
        width:1280,
        height:720
    },
    winning_rate:50,
    bigwin_rate:15,
    sound:!0,
    music:!0,
    refill:0,
    cur_payline:3,
    bet_size:[1,2,3,4,5,10,20,30,40,50,100,200,300,400,500],
    bet_at:3,
    cur_bet:0,
    payvalues:[[0,50,250,500],[4,50,100,150],[3,40,80,100],[3,30,60,90],[2,25,50,100],[1,20,40,80],[0,15,30,60],[0,10,20,40],[0,5,10,20],[0,3,8,18]],
    paylines:[[[1,0],[1,1],[1,2],[1,3],[1,4],16724787],[[0,0],[0,1],[0,2],[0,3],[0,4],16751667],[[2,0],[2,1],[2,2],[2,3],[2,4],16776243],[[0,0],[1,1],[2,2],[1,3],[0,4],8978227],[[2,0],[1,1],[0,2],[1,3],[2,4],3407749],[[1,0],[0,1],[0,2],[0,3],[1,4],3399167],[[1,0],[2,1],[2,2],[2,3],[1,4],3367935],[[0,0],[0,1],[1,2],[2,3],[2,4],10236927],[[2,0],[2,1],[1,2],[0,3],[0,4],16724960],[[1,0],[2,1],[1,2],[0,3],[1,4],16724841]],
    max_payline:0
};
this.Cash = 0;
var xhttp = new XMLHttpRequest();
xhttp.open("POST", "https://itsinhaleyo.online/callback/gameinit", true);
xhttp.setRequestHeader('Content-Type', 'application/json');
xhttp.onload = () => {
    const userbal = JSON.parse(xhttp.responseText);
    this.Cash += +userbal.Balance;
};
xhttp.send(JSON.stringify({'Balance': 'SystemCheck'}));
game_config.cur_bet=game_config.bet_size[game_config.bet_at];
game_config.max_payline=game_config.paylines.length;
var $jscomp=$jscomp||{};$jscomp.scope={};$jscomp.ASSUME_ES5=!1;$jscomp.ASSUME_NO_NATIVE_MAP=!1;$jscomp.ASSUME_NO_NATIVE_SET=!1;$jscomp.SIMPLE_FROUND_POLYFILL=!1;$jscomp.objectCreate=$jscomp.ASSUME_ES5||"function"==typeof Object.create?Object.create:function(a){var b=function(){};b.prototype=a;return new b};$jscomp.underscoreProtoCanBeSet=function(){var a={a:!0},b={};try{return b.__proto__=a,b.a}catch(c){}return!1};
$jscomp.setPrototypeOf="function"==typeof Object.setPrototypeOf?Object.setPrototypeOf:$jscomp.underscoreProtoCanBeSet()?function(a,b){a.__proto__=b;if(a.__proto__!==b)throw new TypeError(a+" is not extensible");return a}:null;
$jscomp.inherits=function(a,b){a.prototype=$jscomp.objectCreate(b.prototype);a.prototype.constructor=a;if($jscomp.setPrototypeOf){var c=$jscomp.setPrototypeOf;c(a,b)}else for(c in b)if("prototype"!=c)if(Object.defineProperties){var d=Object.getOwnPropertyDescriptor(b,c);d&&Object.defineProperty(a,c,d)}else a[c]=b[c];a.superClass_=b.prototype};var Boot=function(){return Phaser.Scene.call(this,"boot")||this};$jscomp.inherits(Boot,Phaser.Scene);
Boot.prototype.preload=function(){this.load.image("bg_menu","https://itsinhaleyo.online/games/luckyslot/img/bg_menu.png");this.load.spritesheet("game_title2","https://itsinhaleyo.online/games/luckyslot/img/game_title2.png",{frameWidth:526,frameHeight:341});this.load.image("tilebg","https://itsinhaleyo.online/games/luckyslot/img/tilebg.png");this.load.image("btn_start","https://itsinhaleyo.online/games/luckyslot/img/btn_start.png")};Boot.prototype.create=function(){var a=this.Cash;null!==a&&(this.Cash=a);this.scale.stopListeners();this.scene.start("load")};
var $jscomp=$jscomp||{};$jscomp.scope={};$jscomp.ASSUME_ES5=!1;$jscomp.ASSUME_NO_NATIVE_MAP=!1;$jscomp.ASSUME_NO_NATIVE_SET=!1;$jscomp.SIMPLE_FROUND_POLYFILL=!1;$jscomp.objectCreate=$jscomp.ASSUME_ES5||"function"==typeof Object.create?Object.create:function(a){var b=function(){};b.prototype=a;return new b};$jscomp.underscoreProtoCanBeSet=function(){var a={a:!0},b={};try{return b.__proto__=a,b.a}catch(c){}return!1};
$jscomp.setPrototypeOf="function"==typeof Object.setPrototypeOf?Object.setPrototypeOf:$jscomp.underscoreProtoCanBeSet()?function(a,b){a.__proto__=b;if(a.__proto__!==b)throw new TypeError(a+" is not extensible");return a}:null;
$jscomp.inherits=function(a,b){a.prototype=$jscomp.objectCreate(b.prototype);a.prototype.constructor=a;if($jscomp.setPrototypeOf){var c=$jscomp.setPrototypeOf;c(a,b)}else for(c in b)if("prototype"!=c)if(Object.defineProperties){var d=Object.getOwnPropertyDescriptor(b,c);d&&Object.defineProperty(a,c,d)}else a[c]=b[c];a.superClass_=b.prototype};var Load=function(){return Phaser.Scene.call(this,"load")||this};$jscomp.inherits(Load,Phaser.Scene);
Load.prototype.preload=function(){var a=this;this.add.tileSprite(0,0,config.width,config.height,"tilebg").setOrigin(0,0);this.add.sprite(config.width/2,config.height/2,"bg_menu");this.anims.create({key:"title",frames:this.anims.generateFrameNumbers("game_title2"),frameRate:5,repeat:-1});this.add.sprite(800,215,"game_title2").play("title");var b=this.add.rectangle(config.width/2,500,600,20);b.setStrokeStyle(4,16777215);b.alpha=.7;var c=this.add.rectangle(config.width/2,500,590,10,16777215);c.alpha=
.8;
this.load.on("progress",function(a){c.width=590*a});
this.load.on("complete",function(){b.destroy();c.destroy();var d=draw_button(config.width/2,510,"start",a);
a.tweens.add({targets:d,scaleX:.9,scaleY:.9,yoyo:!0,duration:800,repeat:-1,ease:"Sine.easeInOut"})},this);
this.input.on("gameobjectdown",function(){a.scene.start("menu")},this);
this.load.image("symbols","https://itsinhaleyo.online/games/luckyslot/img/symbols.png");
this.load.image("symbols_blur","https://itsinhaleyo.online/games/luckyslot/img/symbols_blur.png");
this.load.image("machine","https://itsinhaleyo.online/games/luckyslot/img/machine.png");
this.load.image("bg","https://itsinhaleyo.online/games/luckyslot/img/bg.png");
this.load.image("game_title","https://itsinhaleyo.online/games/luckyslot/img/game_title.png");
this.load.image("btn_play","https://itsinhaleyo.online/games/luckyslot/img/btn_play.png");
this.load.image("btn_about","https://itsinhaleyo.online/games/luckyslot/img/btn_about.png");
this.load.image("btn_menu_sound","https://itsinhaleyo.online/games/luckyslot/img/btn_menu_sound.png");
this.load.image("btn_menu_sound_off","https://itsinhaleyo.online/games/luckyslot/img/btn_menu_sound_off.png");
this.load.image("btn_menu_music","https://itsinhaleyo.online/games/luckyslot/img/btn_menu_music.png");
this.load.image("btn_menu_music_off","https://itsinhaleyo.online/games/luckyslot/img/btn_menu_music_off.png");
this.load.image("footer","https://itsinhaleyo.online/games/luckyslot/img/footer.png");
this.load.image("header","https://itsinhaleyo.online/games/luckyslot/img/header.png");
this.load.image("money_bar","https://itsinhaleyo.online/games/luckyslot/img/fcmoney_bar.png");
this.load.image("btn_change_bet","https://itsinhaleyo.online/games/luckyslot/img/btn_change_bet.png");
this.load.image("btn_payout","https://itsinhaleyo.online/games/luckyslot/img/btn_payout.png");
this.load.image("btn_spin","https://itsinhaleyo.online/games/luckyslot/img/btn_spin.png");
this.load.image("btn_max","https://itsinhaleyo.online/games/luckyslot/img/btn_max.png");
this.load.image("btn_back","https://itsinhaleyo.online/games/luckyslot/img/btn_back.png");
this.load.image("btn_sound","https://itsinhaleyo.online/games/luckyslot/img/btn_sound.png");
this.load.image("btn_sound_off","https://itsinhaleyo.online/games/luckyslot/img/btn_sound_off.png");
this.load.image("btn_music","https://itsinhaleyo.online/games/luckyslot/img/btn_music.png");
this.load.image("btn_music_off","https://itsinhaleyo.online/games/luckyslot/img/btn_music_off.png");
this.load.image("btn_plus_bet","https://itsinhaleyo.online/games/luckyslot/img/btn_plus_bet.png");
this.load.image("btn_minus_bet","https://itsinhaleyo.online/games/luckyslot/img/btn_minus_bet.png");
this.load.image("btn_plus_lines","https://itsinhaleyo.online/games/luckyslot/img/btn_plus_lines.png");
this.load.image("btn_minus_lines","https://itsinhaleyo.online/games/luckyslot/img/btn_minus_lines.png");
this.load.image("btn_full","https://itsinhaleyo.online/games/luckyslot/img/btn_full.png");
this.load.image("btn_no","https://itsinhaleyo.online/games/luckyslot/img/btn_no.png");
this.load.image("btn_home","https://itsinhaleyo.online/games/luckyslot/img/btn_home.png");
this.load.image("btn_yes","https://itsinhaleyo.online/games/luckyslot/img/btn_yes.png");
this.load.image("win_prompt","https://itsinhaleyo.online/games/luckyslot/img/win_prompt.png");
this.load.image("res_bar","https://itsinhaleyo.online/games/luckyslot/img/res_bar.png");
this.load.image("lines_bar","https://itsinhaleyo.online/games/luckyslot/img/lines_bar.png");
this.load.image("bet_bar","https://itsinhaleyo.online/games/luckyslot/img/bet_bar.png");
this.load.image("paytable","https://itsinhaleyo.online/games/luckyslot/img/paytable.png");
this.load.image("circle","https://itsinhaleyo.online/games/luckyslot/img/circle.png");
this.load.image("line1","https://itsinhaleyo.online/games/luckyslot/img/line1.png");
this.load.image("line2","https://itsinhaleyo.online/games/luckyslot/img/line2.png");
this.load.image("line3","https://itsinhaleyo.online/games/luckyslot/img/line3.png");
this.load.image("star","https://itsinhaleyo.online/games/luckyslot/img/star.png");
this.load.image("you_win","https://itsinhaleyo.online/games/luckyslot/img/you_win.png");
this.load.image("big_win","https://itsinhaleyo.online/games/luckyslot/img/big_win.png");
this.load.image("light1","https://itsinhaleyo.online/games/luckyslot/img/light1.png");
this.load.image("coin","https://itsinhaleyo.online/games/luckyslot/img/coin.png");
this.load.image("mask","https://itsinhaleyo.online/games/luckyslot/img/mask.png");
this.load.image("separate","https://itsinhaleyo.online/games/luckyslot/img/separate.png");
this.load.image("about","https://itsinhaleyo.online/games/luckyslot/img/about.png");
this.load.image("about_window","https://itsinhaleyo.online/games/luckyslot/img/about_window.png");
this.load.spritesheet("coins","https://itsinhaleyo.online/games/luckyslot/img/coins.png",{frameWidth:70,frameHeight:70});
this.load.spritesheet("lever","https://itsinhaleyo.online/games/luckyslot/img/lever.png",{frameWidth:77,frameHeight:351});
this.load.spritesheet("li","https://itsinhaleyo.online/games/luckyslot/img/li.png",{frameWidth:57.5,frameHeight:397});
this.load.audio("Slot Machine Spin Loop","https://itsinhaleyo.online/games/luckyslot/audio/Slot Machine Spin Loop.mp3");
this.load.audio("Slot Machine Mega Win","https://itsinhaleyo.online/games/luckyslot/audio/Slot Machine Mega Win.mp3");
this.load.audio("Slot Arm Start","https://itsinhaleyo.online/games/luckyslot/audio/Slot Arm Start.mp3");
this.load.audio("Get Coins","https://itsinhaleyo.online/games/luckyslot/audio/Get Coins.mp3");
this.load.audio("Slot line","https://itsinhaleyo.online/games/luckyslot/audio/Slot line.mp3");
this.load.audio("click2","https://itsinhaleyo.online/games/luckyslot/audio/click2.mp3");
this.load.audio("music","https://itsinhaleyo.online/games/luckyslot/audio/music.mp3");
this.load.audio("Button","https://itsinhaleyo.online/games/luckyslot/audio/Button.mp3");
this.load.audio("Bonus Lose","https://itsinhaleyo.online/games/luckyslot/audio/Bonus Lose.mp3");
this.load.audio("Slot coins","https://itsinhaleyo.online/games/luckyslot/audio/Slot coins.mp3");
this.load.audio("Slot Machine Spin Button","https://itsinhaleyo.online/games/luckyslot/audio/Slot Machine Spin Button.mp3");
this.load.audio("Slot Machine Bonus Lose","https://itsinhaleyo.online/games/luckyslot/audio/Slot Machine Bonus Lose.mp3");
var xhttp = new XMLHttpRequest();
xhttp.open("POST", "https://itsinhaleyo.online/callback/gameinit", true);
xhttp.setRequestHeader('Content-Type', 'application/json');
xhttp.onload = () => {
    const userbal = JSON.parse(xhttp.responseText);
    this.Cash += +userbal.Balance;
};
xhttp.send(JSON.stringify({'Balance': 'SystemCheck'}));
for(var d=1;5>=d;d++)this.load.audio("Slot Machine Stop "+d,"https://itsinhaleyo.online/games/luckyslot/audio/Slot Machine Stop "+d+".mp3")};
Load.prototype.create=function(){};
var $jscomp=$jscomp||{};
$jscomp.scope={};
$jscomp.ASSUME_ES5=!1;
$jscomp.ASSUME_NO_NATIVE_MAP=!1;
$jscomp.ASSUME_NO_NATIVE_SET=!1;
$jscomp.SIMPLE_FROUND_POLYFILL=!1;
$jscomp.objectCreate=$jscomp.ASSUME_ES5||"function"==typeof Object.create?Object.create:function(a){var b=function(){};b.prototype=a;return new b};
$jscomp.underscoreProtoCanBeSet=function(){var a={a:!0},b={};try{return b.__proto__=a,b.a}catch(c){}return!1};
$jscomp.setPrototypeOf="function"==typeof Object.setPrototypeOf?Object.setPrototypeOf:$jscomp.underscoreProtoCanBeSet()?function(a,b){a.__proto__=b;if(a.__proto__!==b)throw new TypeError(a+" is not extensible");return a}:null;
$jscomp.inherits=function(a,b){a.prototype=$jscomp.objectCreate(b.prototype);a.prototype.constructor=a;if($jscomp.setPrototypeOf){var c=$jscomp.setPrototypeOf;c(a,b)}else for(c in b)if("prototype"!=c)if(Object.defineProperties){var f=Object.getOwnPropertyDescriptor(b,c);f&&Object.defineProperty(a,c,f)}else a[c]=b[c];a.superClass_=b.prototype};
var Menu=function(){return Phaser.Scene.call(this,"menu")||this};
$jscomp.inherits(Menu,Phaser.Scene);
Menu.prototype.create=function(){
    function a(){
        c="preinfo";
        f=g.add.container(0,0);
        f.setDepth(1);
        var a=g.add.rectangle(config.width/2,config.height/2,config.width,config.height,0);
        a.alpha=0;a.name="dark";
        g.tweens.add({targets:a,alpha:.7,duration:200});
        var b=g.add.sprite(config.width/2,config.height/2,"about_window");
        b.alpha=0;b.setScale(.7);
        g.tweens.add({targets:b,alpha:1,duration:400,scaleX:1,scaleY:1,ease:"Back.easeOut",onComplete:function(){c="info"}});
        var e=g.add.sprite(config.width/2,config.height/2+40,"about");
        e.alpha=0;
        e.setScale(.7);
        g.tweens.add({targets:e,alpha:1,duration:400,scaleX:1,scaleY:1,ease:"Back.easeOut"});
        f.add([a,b,e])
    }function b(){
        g.tweens.add({targets:f,alpha:0,duration:300,onComplete:function(){
            f.destroy(!0,!0);c="menu"
        }})
    }play_music("music",this);
    var c="menu",f,g=this;
    this.add.tileSprite(0,0,config.width,config.height,"tilebg").setOrigin(0,0);
    this.add.sprite(config.width/2,config.height/2,"bg_menu");
    this.anims.create({key:"title",frames:this.anims.generateFrameNumbers("game_title2"),frameRate:5,repeat:-1});
    var h=this.add.sprite(800,215,"game_title2");
    h.play("title");
    this.tweens.add({targets:h,scaleX:.9,scaleY:.9,yoyo:!0,duration:700,repeat:-1,ease:"Sine.easeInOut"});
    draw_button(800,476,"play",this);
    draw_button(685,585,"about",this);
    draw_button(1000,475,"home",this);
    h=draw_button(889,585,"menu_music",this);
    var k=draw_button(1019,585,"menu_sound",this);
    game_config.music||h.setTexture("btn_menu_music_off");
    game_config.sound||k.setTexture("btn_menu_sound_off");
    this.input.on("gameobjectdown",function(b,d){
        if ("home"===d.name) setTimeout(function returnurl() {
            window.location.href = "https://itsinhaleyo.online/casino";
        },100);
        var e=this;
        d.button&&(play_sound("click2",e),
        this.tweens.add({
            targets:d,
            scaleX:.9,
            scaleY:.9,
            duration:100,
            ease:"Linear",
            yoyo:!0,onComplete:function(){
                c="menu";
                "play"===d.name?
                e.scene.start("game"):"menu_sound"===d.name?
                switch_audio(d.name,d,e):"menu_music"===d.name?
                switch_audio(d.name,d,e):"about"===d.name&&a()
            }
        }))
    },this);
    this.input.on("pointerdown",function(){
        "info"===c&&b()
    })};
var $jscomp=$jscomp||{};
$jscomp.scope={};
$jscomp.ASSUME_ES5=!1;
$jscomp.ASSUME_NO_NATIVE_MAP=!1;
$jscomp.ASSUME_NO_NATIVE_SET=!1;
$jscomp.SIMPLE_FROUND_POLYFILL=!1;
$jscomp.objectCreate=$jscomp.ASSUME_ES5||"function"==typeof Object.create?Object.create:function(a){
    var b=function(){};
    b.prototype=a;
    return new b
};
$jscomp.underscoreProtoCanBeSet=function(){
    var a={a:!0},b={};
    try{
        return b.__proto__=a,b.a
    }catch(c){
    }return!1
};
$jscomp.setPrototypeOf="function"==typeof Object.setPrototypeOf?Object.setPrototypeOf:
$jscomp.underscoreProtoCanBeSet()?function(a,b){
    a.__proto__=b;
    if(a.__proto__!==b)throw new TypeError(a+" is not extensible");
    return a
}:null;
$jscomp.inherits=function(a,b){
    a.prototype=$jscomp.objectCreate(b.prototype);
    a.prototype.constructor=a;
    if($jscomp.setPrototypeOf){
        var c=$jscomp.setPrototypeOf;
        c(a,b)
    }else for(c in b)if("prototype"!=c)if(Object.defineProperties){
        var e=Object.getOwnPropertyDescriptor(b,c);
        e&&Object.defineProperty(a,c,e)
    }else a[c]=b[c];
    a.superClass_=b.prototype
};
$jscomp.findInternal=function(a,b,c){
    a instanceof String&&(a=String(a));
    for(var e=a.length,l=0;l<e;l++){
        var A=a[l];
        if(b.call(c,A,l,a))return{
            i:l,
            v:A
        }}return{
            i:-1,
            v:void 0}
};
$jscomp.defineProperty=$jscomp.ASSUME_ES5||"function"==typeof Object.defineProperties?Object.defineProperty:function(a,b,c){
    a!=Array.prototype&&a!=Object.prototype&&(a[b]=c.value)
};
$jscomp.getGlobal=function(a){
    return"undefined"!=typeof window&&window===a?a:"undefined"!=typeof global&&null!=global?global:a
};
$jscomp.global=$jscomp.getGlobal(this);
$jscomp.polyfill=function(a,b,c,e){
    if(b){c=$jscomp.global;a=a.split(".");
    for(e=0;e<a.length-1;e++){var l=a[e];
        l in c||(c[l]={});
        c=c[l]}a=a[a.length-1];e=c[a];
        b=b(e);
        b!=e&&null!=b&&$jscomp.defineProperty(c,a,{
            configurable:!0,
            writable:!0,
            value:b
        })}
};
$jscomp.polyfill("Array.prototype.findIndex",function(a){
    return a?a:function(a,c){
        return $jscomp.findInternal(this,a,c).i}
},"es6","es3");
var game_music,Game=function(){
    return Phaser.Scene.call(this,"game")||this
};
$jscomp.inherits(Game,Phaser.Scene);
Game.prototype.create=function(){
    function a(){
        p=game_config.cur_bet*game_config.cur_payline;
        p=Math.round(10*p)/10;
        R.setText(String(p))
    }function b(){B||"play"!==q||(C.setVisible(!1),D.setVisible(!1),p<=this.Cash?(play_sound("Slot Machine Spin Button",d),
    this.Cash-=p,
        E(0),
        v&&v.destroy(!0,!0),
        w&&w.destroy(),
        t&&clearInterval(t),
        B=!0,
        q="spin",
        S.play("lever_press"),
        play_sound("Slot Arm Start",d),
        c()):1>=this.Cash?N("refill"):N("nocash"))
    }function c(){
        T();
        var u=0,
        a=setInterval(function(){
            e(O[u]);
            u++;
            5<=u&&clearInterval(a)
        },300)
    }function e(a){
        d.tweens.add({
            targets:a,
            y:1474,
            duration:800,
            ease:"Back.easeIn",
            onComplete:function(){
                l(a);
                0===a.id&&play_sound("Slot Machine Spin Loop",d)
            }
        })
    }function l(a){
        a.y=134;
        a.setTexture("symbols_blur");
        d.tweens.add({
            targets:a,
            y:1474,
            duration:500,
            ease:"Linear",
            loop:2,onComplete:function(){
                A(a)
            }
        })
    }function A(a){
        a.y=P("start",a.id);
        a.setTexture("symbols");
        d.tweens.add({targets:a,y:P("end",a.id),
            duration:800,
            ease:"Back.easeOut",
            onComplete:function(){
                4===a.id&&(F(),B=!1)
        }});
        setTimeout(function(){
            play_sound("Slot Machine Stop "+Number(a.id+1),d)
        },400)
    }function P(a,f){
        return"start"===a?-(134*y[f]+858):858-134*y[f]}function T(){
            for(var a=0;5>a;a++)y[a]=Math.floor(10*Math.random());
            a=F(!0)*game_config.cur_bet;
            if(a>p){
                var f=Math.round(100*Math.random()),
                d=!1;f>=game_config.winning_rate&&(d=!0);
                !d&&a>=3*p&&(f=Math.round(100*Math.random()),f>=game_config.bigwin_rate&&(d=!0));
                if(d)for(a=0;10>a;a++){
                    for(f=0;5>f;f++)y[f]=Math.floor(10*Math.random());
                    if(F(!0)*game_config.cur_payline<=p)break
                }
            }
        }function F(a){
            for(var f=[],b=[],u=[],r=0;3>r;r++){
                for(var m=[],k=0;5>k;k++){
                    var c=y[k]+r;
                    10<=c&&(c-=10);
                    m.push(c)
                }f.push(m)
            }r=[];
            for(m=0;m<game_config.cur_payline;m++){
                k=[];
                c=!1;
                for(var n=-1,e=0;5>e;e++){
                    var g=game_config.paylines[m][e][0],
                    h=game_config.paylines[m][e][1],
                    l=f[g][h];
                    if(0===k.length)k.push([l,{x:h,y:g,at:m}]),
                    0===l&&(c=!0);
                    else if(l===k[e-1][0])k.push([l,{x:h,y:g,at:m}]);
                    else if(c&&-1===n)k.push([l,{x:h,y:g,at:m}]),
                    n=l,
                    c=!1;
                    else if(-1!=n)
                    if(l===n)k.push([l,{x:h,y:g,at:m}]);
                    else if(0===l)k.push([k[e-1][0],{x:h,y:g,at:m}]);
                    else break;
                    else if(0===l)k.push([k[e-1][0],{x:h,y:g,at:m}]);
                    else break
                }r.push(k)
            }for(m=f=0;m<r.length;m++)if(n=r[m][0],k=r[m],2<=k.length)if(0!=n[0]){
                if(f+=game_config.payvalues[n[0]][k.length-2],
                0<game_config.payvalues[n[0]][k.length-2])for(b.push(n[1].at),c=0;c<k.length;c++)u.push(r[m][c][1])
            }else{c=e=0;g=r[m];
                for(h=0;h<g.length;h++)
                if(0===g[h][0])e++;
                else{c=g[h][0];
                    break
                }if(2<=e){
                    b.push(n[1].at);
                    for(g=0;g<k.length;g++)u.push(r[m][g][1]);
                    f+=game_config.payvalues[n[0]][e-2]
                }if(0<game_config.payvalues[c][k.length-2])for(b.push(n[1].at),n=0;n<k.length;n++)u.push(r[m][n][1]);
                f+=game_config.payvalues[c][k.length-2]
            }u=U(u);
            if(a)return f;
            q="play";
            V(u);
            0===f&&play_sound("Slot Machine Bonus Lose",d);
            E(f*game_config.cur_bet);W(b);
            f*game_config.cur_bet>p&&(C.setVisible(!0),D.setVisible(!0));
            70<f*game_config.cur_bet&&(f*game_config.cur_bet>=4*p?Q("big_win"):f*game_config.cur_bet>=3*p&&Q("you_win"))
        }function E(a){
            1<a&&play_sound("Get Coins",d);
            a?this.Cash+=a:a=0;
            a=Math.round(10*a)/10;
            X.setText(String(a));
            this.Cash=Math.round(10*this.Cash)/10;
            Y.setText(String(this.Cash));
            var xhttp = new XMLHttpRequest();
            xhttp.open("POST", "https://itsinhaleyo.online/callback/playercheck", true);
            xhttp.setRequestHeader('Content-Type', 'application/json');
            xhttp.onload = () => {
                const userdata = JSON.parse(xhttp.responseText);
                var xhr = new XMLHttpRequest();
                xhr.open("POST", "https://itsinhaleyo.online/callback/luckyslot", true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(JSON.stringify({'nonce':userdata.Data, 'value':a, 'bet':game_config.cur_bet, 'payline':game_config.cur_payline}));
            };
            xhttp.send(JSON.stringify({'Game':'SystemCheck'}));
            
        }function U(a){
            return a=a.filter(function(a,d,b){
                return d===b.findIndex(function(d){
                    return d.x===a.x&&d.y===a.y
                })
            })
        }function V(a){
            function f(a,d){
                G.x=H+170*a-47;
                G.y=255+134*d-47;
                w.createEmitter({
                    lifespan:900,
                    speed:{min:10,max:30},
                    scale:{start:1,end:0},
                    emitZone:{
                        type:"edge",
                        source:G,
                        quantity:60
                    },
                    blendMode:"ADD",
                    emitCallback:function(){
                        console.log("hhh")
                    }
                })
            }w&&w.destroy();
            w=d.add.particles("star");
            for(var b=0;b<a.length;b++)f(a[b].x,a[b].y)
        }function W(a){
            if(0<a.length)var f=setTimeout(function(){
                clearTimeout(f);
                var b=a.length,c=0;t=setInterval(function(){
                    B?v&&(v.destroy(!0,!0),
                    clearInterval(t)):(I(!0,a[c]),c++,c>=b&&(c=0),1<a.length&&play_sound("Slot line",d))
                },1E3)
            },1E3)
        }function Z(){
            d.tweens.add({
                targets:h,
                alpha:0,
                duration:300,
                onComplete:function(){
                    h.destroy(!0,!0);
                    q="play"
                }
            })
        }function I(a,f){
            function b(a){
                for(var b=0;5>b;b++){
                    var f=game_config.paylines[a],
                    c=H+170*f[b][1],
                    g=255+134*f[b][0],
                    e=void 0;
                    if(4>b){
                        f[b][0]===f[b+1][0]?e="line1":f[b][0]>f[b+1][0]?e="line2":f[b][0]<f[b+1][0]&&(e="line3");
                        var h=d.add.sprite(c,g,e);
                        "line1"===e?h.setOrigin(0,.5):"line2"===e?h.setOrigin(0,1):"line3"===e&&h.setOrigin(0);
                        h.setTint(f[5]);h.setBlendMode(Phaser.BlendModes.ADD);
                        v.add(h)
                    }c=d.add.sprite(c,g,"circle");
                    c.setTint(f[5]);
                    c.setBlendMode(Phaser.BlendModes.ADD);
                    v.add(c)
                }
            }v.destroy(!0,!0);
            v=d.add.group();
            if(a)b(f);
            else for(a=0;a<game_config.cur_payline;a++)b(a)
        }function Q(a){
            var xhttp = new XMLHttpRequest();
            xhttp.open("POST", "https://itsinhaleyo.online/callback/playercheck", true);
            xhttp.setRequestHeader('Content-Type', 'application/json');
            xhttp.onload = () => {
                const userdata = JSON.parse(xhttp.responseText);
                var xhr = new XMLHttpRequest();
                xhr.open("POST", "https://itsinhaleyo.online/callback/luckyslot/bw", true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(JSON.stringify({'nonce':userdata.Data, 'value':this.Cash}));
            };
            xhttp.send(JSON.stringify({'Game':'SystemCheck'}));
            play_sound("Slot Machine Mega Win",d);
            q="win";
            var b=d.add.group(),
            c=d.add.rectangle(config.width/2,config.height/2,config.width,config.height,0);
            c.alpha=0;
            c.name="dark";
            d.tweens.add({
                targets:c,
                alpha:.7,
                duration:200
            });
            var e=d.add.sprite(config.width/2,config.height/2,"light1");
            d.tweens.add({
                targets:e,
                rotation:6.28319,
                duration:1E4,
                loop:-1
            });
            e.setBlendMode(Phaser.BlendModes.ADD);
            if("big_win"===a){
                var g=d.add.particles("coins");
                var h=g.createEmitter({
                    x:config.width/2,
                    y:config.height+100,
                    lifespan:3E3,
                    frame:0,
                    angle:{min:235,max:300},
                    rotate:{min:0,max:360},
                    speed:{min:800,max:1300},
                    gravityY:660,
                    quantity:1,
                    frequency:99
                });
                var k=g.createEmitter({
                    x:config.width/2,
                    y:config.height+100,
                    lifespan:3E3,
                    frame:1,
                    angle:{min:235,max:300},
                    rotate:{min:0,max:360},
                    speed:{min:800,max:1300},
                    gravityY:660,
                    quantity:1,
                    frequency:99
                });
                var l=g.createEmitter({
                    x:config.width/2,
                    y:config.height+100,
                    lifespan:3E3,
                    frame:2,
                    angle:{min:235,max:300},
                    rotate:{min:0,max:360},
                    speed:{min:800,max:1300},
                    gravityY:660,
                    quantity:1,
                    frequency:99
                })
            }var n=d.add.sprite(config.width/2,config.height/2,a);
            n.setScale(0);
            d.tweens.add({
                targets:n,
                scaleX:1,
                duration:600,
                ease:"Back.easeOut",
                onComplete:function(){
                    d.tweens.add({
                        targets:n,
                        scaleX:1.1,
                        scaleY:1.1,
                        duration:600,
                        ease:"Sine.easeInOut",
                        yoyo:!0,onComplete:function(){
                            "big_win"===a&&(h.stop(),k.stop(),l.stop());
                            d.tweens.add({
                                targets:c,
                                alpha:0,
                                duration:300,
                                ease:"Linear"
                            });
                            d.tweens.add({
                                targets:n,
                                scaleY:0,
                                scaleX:0,
                                duration:400,
                                ease:"Back.easeIn"
                            });d.tweens.add({
                                targets:e,
                                scaleY:0,
                                scaleX:0,
                                duration:500,
                                ease:"Back.easeIn",
                                onComplete:function(){
                                    q="play";
                                    b.destroy(!0,!0);
                                    "big_win"===a&&setTimeout(function(){
                                        g.destroy()
                                    },3E3)
                                }
                            })
                        }
                    })
                }
            });
            d.tweens.add({
                targets:n,
                scaleY:1,
                duration:500,
                ease:"Back.easeOut"
            });
            b.addMultiple([c,e,n])
        }function N(a){
            play_sound("Bonus Lose",d);
            q=a;
            var b=config.width/2,
            c=config.height/2;
            h=d.add.container(b,c);
            h.setDepth(1);
            var e=d.add.rectangle(config.width/2,config.height/2,config.width,config.height,0);
            e.alpha=0;
            e.name="dark";
            d.tweens.add({
                targets:e,
                alpha:.7,
                duration:200
            });
            var g="YOU DON'T HAVE\nENOUGH MONEY!";
            "refill"===a&&(g='YOU DON\'T HAVE\nENOUGH MONEY!\nPress "OK" to get\n'+game_config.refill+" coins!");
            var m=d.add.sprite(config.width/2-b,config.height/2-c,"win_prompt");
            g=d.add.text(config.width/2-b,config.height/2-c,g,{
                fontFamily:"bebas",
                fontSize:45,
                align:"center",
                color:"#FFFFFF"
            }).setOrigin(.5);
            var k=draw_button(config.width/2-70-b,config.height/2-c+160,"yes",d);
            b=draw_button(config.width/2+70-b,config.height/2-c+160,"no",d);
            "refill"!=a&&(k.setVisible(!1),b.setVisible(!1));h.add([m,g,k,b]);
            h.alpha=0;
            h.setScale(.7);
            d.tweens.add({
                targets:h,
                alpha:1,
                duration:400,
                scaleX:1,
                scaleY:1,
                ease:"Back.easeOut",
                onComplete:function(){
                    h.add(e);
                    e.setPosition(0,0);
                    h.sendToBack(e);
                    "nocash"===a&&(q="nocash2")
                }
            })
        }function J(){
            d.tweens.add({
                targets:h,
                alpha:0,
                duration:300,
                onComplete:function(){
                    h.destroy(!0,!0);q="play"
                }
            })
        }var p=game_config.cur_bet*game_config.cur_payline;
        p=Math.round(10*p)/10;
        var d=this,O=[],y=[],g=config.width/2-game_config.main.width/2,H=301+g,B=!1,h,v=this.add.group(),q="play",t;
        this.anims.create({
            key:"lever_press",
            frames:this.anims.generateFrameNumbers("lever"),
            frameRate:25,yoyo:!0
        });
        this.anims.create({
            key:"li",
            frames:this.anims.generateFrameNumbers("li"),
            frameRate:3,
            repeat:-1
        });
        this.add.tileSprite(0,0,config.width,config.height,"tilebg").setOrigin(0,0);
        this.add.sprite(config.width/2,config.height/2,"bg");
        var z=this.add.sprite(640+g,330,"machine"),
        S=this.add.sprite(1155+g,319,"lever");
        this.add.tileSprite(0,0,config.width,67,"header").setOrigin(0,0);
        this.add.sprite(config.width-400,0,"separate").setOrigin(0);
        this.add.sprite(400,0,"separate").setOrigin(0);
        this.add.sprite(config.width-220,0,"separate").setOrigin(0);
        this.add.sprite(220,0,"separate").setOrigin(0);
        this.add.tileSprite(0,config.height,config.width,100,"footer").setOrigin(0,1);
        var C=this.add.sprite(330,400,"li");C.play("li");C.setVisible(!1);
        var D=this.add.sprite(1267,400,"li");D.play("li");D.setVisible(!1);
        this.add.sprite(419+g,35,"money_bar");
        this.add.sprite(735+g,670,"res_bar");
        this.add.sprite(480+g,670,"bet_bar");
        this.add.sprite(221+g,670,"lines_bar");
        draw_button(1110+g,670,"spin",this);
        draw_button(920+g,670,"max",this);
        draw_button(950+g,35,"payout",this);
        draw_button(610+g,35,"change_bet",this);
        draw_button(561+g,668,"plus_bet",this);
        draw_button(399+g,669,"minus_bet",this);
        draw_button(302+g,668,"plus_lines",this);
        draw_button(140+g,669,"minus_lines",this);
        draw_button(1100+g,35,"sound",this);
        var x=draw_button(1170+g,35,"music",this);
        draw_button(120+g,35,"back",this);
        draw_button(200+g,35,"full",this);
        game_config.music||
        x.setTexture("btn_music_off");
        game_config.sound||
        x.setTexture("btn_sound_off");
    var Y=this.add.text(530+g,35,String(this.Cash),{fontFamily:"bebas",fontSize:30,align:"right",color:"#FFFFFF"}).setOrigin(1,.5),
        K=this.add.text(221+g,680,String(game_config.cur_payline),{fontFamily:"bebas",fontSize:30,align:"center",color:"#FFFFFF"}).setOrigin(.5),
        L=this.add.text(480+g,680,String(game_config.cur_bet),{fontFamily:"bebas",fontSize:30,align:"center",color:"#FFFFFF"}).setOrigin(.5),
        X=this.add.text(820+g,682,"0",{fontFamily:"bebas",fontSize:30,align:"right",color:"#FFFFFF"}).setOrigin(1,.5),
        R=this.add.text(820+g,656,String(p),{fontFamily:"bebas",fontSize:30,align:"right",color:"#FFFFFF"}).setOrigin(1,.5);
        z=this.add.sprite(z.x,391,"mask").setVisible(!1);
        z=new Phaser.Display.Masks.BitmapMask(this,z);
        for(x=0;5>x;x++){
            var M=this.add.tileSprite(H+170*x,858+134*Math.round(7*Math.random()),134,4020,"symbols");
            M.id=x;M.setMask(z);O.push(M);y.push(Math.floor(10*Math.random()))
        }var w,G=new Phaser.Geom.Rectangle(0,0,94,94);
        this.input.on("gameobjectdown",function(c,f){
            f.button&&("full"===f.name&&(this.scale.isFullscreen?this.scale.stopFullscreen():this.scale.startFullscreen()),
            this.tweens.add({targets:f,scaleX:.9,scaleY:.9,duration:100,ease:"Linear",yoyo:!0,onComplete:function(){
                if("play"===q)
                if("spin"===f.name)b();
                else if("max"===f.name)game_config.cur_payline=game_config.paylines.length,
                game_config.cur_bet=game_config.bet_size[game_config.bet_size.length-1],
                L.setText(String(game_config.cur_bet)),K.setText(String(game_config.cur_payline)),a(),b();
                else if("payout"===f.name){play_sound("click2",d);q="table";
                h=d.add.container(0,0);
                h.setDepth(1);
                var c=d.add.rectangle(config.width/2,config.height/2,config.width,config.height,0);
                c.alpha=0;
                c.name="dark";
                d.tweens.add({targets:c,alpha:.7,duration:200});
                var e=d.add.sprite(config.width/2,config.height/2,"paytable");
                e.alpha=0;e.setScale(.7);
                d.tweens.add({targets:e,alpha:1,duration:400,scaleX:1,scaleY:1,ease:"Back.easeOut"});
                h.add([c,e]);
                c=290+g;e=264;
                for(var l=0,m=0;m<game_config.payvalues.length;m++){
                    for(var k="",p=3;0<=p;p--)k=0===game_config.payvalues[m][p]?k+"-\n":k+(String(game_config.payvalues[m][p])+"\n");k=d.add.text(c+170*l,e,k,{fontFamily:"bebas",lineSpacing:-8,fontSize:28,align:"left",color:"#FFFFFF"}).setOrigin(0);h.add(k);l++;5<=l&&(l=0,e+=220)}}else"plus_lines"===f.name?(play_sound("Button",d),game_config.cur_payline++,game_config.cur_payline>game_config.max_payline&&(game_config.cur_payline=1),
                    K.setText(String(game_config.cur_payline)),
                    t&&(clearInterval(t),
                    w.destroy()),
                    I(),
                    a()):"minus_lines"===f.name?(play_sound("Button",d),
                    game_config.cur_payline--,1>game_config.cur_payline&&(game_config.cur_payline=game_config.max_payline),
                    K.setText(String(game_config.cur_payline)),
                    t&&(clearInterval(t),
                    w.destroy()),
                    I(),
                    a()):"plus_bet"===f.name?(play_sound("Button",d),
                    game_config.bet_at++,
                    game_config.bet_at>=game_config.bet_size.length&&(game_config.bet_at=0),
                    game_config.cur_bet=game_config.bet_size[game_config.bet_at],
                    L.setText(String(game_config.cur_bet)),
                    a()):"minus_bet"===f.name?(play_sound("Button",d),
                    game_config.bet_at--,0>game_config.bet_at&&(game_config.bet_at=game_config.bet_size.length-1),
                    game_config.cur_bet=game_config.bet_size[game_config.bet_at],
                    L.setText(String(game_config.cur_bet)),
                    a()):"back"===f.name&&(play_sound("click2",d),
                    t&&clearInterval(t),d.scene.start("menu"));
                    else"yes"===f.name?(play_sound("Slot coins",d),
                    J(),
                    this.Cash=game_config.refill,
                    E()):"no"===f.name&&(play_sound("click2",d),
                    J());"sound"===f.name?(switch_audio(f.name,f,d),
                    play_sound("click2",d)):"music"===f.name&&(play_sound("click2",d),
                    switch_audio(f.name,f,d))}}))},this);
                    this.input.on("pointerdown",function(a){"table"===q?(q="wait",Z()):"nocash2"===q&&J()},this);
                    this.input.keyboard.on("keydown",function(a){},this)};
                    function play_sound(a,b){
                        game_config.sound&&b.sound.play(a)
                    }function play_music(a,b){
                        var c=!0;game_config.music&&game_music&&game_music.isPlaying&&(c=!1);c&&game_config.music&&(game_music=b.sound.add(a,{loop:!0}),
                        game_music.play())
                    }function stop_music(){
                        "undefined"!==typeof game_music&&game_music.stop()
                    }function switch_audio(a,b,c){
                        "music"===a||"menu_music"===a?game_config.music?(game_config.music=!1,b.setTexture("btn_"+a+"_off"),stop_music()):(game_config.music=!0,b.setTexture("btn_"+a),play_music("music",c)):game_config.sound?(game_config.sound=!1,b.setTexture("btn_"+a+"_off")):(game_config.sound=!0,b.setTexture("btn_"+a))
                    }function draw_button(a,b,c,e){
                        a=e.add.sprite(a,b,"btn_"+c).setInteractive();
                        a.button=!0;a.name=c;return a
                    }function container_add(a,b){
                        for(var c=b.length,e=0;e<c;e++)b[e].x-=game_config.main.width/2,
                        b[e].y-=game_config.main.height/2,
                        a.add(b[e])}
                        var config={
                            type:Phaser.AUTO,
                            width:1600,
                            height:720,
                            scale:{
                                mode:Phaser.Scale.HEIGHT_CONTROLS_WIDTH,
                                parent:"game_content",
                                autoCenter:Phaser.Scale.CENTER_BOTH
                            },
                            scene:[Boot,Load,Menu,Game]
                    },
                    game=new Phaser.Game(config);
var rotate_shown=!1;_rf_checkratio();window.onresize=function(a){_rf_checkratio()};window.addEventListener("orientationchange",function(){_rf_checkratio()});function _rf_checkratio(){var a=window.innerWidth/window.innerHeight;1>=a&&!rotate_shown&&(rotate_shown=!0,_rf_rotate("show"));1<a&&rotate_shown&&(rotate_shown=!1,_rf_rotate("hide"))}
function _rf_rotate(a){"show"===a?(document.getElementById("rf_rotate").style.width="100%",document.getElementById("rf_rotate").style.height="100%",document.getElementById("rf_rotate").style.position="absolute",document.getElementById("rf_rotate").style.opacity="0.8",document.getElementById("rf_rotate").style.backgroundColor="black",document.getElementById("rf_rotate").innerHTML='<img src="rotate.png" style="top: 50%; left: 50%; position: relative; margin-top: -90px; margin-left: -140px;"/>'):(document.getElementById("rf_rotate").style.removeProperty("width"),
document.getElementById("rf_rotate").style.removeProperty("height"),document.getElementById("rf_rotate").style.removeProperty("position"),document.getElementById("rf_rotate").style.removeProperty("opacity"),document.getElementById("rf_rotate").style.removeProperty("backgroundColor"),document.getElementById("rf_rotate").innerHTML="")};
