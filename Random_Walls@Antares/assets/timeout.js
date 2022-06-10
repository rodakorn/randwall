const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

//SCHEMA KEYS
const SETTINGS_TIMEOUT = "change-time";

var MyTimer = class MyTimer {
  constructor() {
    this._settings = Convenience.getSettings();
    this._timeout = this._settings.get_int(SETTINGS_TIMEOUT) * 60000;
    this._timerId = null;
    this._changed = false;

    // Listen to changes and restart with new timeout.
    this._settings.connect('changed::' + SETTINGS_TIMEOUT, Lang.bind(this, function (value) {
      let newValue = value.get_int(SETTINGS_TIMEOUT);

      if ((this._timeout != newValue) && (newValue >= 1) && (newValue <= 3000)) {
        this._changed = true;
        this._timeout = newValue * 60000;
        this.start();
      }
    }));
  }

  changed() {
    return this._changed;
  }

  setCallback(callback) {
    if (callback === undefined || callback === null || typeof callback !== "function") {
      throw TypeError("'callback' needs to be a function.");
    }
    this._callback = callback;
  }

  start() {
    this.stop();
    this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._timeout, this._callback);
  }

  stop() {
    //If timerId is not set we don't do anything
    if (this._timerId !== null) {
      GLib.source_remove(this._timerId);
      this._timerId = null;
    }
  }
}
