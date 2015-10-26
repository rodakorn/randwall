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
    	log("Construyendo timer");
    	this._settings = Convenience.getSettings();
    	this._timeout = this._settings.get_int(SETTINGS_TIMEOUT)*60000;
    	log("Definimos el timeout en " + this._timeout/60000 + " minutos");
    	// Listen to changes and restart with new timeout.
        this._settings.connect('changed::' + SETTINGS_TIMEOUT,Lang.bind(this,function(value){
        	let newValue = value.get_int(SETTINGS_TIMEOUT);
        	log("El valor del timeout " + (this._timeout/60000) + " ha cambiado... seteando nuevo timeout a " + newValue);
        	if((this._timeout != newValue) && (newValue >= 1) && (newValue <= 3000)) {
        		log("El timeout era "+ (this._timeout/60000) + " y ahora es " + newValue);
        		this._timeout = newValue*60000;
        		log("Timeout cambiado... ahora le decimos al timer que empieze de nuevo");
        		this.start();
        	}
        }));
	},
	
	setCallback: function(callback) {
		log("Definiendo la funcion de callback");
		if (callback === undefined || callback === null || typeof callback !== "function"){
    		throw TypeError("'callback' needs to be a function.");
    		log("Ha habido un error asignando la funcion de callback");
        }
        this._callback = callback;
	},
	
	start: function() {
		log("Inciando timer. Paramos primero por si ya habia uno encendido");
		this.stop();
		log("Iniciamos");
		this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,this._timeout, this._callback);
	},
	
	stop: function() {
		//If timerId is not set we don't do anything
		log("Parando el timer. Miramos si es necesario");
		if (this._timerId !== null) {
			log("Timer parado");
			GLib.source_remove(this._timerId);
			this._timerId = null;
		}
	},		
});
