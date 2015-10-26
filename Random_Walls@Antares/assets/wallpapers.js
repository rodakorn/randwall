const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;

const SETTINGS_SAME_WALL = "same-wall";
const SETTINGS_WALLS_URI = "picture-uri";
const SETTINGS_LOCK_URI = "picture-uri";
const SETTINGS_FOLDER_LIST = "folder-list";

const WallUtils = new Lang.Class({
    Name: "WallUtils",

    _settings: null,
    _nextWall: null,
    _nextLock: null,
    _indicator: null,
    _dirs: null,
    
    _init: function(settings,indicator) {
    	this._settings = settings;
    	this._dirs = this.initValidDirs();
    	if(this._dirs != null) {
    		this._nextWall = this.getRandomPicture();
    		this._nextLock = this.getRandomPicture();
    	}
    },

    setIndicator: function(indicator) {
    	this._indicator = indicator;
    },
    
    getDirs: function() {
    	return this._dirs;
    },
    
    getNumValidImages: function() {
		let numFiles = 0;
    	for(i=0;i<this._dirs.length;i++) {
			let dir = Gio.File.new_for_path(this._dirs[i]);
			
			let fileEnum;
		 	try {
		 		fileEnum = dir.enumerate_children('standard::name,standard::type',
			                                          Gio.FileQueryInfoFlags.NONE, null);
		    } catch (e) {
		        fileEnum = null;
		    }
    	
	    	let info, child;
	        while((info = fileEnum.next_file(null)) != null) {
	        	let child = fileEnum.get_child(info);
	        	//Check if is a regular file
	        	if (info.get_file_type() == Gio.FileType.REGULAR) 
	        		//Check if file is a valid image
	        		if(/.*\.[jpg|jpeg|png]/.test(child.get_parse_name())) {
	        			numFiles++;
	        		}
	        }
    	}
    	
    	return numFiles;
    },
    
    getCurrentWall: function() {
    	let background_setting = new Gio.Settings({schema: "org.gnome.desktop.background"});
		let pathFromURI = background_setting.get_string(SETTINGS_WALLS_URI).replace(/^file:\/\//g,'');
		return new Gio.FileIcon({file: Gio.File.new_for_path(pathFromURI)});
	},

	getCurrentLockWall:function() {
		let lockbackground_setting = new Gio.Settings({schema: "org.gnome.desktop.screensaver"});
		let pathFromURI = lockbackground_setting.get_string(SETTINGS_LOCK_URI).replace(/^file:\/\//g,'');
		return new Gio.FileIcon({file: Gio.File.new_for_path(pathFromURI)});
	},
	
	getGiconFromPath: function(path) {
		return new Gio.FileIcon({file: Gio.File.new_for_path(path)});
	},
	
	getNextWall: function() {
		return new Gio.FileIcon({file: Gio.File.new_for_path(this._nextWall)});
	},
	
	getNextLockWall: function() {
		return new Gio.FileIcon({file: Gio.File.new_for_path(this._nextLock)});
	},

	setWall: function (picture) {
		let background_setting = new Gio.Settings({schema: "org.gnome.desktop.background"});
		background_setting.set_string(SETTINGS_WALLS_URI,"file://" + picture);
	},

	setLockWall: function(picture) {
		let lockbackground_setting = new Gio.Settings({schema: "org.gnome.desktop.screensaver"});
		lockbackground_setting.set_string(SETTINGS_LOCK_URI,"file://" + picture);
	},

	setNextLockWall: function(picture) {
		this._nextLock = picture;
	},
	
	setNextWall: function(picture) {
		this._nextWall = picture;
	},
	
	getRandomPicture: function() {
		//Get list of dirs with images and select one randomly
		//let listDirs = this._settings.get_strv(SETTINGS_FOLDER_LIST);
		let randDir = Math.floor((Math.random() * this._dirs.length));
		let dir = Gio.File.new_for_path(this._dirs[randDir]);
		let randPic = null;
		
	    let fileEnum;
	    try {
	        fileEnum = dir.enumerate_children('standard::name,standard::type',
	                                          Gio.FileQueryInfoFlags.NONE, null);
	    } catch (e) {
	        fileEnum = null;
	    }
	    //Make list of valid files
	    let validFiles = [];
	    if (fileEnum != null) {
	        let info, child;
	        while((info = fileEnum.next_file(null)) != null) {
	        	let child = fileEnum.get_child(info);
	        	//Check if is a regular file
	        	if (info.get_file_type() == Gio.FileType.REGULAR) 
	        		//Check if file is a valid image
	        		if(/.*\.[jpg|jpeg|png]/.test(child.get_parse_name()))
	        			validFiles.push(child.get_parse_name());
	        	
	        }
	        
	        if(validFiles.length > 0) {
	        	let randomPic = Math.floor((Math.random() * validFiles.length));             	
	        	randPic = validFiles[randomPic];
	        }
	    }
	    
	    return randPic;
	},

	changeWallpapers: function() {
		//set nextWall as currentWall
		this.setWall(this._nextWall);
		//If same_wall is true we set _nextWall as lockWall
		if(!this._settings.get_boolean(SETTINGS_SAME_WALL))
			this.setLockWall(this._nextLock);
		else
			this.setLockWall(this._nextWall);
		//Get new nextWalls
		this._nextWall = this.getRandomPicture();
		this._nextLock = this.getRandomPicture();
		//updateThumbs
		this.refreshThumbs();
	},
	
	refreshThumbs: function() {
		this._indicator.currentThumbs.setWallThumb();
		this._indicator.nextThumbs.setWallThumb();
		if(!this._settings.get_boolean(SETTINGS_SAME_WALL)) {
			this._indicator.currentThumbs.setLockThumb();
			this._indicator.nextThumbs.setLockThumb();
		}
	},
	
	setNewNextAndRefresh: function() {
		this._nextWall = this.getRandomPicture();
		this._indicator.nextThumbs.setWallThumb();
		
		if(!this._settings.get_boolean(SETTINGS_SAME_WALL)) {
			this._nextLock = this.getRandomPicture();
			this._indicator.nextThumbs.setLockThumb();
		} else {
			this._nextLock = this._nextWall;
		}
	},
	
	initValidDirs: function() {
		let validDirs = [];
		let listDirs = this._settings.get_strv(SETTINGS_FOLDER_LIST);
		if(listDirs.length > 0) {
			for(i=0;i<listDirs.length;i++) {
				let dir = Gio.File.new_for_path(listDirs[i]);
				
				let fileEnum;
			 	try {
			 		fileEnum = dir.enumerate_children('standard::name,standard::type',
				                                          Gio.FileQueryInfoFlags.NONE, null);
			    } catch (e) {
			        fileEnum = null;
			    }
			    let info, child;
			    let ok=false;
		        while(((info = fileEnum.next_file(null)) != null) && !ok ) {
		        	let child = fileEnum.get_child(info);
		        	//Check if is a regular file
		        	if (info.get_file_type() == Gio.FileType.REGULAR) 
		        		//Check if file is a valid image
		        		if(/.*\.[jpg|jpeg|png]/.test(child.get_parse_name().toLowerCase())) {
		        			ok=true;
		        			validDirs.push(listDirs[i]);
		        		}
		        }
		        
	        }
			
			if( validDirs.length > 0)
				return validDirs;
			
		}
		
		return null;
	},
	
	isEmpty: function() {
		if(this._dirs == null)
			return true;
		else
			return false;
	}
	
	
});

const getScreenAspectRatio = function() {
	return Gdk.Screen.height()/Gdk.Screen.width();
};
