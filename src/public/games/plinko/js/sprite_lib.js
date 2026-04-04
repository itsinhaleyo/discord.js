function CSpriteLibrary(){

    var _oLibSprites = {};
    var _oSpritesToLoad;
    var _iNumSprites;
    var _iCntSprites;
    var _cbCompleted;
    var _cbTotalCompleted;
    var _cbOwner;
    
    this.init = function( cbCompleted,cbTotalCompleted, cbOwner ){
        _oSpritesToLoad = {};
        _iNumSprites = 0;
        _iCntSprites = 0;
        _cbCompleted = cbCompleted;
        _cbTotalCompleted = cbTotalCompleted;
        _cbOwner     = cbOwner;
    };
    
    this.addSprite = function( szKey, szPath ){
        if ( _oLibSprites.hasOwnProperty(szKey) ){
            return ;
        }
        
        var oImage = new Image();
        _oLibSprites[szKey] = _oSpritesToLoad[szKey] = { szPath:szPath, oSprite: oImage ,bLoaded:false};
        _iNumSprites++;
    };
    
    this.getSprite = function( szKey ){
        if (!_oLibSprites.hasOwnProperty(szKey)){
            return null;
        }else{
            return _oLibSprites[szKey].oSprite;
        }
    };
    
    this._onSpritesLoaded = function(){
        _iNumSprites = 0;
        _cbTotalCompleted.call(_cbOwner);
    };

    this._onSpriteLoaded = function(){
        _iCntSprites++;
        if(_cbCompleted){
            _cbCompleted.call(_cbOwner);
        }
        
        if (_iCntSprites === _iNumSprites) {
            _oSpritesToLoad = {}; // Clear loading queue
            _cbTotalCompleted.call(_cbOwner);
        }
    };    

    this.loadSprites = function(){
        var _oParent = this; // Capture the correct 'this'
        for (var szKey in _oSpritesToLoad) {
            (function(key){ // Create a closure to keep the key stable
                var oImage = _oSpritesToLoad[key].oSprite;
                oImage.onload = function(){
                    _oParent.setLoaded(key);
                    _oParent._onSpriteLoaded();
                };
                oImage.onerror = function(){
                    console.error("Failed to load sprite: " + _oSpritesToLoad[key].szPath);
                    // Retry logic
                    setTimeout(function(){
                        oImage.src = _oSpritesToLoad[key].szPath;
                    }, 500);
                };
                oImage.src = _oSpritesToLoad[key].szPath;
            })(szKey);
        } 
    };
    
    this.setLoaded = function(szKey){
        _oLibSprites[szKey].bLoaded = true;
    };
    
    this.isLoaded = function(szKey){
        return _oLibSprites[szKey].bLoaded;
    };
    
    this.getNumSprites=function(){
        return _iNumSprites;
    };
}