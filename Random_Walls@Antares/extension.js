const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Main = imports.ui.main;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const GLib = imports.gi.GLib;
const Convenience = Me.imports.convenience;
const Interval = Me.imports.assets.timeout;
const Wallpapers = Me.imports.assets.wallpapers;
const MyConfig = Me.imports.prefs;
const Lang = imports.lang;
const Tweener = imports.ui.tweener;
const Shell = imports.gi.Shell;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Gettext = imports.gettext.domain('randwall');
const _ = Gettext.gettext;

const SETTINGS_SAME_WALL = "same-wall";
const SETTINGS_FOLDER_LIST = "folder-list";

const THUMB_WIDTH = 200; //Change on stylesheet.css too!!

let metadata = Me.metadata;
let settings;
let MyTimer;
let wallUtils;

const LabelWidget = new Lang.Class({
    Name: "LabelWidget",
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(text,type){
        this.parent({
            reactive: false
        });

        this._label = new St.Label({
            text: text,
            style_class: "labels"
        });
        //Add type to stylesheet.css if you want different styles
        this._label.add_style_class_name(type);
        
        this.actor.add_child(this._label);
    },

    setText: function(text){
        this._label.text = text;
    }
});

const ControlButton = new Lang.Class({
    Name: 'ControlButton',
    actor: {},

    _init: function(icon, callback){
        this.icon = new St.Icon({
            icon_name: icon + "-symbolic", // Get the symbol-icons.
            icon_size: 20
        });

        this.actor = new St.Button({
            style_class: 'notification-icon-button control-button', // buttons styled like in Rhythmbox-notifications
            child: this.icon
        });
        this.icon.set_style('padding: 0px');
        this.actor.set_style('padding: 8px'); // Put less space between buttons

        if (callback != undefined || callback != null){
            this.actor.connect('clicked', callback);
        }
    },

    setIcon: function(icon){
        this.icon.icon_name = icon+'-symbolic';
    }
});

const ConfigControls = new Lang.Class({
	Name: "ConfigControls",
	Extends: PopupMenu.PopupBaseMenuItem,
		
	_init: function() {
		
		this.parent({
			reactive: false
		});
		
		this.box = new St.BoxLayout({
			style_class: "controls",
		});
					
		this.actor.add(this.box,{expand:true});
		this.box.add_actor(new ControlButton("list-add",this._openConfigWidget).actor );
		
	},
	
	_openConfigWidget: function() {
		let _appSys = Shell.AppSystem.get_default();
		let _gsmPrefs = _appSys.lookup_app('gnome-shell-extension-prefs.desktop');
        if (_gsmPrefs.get_state() == _gsmPrefs.SHELL_APP_STATE_RUNNING){
            _gsmPrefs.activate();
        } else {
            let info = _gsmPrefs.get_app_info();
            let timestamp = global.display.get_current_time_roundtrip();
            info.launch_uris([metadata.uuid], global.create_app_launch_context(timestamp, -1));
        }
	}
	
});

const NextWallControls = new Lang.Class({
	Name: "NextWallControls",
	Extends: PopupMenu.PopupBaseMenuItem,
		
	_init: function() {
		
		this.parent({
			reactive: false
		});
		
		this.box = new St.BoxLayout({
			style_class: "controls",
		});
		
		if(!_settings.get_boolean(SETTINGS_SAME_WALL)) {
			this.box.set_style("padding-left: " + (THUMB_WIDTH - 30) + "px;");
		} else
			this.box.set_style("padding-left: " + ((THUMB_WIDTH / 2) - 36) + "px;"); //36 = button_size*2 + padding*2
			
		this.actor.add(this.box,{expand:true});
		this.box.add_actor(new ControlButton("media-playback-start",this._changeWalls ).actor );
		this.box.add_actor(new ControlButton("media-playlist-shuffle", this._newNextWalls).actor );
		
	},

	_changeWalls: function() {
		if(wallUtils != null)
			wallUtils.changeWallpapers();
	},
	
	_newNextWalls: function() {
		if(wallUtils != null)
			wallUtils.setNewNextAndRefresh();
	}
	
});

const thumbPreviews = new Lang.Class({
	Name: 'thumbPreviews',
	Extends: PopupMenu.PopupBaseMenuItem,

	_isNextThumbs: false,
	
	_init: function(isNextThumbs) {
		this.parent();
		this._isNextThumbs = isNextThumbs;
		//Main Box
		let MainBox = new St.BoxLayout({vertical: false});
		//Label + Icon Desktop Wallpaper Box
		let desktopBox = new St.BoxLayout({vertical: true});
		let textLabel = (!_settings.get_boolean(SETTINGS_SAME_WALL))?_("Desktop"):_("Desktop & Lockscreen");
		let desktopLabel = new St.Label({text: textLabel});
		desktopBox.add_child(desktopLabel);
		let filewall = wallUtils.getCurrentWall();
		this.wallIcon = new St.Icon({gicon: filewall, icon_size: THUMB_WIDTH, style_class: 'wall-preview'}); 
		let thumbHeight = THUMB_WIDTH*wallUtils.getScreenAspectRatio();
		this.wallIcon.set_style("height:" + thumbHeight + "px;");
		desktopBox.add_child(this.wallIcon);
		MainBox.add_child(desktopBox);
		
		if(!_settings.get_boolean(SETTINGS_SAME_WALL)) {
			//Label + Lockscreen Wallpaper Box
			let lockBox = new St.BoxLayout({vertical: true});
			let lockLabel = new St.Label({text: _("Lockscreen")});
			lockBox.add_child(lockLabel);
			let lockwall = wallUtils.getCurrentLockWall();
			this.lockIcon = new St.Icon({gicon: lockwall,icon_size: THUMB_WIDTH, style_class: 'wall-preview'});
			this.lockIcon.set_style("height:" + thumbHeight + "px;");
			lockBox.add_child(this.lockIcon);
			MainBox.add_child(lockBox);
		}
		
		this.actor.add_actor(MainBox);
	},
	
	setWallThumb: function() {
		let newIcon = null;
		if(this._isNextThumbs)
			newIcon = wallUtils.getNextWall();
		else
			newIcon = wallUtils.getCurrentWall();
		Tweener.addTween(this.wallIcon, {opacity:0,time:1,transition: 'easeOutQuad',onCompleteParams:[this.wallIcon,newIcon], onComplete:function(thumb,icon){
			thumb.set_gicon(icon);
		}});
		Tweener.addTween(this.wallIcon, {opacity:255,delay:1.3, time:1,transition: 'easeOutQuad'});
	}, 

	
	setLockThumb: function() {
		let lockIcon = null;
		if(this._isNextThumbs)
			lockIcon = wallUtils.getNextLockWall();
		else
			lockIcon = wallUtils.getCurrentLockWall();
		Tweener.addTween(this.lockIcon, {opacity:0,time:1,transition: 'easeOutQuad', onCompleteParams:[this.lockIcon,lockIcon], onComplete:function(thumb,icon){
			thumb.set_gicon(icon);
		}});
		Tweener.addTween(this.lockIcon, {opacity:255,delay:1.3, time:1,transition: 'easeOutQuad'});
	},
	

});

const RandWallMenu = new Lang.Class({
	Name: 'RandWallMenu.RandWallMenu',
	Extends: PanelMenu.Button,
	
	_init: function() {
		this.parent(0.0,"randwall");
		let hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
		let icon = new St.Icon({style_class: 'randwall-icon'});
		hbox.add_child(icon);
		hbox.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
        this.actor.add_actor(hbox);

        if(!wallUtils.isEmpty()) {
	        //Label current wallpapers
	        this.menu.addMenuItem(new LabelWidget(_("CURRENT"),"info"));
	        // Current Walls thumbs
	        this.currentThumbs = new thumbPreviews(false);
	        this.menu.addMenuItem(this.currentThumbs);
	        // Separator 
	        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	        //Label current wallpapers
	        this.menu.addMenuItem(new LabelWidget(_("NEXT"),"info"));
	        // Next Walls thumbs
	        this.nextThumbs = new thumbPreviews(true);
	        this.menu.addMenuItem(this.nextThumbs);
	        // Separator 
	        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	        //Controles
	        let control = new NextWallControls();
	        this.menu.addMenuItem(control);
        } else {
        	this.menu.addMenuItem(new LabelWidget(_("No images found!"),"error"));
        	this.menu.addMenuItem(new LabelWidget(_("Please, add some folders with images"),"info"));
        	this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        	this.menu.addMenuItem(new ConfigControls());
        }
        
        
	},
	
	destroy: function() {
		this.parent();
	},
	
	_changeBackgrounds: function() {
		wallUtils.changeWallpapers();
    	//update thumbs
		this.refreshThumbs();
	}
	
});


function init() {
	_settings=Convenience.getSettings();
	Convenience.initTranslations();
    wallUtils = new Wallpapers.WallUtils(_settings);
    if(!wallUtils.isEmpty()) {
    	this.MyTimer = new Interval.MyTimer();
    	this.MyTimer.setCallback(function() {
    		wallUtils.changeWallpapers();
    	//	WARNING! Without the return true the timer will stop after the first run 
    		return true;
    	});
    }
}

let _indicator;
let _settings;

function enable() {
	_indicator = new RandWallMenu(_settings);
	wallUtils.setIndicator(_indicator);
	if(!wallUtils.isEmpty()) {
		wallUtils.changeWallpapers();
		this.MyTimer.start();
	}
	Main.panel.addToStatusArea('randwall',_indicator,1,'right');
	_settings.connect('changed::' + SETTINGS_SAME_WALL,Lang.bind(this,applyChanges));
	_settings.connect('changed::' + SETTINGS_FOLDER_LIST,Lang.bind(this,applyChanges));
}

function applyChanges() {
	if(!_indicator || !wallUtils || !_settings)
		return;
	
	_indicator.destroy();
	wallUtils = new Wallpapers.WallUtils(_settings);
	_indicator = new RandWallMenu(_settings);
	wallUtils.setIndicator(_indicator);
	Main.panel.addToStatusArea('randwall',_indicator,1,'right');
	wallUtils.setNewNextAndRefresh();
}

function disable() {
	_indicator.destroy();
	this.MyTimer.stop();
}
