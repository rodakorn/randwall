const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const ModalDialog = imports.ui.modalDialog;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Wallpapers = Me.imports.assets.wallpapers;
const Convenience = Me.imports.convenience;
const Tweener = imports.ui.tweener;
const Gettext = imports.gettext.domain('randwall');
const _ = Gettext.gettext;

const CURRENT_DESK = 0;
const CURRENT_LOCK = 1;
const NEXT_DESK = 2;
const NEXT_LOCK = 3;

const THUMB_WIDTH = 200; //Change on stylesheet.css too!!
const NUM_COLS_TABLE = 4;

let _settings=Convenience.getSettings();

const ThumbIcon = new Lang.Class({
	Name: 'ThumbIcon',
	actor: {},
	_icon: {},
	_callback: null,


	_init: function(gicon,callback) {
		this._icon = new St.Icon({
			gicon: gicon,
			icon_size: THUMB_WIDTH,
			style_class: 'wall-preview'
        });

		this.actor = new St.Button({
			child: this._icon,
			x_expand: true
		});

		this._icon.set_height(THUMB_WIDTH*Wallpapers.getScreenAspectRatio());

		this.actor.connect('clicked', Lang.bind(this,this._callback_internal));
		if (callback != undefined || callback != null){
            this._callback = callback;
        }

		this.actor.connect('enter_event',Lang.bind(this,this.start_hover));
		this.actor.connect('leave_event',Lang.bind(this,this.stop_hover));

	},

	_callback_internal: function(object){
		this.stop_hover();
		if (this._callback != undefined || this._callback != null){
			this._callback();
		}
	},

	setCallback: function(callback) {
		if (callback === undefined || callback === null || typeof callback !== "function"){
    		throw TypeError("'callback' needs to be a function.");
    	}
        this._callback = callback;
	},

	start_hover: function() {
		this._icon.set_style_class_name("wall-preview-hover");
	},

	stop_hover: function() {
		this._icon.set_style_class_name("wall-preview");
	},

	set_style: function(style) {
		this.actor.set_style(style);
	},

	set_gicon: function(icon) {
		this._icon.set_gicon(icon);
	},

	set_style_class: function(styleClass) {
		this._icon.set_style_class(styleClass);
	}
});

const PictureChooser = new Lang.Class ({
    Name: 'PictureChooser',
    Extends: ModalDialog.ModalDialog,
    _whoami: null,
    _wallUtils: null,
    _searched: false,

    _init: function(whoami,wallutils) {
    	this.parent({destroyOnClose: false});
    	this._wallUtils = wallutils;
    	this._whoami = whoami;

    	this._dialogLayout =
    		typeof this.dialogLayout === "undefined"
    		? this._dialogLayout
    		: this.dialogLayout;

    	this._dialogLayout.set_style_class_name('picture-chooser-box');
    	this._dialogLayout.connect('key_press_event', Lang.bind(this,this._on_key_press_event));
    	this._createLayout();
    },

    _on_key_press_event: function(o,e) {
    	if(e.get_key_symbol() == Clutter.KEY_Escape)
    		this.close();
    },

    _createLayout: function() {
    	//CLOSE BUTTON
    	this.contentLayout.add(this._create_close_button(), {
    		x_fill: false,
    		x_align: St.Align.END,
    		y_fill: false,
    		y_align: St.Align.START
    	});
    	//SEARCH
    	this.contentLayout.add(this._create_search_bar(),{x_fill:false});

    	//THUMBS TABLE
    	let thumbsTable = this._create_thumbs_table();
    	this.contentLayout.add(thumbsTable);

    },

    _create_search_bar: function() {
    	this._search_box = new St.BoxLayout({
    		vertical: false,
    		width: THUMB_WIDTH*2,
    		style_class: 'modal-search-bar',
    		margin_bottom: 10
		});

    	let icon = new St.Icon({
    		icon_name: 'edit-find-symbolic',
    		icon_size: 18,
    	});

    	this._search_icon = new St.Button({
    		reactive: false,
    		name: 'search-icon',
    		style_class: 'modal-search-icon',
    	});

    	this._search_icon.add_actor(icon);

    	this._search_bar = new St.Entry({
    		width: THUMB_WIDTH*2-40,
    		y_align: St.Align.MIDDLE,
    		hint_text: _("Search image"),
    		style_class: "hint-text"
		});

    	this._search_bar.clutter_text.connect('text-changed',Lang.bind(this,this.redraw));
    	this._search_bar.clutter_text.connect('key_focus_in', Lang.bind(this,function(){
    		this._search_icon.add_style_class_name("search-icon-focus");
    		this._search_box.add_style_class_name("modal-search-bar-focus");
    	}));

    	this._search_box.add(this._search_icon,{y_align: St.Align.MIDDLE});
    	this._search_box.add(this._search_bar,{y_align: St.Align.MIDDLE,y_fill: false,x_expand: true})
    	return this._search_box;
    },

    _search_file: function(){
    	this._search_bar.remove_style_class_name('hint-text');
    	let text = this._search_bar.get_text();
    	if(text.length == 0)
    		return null;
    	//set to true to know the user wrote something on the search bar
    	this._searched = true;
    	let paths = this._wallUtils.getDirs();

		let results = [];
		for(var i=0;i<paths.length;i++) {
			let path = paths[i];
			let file = Gio.File.new_for_path(path);
			let fileEnum = file.enumerate_children('standard::name',Gio.FileQueryInfoFlags.NONE, null);
			let info;
				if (fileEnum !== null) {
					while((info = fileEnum.next_file(null))) {
						let name = info.get_name();
						let nameNoExt = name.slice(0,name.lastIndexOf('.'));
						//if(name.slice(0,text.length) == text) {
						if(nameNoExt.toLowerCase().search(text.toLowerCase()) != -1) {
							let child = fileEnum.get_child(info);
							results.push(child.get_parse_name());
						}
					}
				}
    	}

    	if(!results.length)
    		return null;
    	else
    		return results;
    },

    _create_searched_thumbs_table: function(images) {
    	let scroll = new St.ScrollView({
    		style_class:'chooser-box-table',
    		name: 'thumbs-box',
		});

    	scroll.set_height(700);
    	this._super_box = new St.BoxLayout({
    		y_expand: true,
			x_expand:true,
			vertical: true
		});
    	this._super_box.set_width(THUMB_WIDTH*(NUM_COLS_TABLE+1)-35);

    	if(!images) {
    		scroll.add_actor(this._super_box);
    		return scroll;
    	}

    	let table_row = 0;
    	let table_col = 0;
    	let table;
    	for(var i=0;i<images.length;i++) {
    		if(table_col == 0)
				table = new St.BoxLayout({x_expand:true, style_class: "chooser-row-box-table"});

    		//create a icon with the current image
			let imagepath = images[i];
    		let image = new ThumbIcon(this._wallUtils.getGiconFromPath(imagepath),null);
			//set the callback
			(function(object){
				image.setCallback(function(){
					switch(object._whoami){
						case CURRENT_DESK:
							object._wallUtils.setWall(imagepath);
							break;
						case CURRENT_LOCK:
							object._wallUtils.setLockWall(imagepath);
							break;
						case NEXT_DESK:
							object._wallUtils.setNextWall(imagepath);
							break;
						case NEXT_LOCK:
							object._wallUtils.setNextLockWall(imagepath);
							break;
    				}
    				object._wallUtils.refreshThumbs();
    				object.start_close();
				});
			})(this);

			table.add(image.actor, {
				row: table_row,
				col: table_col
			});

			//set a new column
			table_col = (table_col + 1)%NUM_COLS_TABLE;
			//if we arrived at NUM_COLS_TABLE create a new row
			if(table_col == 0) {
				table_row = table_row+1;
				this._super_box.add_child(table);
			}
    	}

    	if(table_col != 0)
    		this._super_box.add_child(table);

    	scroll.add_actor(this._super_box);

    	return scroll;

    },

    _create_thumbs_table: function() {
    	let scroll = new St.ScrollView({
    		style_class:'chooser-box-table',
    		name: 'thumbs-box',
		});

    	scroll.set_height(700);
    	this._super_box = new St.BoxLayout({
    		y_expand: true,
			x_expand:true,
			vertical: true
		});
    	this._super_box.set_width(THUMB_WIDTH*(NUM_COLS_TABLE+1)-35);

    	let dirs;
    	dirs = this._wallUtils.getDirs();

    	let table_row = 0;
    	let table_col = 0;
    	let table;
    	for(var i=0;i<dirs.length;i++) {
			let dir = Gio.File.new_for_path(dirs[i]);

			let fileEnum;
		 	try {
		 		fileEnum = dir.enumerate_children('standard::name,standard::type,standard::content-type',
			                                          Gio.FileQueryInfoFlags.NONE, null);
		    } catch (e) {
		        fileEnum = null;
		    }

				if (fileEnum !== null) {
					let info, child;
					while((info = fileEnum.next_file(null)) != null) {
						let child = fileEnum.get_child(info);
						//Check if is a regular file
						if (info.get_file_type() == Gio.FileType.REGULAR)
							//Check if file is a valid image
							if(info.get_content_type().match(/^image\//i)) {
								let imagepath = child.get_parse_name();
								//For every row create a table
								if(table_col == 0)
									table = new St.BoxLayout({x_expand:true, vertical: false, style_class: "chooser-row-box-table"});
								//create a icon with the current image
								let image = new ThumbIcon(this._wallUtils.getGiconFromPath(imagepath),null);
								//set the callback
								(function(object){
									image.setCallback(function(){
										switch(object._whoami){
											case CURRENT_DESK:
												object._wallUtils.setWall(imagepath);
											break;
											case CURRENT_LOCK:
												object._wallUtils.setLockWall(imagepath);
											break;
											case NEXT_DESK:
												object._wallUtils.setNextWall(imagepath);
											break;
											case NEXT_LOCK:
												object._wallUtils.setNextLockWall(imagepath);
											break;
										}

										object._wallUtils.refreshThumbs();
										object.start_close();
									});
								})(this);

								table.add(image.actor, {
									row: table_row,
									col: table_col
								});

								//set a new column
								table_col = (table_col + 1)%NUM_COLS_TABLE;
								//if we arrived at NUM_COLS_TABLE create a new row
								if(table_col == 0) {
									table_row = table_row+1;
									this._super_box.add_child(table);
								}
							}

            if(table_col != 0)
              this._super_box.add_child(table);
					}
				}
    	}

    	scroll.add_actor(this._super_box);

    	return scroll;
    },

    _create_close_button: function() {
    	let icon = new St.Icon({
    		icon_name: 'window-close-symbolic',
    		icon_size: 20,
    		track_hover: true,
    	});

    	let button = new St.Button({
    		reactive: true,
    		style_class: 'modal-close-button',
    		track_hover: true
    	});

    	button.connect('clicked', Lang.bind(this,function(){
    		this.start_close();
    	}));

    	button.add_actor(icon);

    	return button;
    },

    _calculate_margin: function(){
    	Gdk.Screen.height();
    },

    _resize: function() {
    	let realSize = THUMB_WIDTH*(NUM_COLS_TABLE+1);

    	this._dialogLayout.set_width(realSize);
    	this._dialogLayout.set_height(800);
    },

    start_close: function() {
    	Tweener.addTween(this._dialogLayout, {opacity:0,time:0.5,transition: 'easeOutQuad', onCompleteParams:[this],onComplete: function(object){
    		object.close();
    	}});
    },

    close: function() {
    	this.parent();
    	this.destroy();
    },

    open: function() {
    	this._resize();
    	this.parent();
    },

    _remove_no_results_style: function() {
    	if(this._search_box.has_style_class_name("modal-search-bar-no-results")) {
			this._search_box.remove_style_class_name("modal-search-bar-no-results");
			this._search_icon.remove_style_class_name("search-icon-no-results ");
    	}
    },

    _add_no_results_style: function() {
    	if(!this._search_box.has_style_class_name("modal-search-bar-no-results")) {
    		this._search_box.add_style_class_name("modal-search-bar-no-results");
    		this._search_box.find_child_by_name("search-icon").add_style_class_name("search-icon-no-results");
    		this._search_icon.ensure_style();
    	}
    },

    redraw: function() {
    	let search_results = this._search_file();
    	//if we don't have any results we don't know if the user wrote something yet on the search bar
    	if(!search_results) {
    		//if we have this._searched == true it means the user wrote something and then
    		//we don't have any result
    		if(this._searched){
        		//if the text bar is empty show all images again
    			if(this._search_bar.get_text() == "") {
        			this._remove_no_results_style();
    				let new_scroll = this._create_thumbs_table();
        			this.contentLayout.replace_child(this.contentLayout.find_child_by_name('thumbs-box'),new_scroll);
        			this._searched = false;
        		} else {
        			//if it's not empty it means we didn't find any image with that name
        			//set an empty box
        			this._add_no_results_style();
        			let new_scroll = this._create_searched_thumbs_table();
        			this.contentLayout.replace_child(this.contentLayout.find_child_by_name('thumbs-box'),new_scroll);
        		}
    		}
    	} else {
    		this._remove_no_results_style();
    		let new_scroll = this._create_searched_thumbs_table(search_results);
    		this.contentLayout.replace_child(this.contentLayout.find_child_by_name('thumbs-box'),new_scroll);
    	}
    }

});


