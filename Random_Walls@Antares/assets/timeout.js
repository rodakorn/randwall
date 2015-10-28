const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

//SCHEMA KEYS
const SETTINGS_TIMEOUT = "change-time";

const MyTimer = new Lang.Class({
    Name: "MyTimer",

    _settings: {},
    _timeout: 0,
    _callback: null,
    _timerId: null,
        
    _init: function() {
    	this._settings = Convenience.getSettings();
    	this._timeout = this._settings.get_int(SETTINGS_TIMEOUT)*60000;
    	// Listen to changes and restart with new timeout.
        this._settings.connect('changed::' + SETTINGS_TIMEOUT,Lang.bind(this,function(value){
        	let newValue = value.get_int(SETTINGS_TIMEOUT);
        	if((this._timeout != newValue) && (newValue >= 1) && (newValue <= 3000)) {
        		this._timeout = newValue*60000;
        		this.start();
        	}
        }));
	},
	
	setCallback: function(callback) {
		if (callback === undefined || callback === null || typeof callback !== "function"){
    		throw TypeError("'callback' needs to be a function.");
        }
        this._callback = callback;
	},
	
	start: function() {
		this.stop();
		this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,this._timeout, this._callback);
	},
	
	stop: function() {
		//If timerId is not set we don't do anything
		if (this._timerId !== null) {
			GLib.source_remove(this._timerId);
			this._timerId = null;
		}
	},		
});
