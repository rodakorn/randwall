const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;

const Config = imports.misc.config;

let shellMajorVersion = parseInt(Config.PACKAGE_VERSION.split('.')[0]);

const PICTURE_URIS = shellMajorVersion >= 42 ?
  ["picture-uri", "picture-uri-dark"] :
  ["picture-uri"];

const SETTINGS_CHANGE_MODE = 'change-mode';
// const SETTINGS_WALLS_URI = 'picture-uri';
// const SETTINGS_LOCK_URI = 'picture-uri';
const SETTINGS_FOLDER_LIST = 'folder-list';
const SETTINGS_BACKGROUND_MODE = 'picture-options';

var WallUtils = class WallUtils {
  constructor(settings, indicator) {
    this._settings = settings;
    this._dirs = this.initValidDirs();
    if (this._dirs != null) {
      this._nextWall = this.getRandomPicture();
      this._nextLock = this.getRandomPicture();
    }
  }

  setIndicator(indicator) {
    this._indicator = indicator;
  }

  getDirs() {
    return this._dirs;
  }

  getNumValidImages() {
    let numFiles = 0;
    for (let i = 0; i < this._dirs.length; i++) {
      let dir = Gio.File.new_for_path(this._dirs[i]);

      let fileEnum;
      try {
        fileEnum = dir.enumerate_children('standard::name,standard::type',
          Gio.FileQueryInfoFlags.NONE,
          null);
      } catch (e) {
        fileEnum = null;
      }

      let info, child;
      if (fileEnum !== null) {
        while ((info = fileEnum.next_file(null)) != null) {
          let child = fileEnum.get_child(info);
          //Check if is a regular file, and is an image
          if (info.get_file_type() == Gio.FileType.REGULAR &&
            /.*\.[jpg|jpeg|png]/i.test(child.get_parse_name())) {
            numFiles++;
          }
        }
      }
    }

    return numFiles;
  }

  getCurrentWall() {
    let background_setting = new Gio.Settings({schema: 'org.gnome.desktop.background'});
    let pathFromURI = decodeURIComponent(background_setting.get_string(PICTURE_URIS[0])).replace(/^file:\/\//g, '');
    return new Gio.FileIcon({file: Gio.File.new_for_path(pathFromURI)});
  }

  getCurrentLockWall() {
    let lockbackground_setting = new Gio.Settings({schema: 'org.gnome.desktop.screensaver'});
    let pathFromURI = decodeURIComponent(lockbackground_setting.get_string(PICTURE_URIS[0])).replace(/^file:\/\//g, '');
    return new Gio.FileIcon({file: Gio.File.new_for_path(pathFromURI)});
  }

  getGiconFromPath(path) {
    return new Gio.FileIcon({file: Gio.File.new_for_path(path)});
  }

  getNextWall() {
    return new Gio.FileIcon({file: Gio.File.new_for_path(this._nextWall)});
  }

  getNextLockWall() {
    return new Gio.FileIcon({file: Gio.File.new_for_path(this._nextLock)});
  }

  setWall(picture) {
    let background_setting = new Gio.Settings({schema: 'org.gnome.desktop.background'});

    for (let i = 0; i < PICTURE_URIS.length; i++) {
      background_setting.set_string(PICTURE_URIS[i],
        'file://' + picture.split('/').map(c => encodeURIComponent(c)).join('/'));
    }
  }

  setLockWall(picture) {
    let lockbackground_setting = new Gio.Settings({schema: 'org.gnome.desktop.screensaver'});

    lockbackground_setting.set_string(PICTURE_URIS[0],
      'file://' + picture.split('/').map(c => encodeURIComponent(c)).join('/'));
  }

  setNextLockWall(picture) {
    this._nextLock = picture;
  }

  setNextWall(picture) {
    this._nextWall = picture;
  }

  getRandomPicture() {
    //Get list of dirs with images and select one randomly
    //let listDirs = this._settings.get_strv(SETTINGS_FOLDER_LIST);
    let randDir = Math.floor((Math.random() * this._dirs.length));
    let dir = Gio.File.new_for_path(this._dirs[randDir]);
    let randPic = null;

    let fileEnum;
    try {
      fileEnum = dir.enumerate_children('standard::name,standard::type',
        Gio.FileQueryInfoFlags.NONE,
        null);
    } catch (e) {
      fileEnum = null;
    }
    //Make list of valid files
    let validFiles = [];
    if (fileEnum !== null) {
      let info, child;
      while ((info = fileEnum.next_file(null)) != null) {
        let child = fileEnum.get_child(info);
        //Check if is a regular file, and is an image
        if (info.get_file_type() == Gio.FileType.REGULAR &&
          /.*\.[jpg|jpeg|png]/i.test(child.get_parse_name())) {
          validFiles.push(child.get_parse_name());
        }
      }

      if (validFiles.length > 0) {
        let randomPic = Math.floor((Math.random() * validFiles.length));
        randPic = validFiles[randomPic];
      }
    }

    return randPic;
  }

  changeWallpapers() {
    // silence warnings if we removed all directories
    if (!this._dirs) {
      return;
    }

    let currentMode = this._settings.get_string(SETTINGS_CHANGE_MODE);
    //DESKTOP CHANGE: Always except if we are in lockscreen mode
    if (currentMode != 'lockscreen')
      this.setWall(this._nextWall);

    //LOCKSCREEN CHANGE: If we are in 'same' mode set the desktop wall
    //                   If we are in 'lockscreen' or 'different' change randomly
    if (currentMode != 'desktop') {
      if (currentMode == 'same')
        this.setLockWall(this._nextWall);
      else
        this.setLockWall(this._nextLock);
    }
    //Get new nextWalls
    this._nextWall = this.getRandomPicture();
    this._nextLock = this.getRandomPicture();
    //updateThumbs
    this.refreshThumbs();
  }

  refreshThumbs() {
    let currentMode = this._settings.get_string(SETTINGS_CHANGE_MODE);
    //DESKTOP THUMBS UPDATE: only if not in lockscreen mode
    if (currentMode != 'lockscreen') {
      this._indicator.currentThumbs.setWallThumb();
      this._indicator.nextThumbs.setWallThumb();
    }
    //LOCKSCREEN THUMBS: only if not in desktop or same mode
    if (currentMode != 'desktop' && currentMode != 'same') {
      this._indicator.currentThumbs.setLockThumb();
      this._indicator.nextThumbs.setLockThumb();
    }
  }

  setNewNextAndRefresh() {
    // silence warnings if we removed all directories
    if (!this._dirs) {
      return;
    }

    let currentMode = this._settings.get_string(SETTINGS_CHANGE_MODE);

    this._nextWall = this.getRandomPicture();
    this._nextLock = (currentMode == 'same') ? this._nextWall : this.getRandomPicture();

    if (currentMode != 'lockscreen')
      this._indicator.nextThumbs.setWallThumb();

    if (currentMode != 'desktop' && currentMode != 'same')
      this._indicator.nextThumbs.setLockThumb();

  }

  checkFolder(dirpath, validDirs) {
    let dir = Gio.File.new_for_path(dirpath);

    let fileEnum;
    try {
      fileEnum = dir.enumerate_children('standard::name,standard::type,standard::content-type',
        Gio.FileQueryInfoFlags.NONE,
        null);
    } catch (e) {
      fileEnum = null;
    }
    if (fileEnum !== null) {
      let info;
      while ((info = fileEnum.next_file(null)) != null) {
        let child = fileEnum.get_child(info);
        //Check if is a regular file
        if (info.get_file_type() == Gio.FileType.REGULAR) {
          //Check if file is a valid image, and be careful with loops
          if (info.get_content_type().match(/^image\//i) && validDirs.indexOf(dirpath) == -1) {
            validDirs.push(dirpath);
          }
        } else if (info.get_file_type() == Gio.FileType.DIRECTORY) {
          this.checkFolder(child.get_parse_name(), validDirs);
        }
      }
    }

    return validDirs;

  }

  initValidDirs() {
    let validDirs = [];
    let listDirs = this._settings.get_strv(SETTINGS_FOLDER_LIST);
    if (listDirs.length > 0) {
      for (let i = 0; i < listDirs.length; i++) {
        let dirpath = listDirs[i];
        this.checkFolder(dirpath, validDirs);
      }

      if (validDirs.length > 0)
        return validDirs;
    }

    return null;
  }

  isEmpty() {
    return this._dirs == null;
  }
}

var getScreenAspectRatio = function () {
  let background_setting = new Gio.Settings({schema: 'org.gnome.desktop.background'});
  let background_mode = background_setting.get_string(SETTINGS_BACKGROUND_MODE);
  if (background_mode == 'spanned') {
    return Gdk.Screen.height() / Gdk.Screen.width();
  } else {
    let screen = Gdk.Screen.get_default();
    let monitor = screen.get_monitor_geometry(screen.get_primary_monitor());
    return monitor.height / monitor.width;
  }
};
