const { GLib, GObject, Shell, St } = imports.gi;
const Main = imports.ui.main;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Interval = Me.imports.assets.timeout;
const Wallpapers = Me.imports.assets.wallpapers;
const Lang = imports.lang;
const Config = imports.misc.config;

let shellMajorVersion = parseInt(Config.PACKAGE_VERSION.split('.')[0]);
let shellMinorVersion = parseInt(Config.PACKAGE_VERSION.split('.')[1]);

let RandWallMenu;
let wallUtils;

if (shellMajorVersion >= 40 || shellMinorVersion > 30) {
  RandWallMenu = Me.imports.assets.menu.RandWallMenu;
} else {
  RandWallMenu = Me.imports.legacy.menu.RandWallMenu
}

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const SETTINGS_FOLDER_LIST = "folder-list";
const SETTINGS_CHANGE_MODE = "change-mode";
const SETTINGS_HIDE_ICON = "hide-icon";
const SETTINGS_TIMEOUT = "change-time";
const SETTINGS_CHANGE_TIMESTAMP = "change-timestamp";

function init(metadata) {
  _settings = Convenience.getSettings();
  Convenience.initTranslations();
  wallUtils = new Wallpapers.WallUtils(_settings);
  if (!wallUtils.isEmpty()) {
    this.MyTimer = new Interval.MyTimer();
    this.MyTimer.setCallback(function () {
      //	WARNING! Without the return true the timer will stop after the first run
      if (_settings.get_int(SETTINGS_TIMEOUT) != 0) {
        wallUtils.changeWallpapers();
        _settings.set_int64(SETTINGS_CHANGE_TIMESTAMP, +new Date());
        return true;
      } else
        return false;
    });
  }
  let theme = imports.gi.Gtk.IconTheme.get_default();
  theme.append_search_path(metadata.path + "/icons");
}

let _indicator;
let _settings;
let _wait_timer = null;

function enable() {
  _indicator = new RandWallMenu(_settings, wallUtils);

  wallUtils.setIndicator(_indicator);

  const configured_timeout = _settings.get_int(SETTINGS_TIMEOUT);

  if (!wallUtils.isEmpty() && this.MyTimer && configured_timeout != 0) {
    const now = +new Date();
    const expected_change_time = _settings.get_int64(SETTINGS_CHANGE_TIMESTAMP) + configured_timeout * 60000;

    // has SETTINGS_TIMEOUT time passed since the last change? if not, delay the first change
    if (now >= expected_change_time) {
      wallUtils.changeWallpapers();
      this.MyTimer.start();
      _settings.set_int64(SETTINGS_CHANGE_TIMESTAMP, now);
    } else {
      const timer = MyTimer;

      _wait_timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, expected_change_time - now, function() {
        // if the timeout was changed (even if it is the same value now), do not start a second time
        if (!timer.changed()) {
          wallUtils.changeWallpapers();
          timer.start();
          _settings.set_int64(SETTINGS_CHANGE_TIMESTAMP, now);
        }
        return false;
      });
    }
  }

  let hideIcon = _settings.get_boolean(SETTINGS_HIDE_ICON);

  if (!hideIcon)
    Main.panel.addToStatusArea('randwall', _indicator, 1, 'right');

  _settings.connect('changed::' + SETTINGS_HIDE_ICON, Lang.bind(this, applyChanges));
  _settings.connect('changed::' + SETTINGS_CHANGE_MODE, Lang.bind(this, applyChanges));
  _settings.connect('changed::' + SETTINGS_FOLDER_LIST, Lang.bind(this, applyChanges));
}

function applyChanges() {
  if (!_indicator || !wallUtils || !_settings)
    return;

  _indicator.destroy();
  wallUtils = new Wallpapers.WallUtils(_settings);
  _indicator = new RandWallMenu(_settings, wallUtils);
  wallUtils.setIndicator(_indicator);
  let hideIcon = _settings.get_boolean(SETTINGS_HIDE_ICON);
  if (!hideIcon)
    Main.panel.addToStatusArea('randwall', _indicator, 1, 'right');
  wallUtils.setNewNextAndRefresh();
}

function disable() {
  _indicator.destroy();

  if (this.MyTimer) {
    this.MyTimer.stop();
  }

  if (_wait_timer) {
    GLib.source_remove(_wait_timer);
  }
}
