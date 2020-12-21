const { GObject, Shell, St } = imports.gi;
const Main = imports.ui.main;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Interval = Me.imports.assets.timeout;
const Wallpapers = Me.imports.assets.wallpapers;
const Lang = imports.lang;
const Config = imports.misc.config;

let shellMinorVersion = parseInt(Config.PACKAGE_VERSION.split('.')[1]);

let RandWallMenu;
let wallUtils;

if (shellMinorVersion > 30) {
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

function enable() {
  _indicator = new RandWallMenu(_settings, wallUtils);

  wallUtils.setIndicator(_indicator);
  if (!wallUtils.isEmpty() && this.MyTimer && _settings.get_int(SETTINGS_TIMEOUT) != 0) {
    wallUtils.changeWallpapers();
    this.MyTimer.start();
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
}
