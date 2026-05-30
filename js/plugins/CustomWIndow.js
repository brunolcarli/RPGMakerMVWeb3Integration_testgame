(function() {

    function Window_Custom() {
        this.initialize.apply(this, arguments);
    }

    Window_Custom.prototype = Object.create(Window_Base.prototype);
    Window_Custom.prototype.constructor = Window_Custom;

    Window_Custom.prototype.initialize = function(x, y, width, height) {
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this.refresh();
    };

    Window_Custom.prototype.refresh = function() {
        this.contents.clear();
        this.drawText("Carteira Web3", 0, 0, this.contentsWidth(), "center");
    };

    var _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;

    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);

        this._customWindow = new Window_Custom(20, 20, 300, 100);
        this.addWindow(this._customWindow);
    };

})();