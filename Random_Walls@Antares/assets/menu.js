const { GObject, Shell, St } = imports.gi;
const Main = imports.ui.main;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Interval = Me.imports.assets.timeout;
const Wallpapers = Me.imports.assets.wallpapers;
const Chooser = Me.imports.assets.pictureChooser;
const MyConfig = Me.imports.prefs;
const Lang = imports.lang;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Gettext = imports.gettext.domain('randwall');
const _ = Gettext.gettext;

const SETTINGS_FOLDER_LIST = "folder-list";
const SETTINGS_CHANGE_MODE = "change-mode";
const SETTINGS_HIDE_ICON = "hide-icon";
const SETTINGS_TIMEOUT = "change-time";

const CURRENT_DESK = 0;
const CURRENT_LOCK = 1;
const NEXT_DESK = 2;
const NEXT_LOCK = 3;

let metadata = Me.metadata;
let settings;
var MyTimer;

var LabelWidget = GObject.registerClass(
  class LabelWidget extends PopupMenu.PopupBaseMenuItem {
    _init(text, type) {
      super._init({
        reactive: false
      });

      this._label = new St.Label({
        text: text,
        style_class: "labels"
      });
      //Add type to stylesheet.css if you want different styles
      this._label.add_style_class_name(type);

      this.add_child(this._label);
    }

    setText(text) {
      this._label.text = text;
    }
  });


var ControlButton = GObject.registerClass(
  class ControlButton extends St.Button {
    _init(icon, callback) {
      this.icon = new St.Icon({
        icon_name: icon + "-symbolic", // Get the symbol-icons.
        icon_size: 20
      });

      super._init({
        style_class: 'notification-icon-button control-button', // buttons styled like in Rhythmbox-notifications
        child: this.icon
      })

      this.icon.set_style('padding: 0px');
      this.set_style('padding: 8px'); // Put less space between buttons

      if (callback != undefined || callback != null) {
        this.connect('clicked', callback);
      }
    }

    setIcon(icon) {
      this.icon.icon_name = icon + '-symbolic';
    }
  });

var ConfigControls = GObject.registerClass(
  class ConfigControls extends PopupMenu.PopupBaseMenuItem {
    _init() {
      super._init({
        reactive: false
      });

      this.box = new St.BoxLayout({
        x_expand: "true",
        y_expand: "true",
        style_class: "controls",
      });

      this.box.expand = true;

      this.add_child(this.box);
      this.box.add_actor(new ControlButton("list-add", this._openConfigWidget));

    }

    _openConfigWidget() {
      let _appSys = Shell.AppSystem.get_default();
      let _gsmPrefs = _appSys.lookup_app("org.gnome.Extensions.desktop");
      // The proper value is Shell.AppState.RUNNING; Not sure what the other value is, but it's kept
      // in as that was there previously 
      // See: (https://gjs-docs.gnome.org/shell01~0.1_api/shell.appstate)
      if (_gsmPrefs.get_state() == _gsmPrefs.SHELL_APP_STATE_RUNNING || Shell.AppState.RUNNING) {
        _gsmPrefs.activate();
      } else {
        let info = _gsmPrefs.get_app_info();
        let timestamp = global.display.get_current_time_roundtrip();
        info.launch_uris([metadata.uuid], global.create_app_launch_context(timestamp, -1));
      }
    }
  });

var NextWallControls = GObject.registerClass(
  class NextWallControls extends PopupMenu.PopupBaseMenuItem {
    _init(wallUtils, settings) {
      super._init({
        reactive: false
      });

      this._wallUtils = wallUtils;

      this.box = new St.BoxLayout({
        x_expand: true,
        y_expand: true,
        style_class: "controls",
      });

      let currentMode = settings.get_string(SETTINGS_CHANGE_MODE);
      if (currentMode == "different") {
        this.box.set_style("padding-left: " + (Chooser.THUMB_WIDTH - 30) + "px;");
      } else {
        this.box.set_style("padding-left: " + ((Chooser.THUMB_WIDTH / 2) - 36) + "px;"); //36 = button_size*2 + padding*2
      }

      this.add_child(this.box);
      this.box.add_actor(new ControlButton("media-playback-start", Lang.bind(this, this._changeWalls)));
      this.box.add_actor(new ControlButton("media-playlist-shuffle", Lang.bind(this, this._newNextWalls)));
    }

    _changeWalls() {
      if (this._wallUtils != null)
        this._wallUtils.changeWallpapers();
    }

    _newNextWalls() {
      if (this._wallUtils != null)
        this._wallUtils.setNewNextAndRefresh();
    }
  });

var ThumbPreviews = GObject.registerClass(class ThumbPreviews extends PopupMenu.PopupBaseMenuItem {
  _init(isNextThumbs, indicator, wallUtils, _settings) {
    super._init();
    this._isNextThumbs = isNextThumbs;
    this._wallUtils = wallUtils;
    //Main Box
    let MainBox = new St.BoxLayout({ vertical: false });
    //Label + Icon Desktop Wallpaper Box
    let desktopBox = new St.BoxLayout({ vertical: true });
    let currentMode = _settings.get_string(SETTINGS_CHANGE_MODE);
    let textLabel, whoami;
    /* 1st step: Label and identifier */
    switch (currentMode) {
      case "different":
      case "desktop":
        textLabel = _("Desktop");
        whoami = (this._isNextThumbs) ? NEXT_DESK : CURRENT_DESK;
        break;
      case "same":
        textLabel = _("Desktop & Lockscreen");
        whoami = (this._isNextThumbs) ? NEXT_DESK : CURRENT_DESK;
        break;
      case "lockscreen":
        textLabel = _("Lockscreen");
        whoami = (this._isNextThumbs) ? NEXT_LOCK : CURRENT_LOCK;
        break;
    }
    desktopBox.add_child(new St.Label({ text: textLabel, style_class: "label-thumb" }));
    /* End 1st step */

    /* 2nd step: Create wallIcon (only if not in lockscreen mode)*/
    if (currentMode != "lockscreen") {
      let filewall = wallUtils.getCurrentWall();
      this.wallIcon = new Chooser.ThumbIcon(filewall, function () {
        indicator.close();
        new Chooser.PictureChooser(whoami, wallUtils).open();
      });
      desktopBox.add_actor(this.wallIcon);
      MainBox.add_child(desktopBox);
      MainBox.add_child(new St.Icon({ width: 20 }));
    }
    /* End 2nd step */

    /* 3rd step: Create lockIcon (only in "different" and "lockscreen" mode*/
    let lockwhoami = whoami;
    switch (currentMode) {
      case "different":
        //whoami was NEXT or CURRENT desktop on the 1st step. Now is NEXT or CURRENT lock
        lockwhoami = (this._isNextThumbs) ? NEXT_LOCK : CURRENT_LOCK;
      case "lockscreen":
        let lockBox = new St.BoxLayout({ vertical: true });
        lockBox.add_child(new St.Label({ text: _("Lockscreen"), style_class: "label-thumb" }));
        let lockwall = wallUtils.getCurrentLockWall();
        this.lockIcon = new Chooser.ThumbIcon(lockwall, function () {
          indicator.close();
          new Chooser.PictureChooser(lockwhoami, wallUtils).open();
        });
        lockBox.add_child(this.lockIcon);
        MainBox.add_child(lockBox);
        break;
    }
    /* End 3nd step*/
    // Add everything to the mainbox
    this.add_actor(MainBox);
  }

  setWallThumb() {
    let newIcon = null;

    if (this._isNextThumbs)
      newIcon = this._wallUtils.getNextWall();
    else
      newIcon = this._wallUtils.getCurrentWall();

    this.wallIcon.set_gicon(newIcon);
  }


  setLockThumb() {
    let lockIcon = null;

    if (this._isNextThumbs)
      lockIcon = this._wallUtils.getNextLockWall();
    else
      lockIcon = this._wallUtils.getCurrentLockWall();

    this.lockIcon.set_gicon(lockIcon);
  }
});

var RandWallMenu = GObject.registerClass(
  class RandWallMenu extends PanelMenu.Button {
    _init(settings, wallUtils) {
      super._init(0.0, "randwall");

      this._wallUtils = wallUtils;

      let hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
      let gicon = imports.gi.Gio.icon_new_for_string(Me.path + "/icons/randwall-symbolic.symbolic.png");
      let icon = new St.Icon({
        style_class: 'system-status-icon randwall-icon',
        gicon: gicon
      });
      hbox.add_child(icon);
      hbox.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
      this.add_actor(hbox);

      if (!this._wallUtils.isEmpty()) {
        //Label current wallpapers
        this.menu.addMenuItem(new LabelWidget(_("CURRENT"), "info"));
        // Current Walls thumbs
        this.currentThumbs = new ThumbPreviews(false, this, wallUtils, settings);
        this.menu.addMenuItem(this.currentThumbs);
        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        //Label current wallpapers
        this.menu.addMenuItem(new LabelWidget(_("NEXT"), "info"));
        // Next Walls thumbs
        this.nextThumbs = new ThumbPreviews(true, this, wallUtils, settings);
        this.menu.addMenuItem(this.nextThumbs);
        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        //Controles
        let control = new NextWallControls(wallUtils, settings);
        this.menu.addMenuItem(control);
      } else {
        this.menu.addMenuItem(new LabelWidget(_("No images found!"), "error"));
        this.menu.addMenuItem(new LabelWidget(_("Please, add some folders with images"), "info"));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new ConfigControls());
      }
    }

    _changeBackgrounds() {
      this._wallUtils.changeWallpapers();
      //update thumbs
      this.refreshThumbs();
    }

    close() {
      this.menu.close();
    }
  });
