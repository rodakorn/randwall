/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Lang = imports.lang;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Gettext = imports.gettext.domain('randwall');
const _ = Gettext.gettext;

const Columns = {
	FOLDER_NAME : 0
};

const SETTINGS_FOLDER_LIST = 'folder-list';
const SETTINGS_CHANGE_TIME = "change-time";
const SETTINGS_CHANGE_MODE = "change-mode";
const SETTINGS_HIDE_ICON = "hide-icon";

/*const SettingsWidget = new GObject.Class({
	Name: "SettingsWidget",
	Extends: Gtk.Widget,
	
	_init: function(params) {
		this.parent(params);
		this.grid = new RandWallSettingsWidget();
		this.add(this.grid);
	}
	
});*/

const RandWallSettingsWidget = new GObject.Class({
    Name: 'RandWall.prefs.RandWallSettingsWidget',
    GTypeName: 'RandWallSettingsWidget',
    Extends: Gtk.Grid,

    _init : function(params) {
        this.parent(params);
		this.set_size_request(-1,500);
        this.set_orientation(Gtk.Orientation.VERTICAL);
	
		this._settings = Convenience.getSettings();
		this._settings.connect('changed', Lang.bind(this, this._refresh));
		this._changedPermitted = false;

		this._store = new Gtk.ListStore();
		this._store.set_column_types([GObject.TYPE_STRING]);
		//Change Mode
		this.add(new Gtk.HSeparator());
		this.add(new Gtk.Label({label: _("Change mode"),halign: Gtk.Align.START, margin: 10}));
		let modeLabels = {
	            'different': _("Change both desktop and lockscreen"),
	            'same': _("Change desktop and lockscreen using the same image"),
	            'desktop': _("Change only desktop wallpaper"),
	            'lockscreen': _("Change only Lockscreen wallpaper")
        };
		let radio = null;
		let range = this._settings.get_range(SETTINGS_CHANGE_MODE);
		let currentMode = this._settings.get_string(SETTINGS_CHANGE_MODE);
		let modes = range.deep_unpack()[1].deep_unpack();
		let grid = new Gtk.Grid({ orientation: Gtk.Orientation.VERTICAL,row_spacing: 6,column_spacing: 6,margin_top: 6, margin_left: 20 });
		for (var i = 0; i < modes.length; i++) {
            let mode = modes[i];
            let label = modeLabels[mode];
            if (!label) {
               log('Unhandled option "%s" for lock-mode'.format(mode));
               continue;
            }

            radio = new Gtk.RadioButton({ active: currentMode == mode,
                                          label: label,
                                          group: radio });
            grid.add(radio);
            radio.connect('toggled', Lang.bind(this, function(button) {
                if (button.active)
                    this._settings.set_string(SETTINGS_CHANGE_MODE, mode);
            }));

        }
		
		this.add(grid);
		this.add(new Gtk.HSeparator());
		
		//Hide Icon
		let gHBoxHideIcon = new Gtk.HBox({margin:10, spacing: 20, hexpand: true});
		gHBoxHideIcon.add(new Gtk.Label({label: _("Hide Icon"),halign: Gtk.Align.START, margin: 10}));
		let iconSwitch = new Gtk.Switch({halign: Gtk.Align.END});
		gHBoxHideIcon.add(iconSwitch);
		this.add(gHBoxHideIcon);
		this.add(new Gtk.HSeparator());
		this._settings.bind(SETTINGS_HIDE_ICON, iconSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
		
		//Change time
		let gHBoxTimer = new Gtk.HBox({margin:10, spacing: 20, hexpand: true});
		let gLabelTimer = new Gtk.Label({label: _("Interval (in minutes)"),halign: Gtk.Align.START});
		gHBoxTimer.add(gLabelTimer);
		this._interval =  Gtk.SpinButton.new_with_range (0, 3000, 1);
		gHBoxTimer.add(this._interval);
		this._interval.connect('changed',Lang.bind(this,this._changeInterval));
		this.add(gHBoxTimer);
			
		//Scroll list
	    let scrolled = new Gtk.ScrolledWindow({ shadow_type: Gtk.ShadowType.IN});
	    scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
	    this.add(scrolled);
	    
	    //Folder tree view
		this._treeView = new Gtk.TreeView({ model: this._store, hexpand: true, vexpand: true });
		this._treeView.get_selection().set_mode(Gtk.SelectionMode.SINGLE);
	
		let folderColumn = new Gtk.TreeViewColumn({ expand: true, sort_column_id: Columns.FOLDER_NAME, title: _("Image Folders") });  
		let nameRenderer = new Gtk.CellRendererText;
		folderColumn.pack_start(nameRenderer,true);
		folderColumn.add_attribute(nameRenderer,"text",Columns.FOLDER_NAME);
		this._treeView.append_column(folderColumn);
		scrolled.add(this._treeView);
		
		//Toolbar
		let toolbar = new Gtk.Toolbar({ icon_size: Gtk.IconSize.SMALL_TOOLBAR });
		toolbar.get_style_context().add_class(Gtk.STYLE_CLASS_INLINE_TOOLBAR);
		this.add(toolbar);
		
		//add Button
		let newButton = new Gtk.ToolButton({ icon_name: 'bookmark-new-symbolic',
            								label: _("Add Folder"),
            								is_important: true });
			
		
		newButton.connect('clicked',Lang.bind(this,this._createFolderDialog));
		toolbar.add(newButton);
		//delete button
		let delButton = new Gtk.ToolButton({ icon_name: 'edit-delete-symbolic'  });
		delButton.connect('clicked',Lang.bind(this, this._deleteSelected));
		toolbar.add(delButton);
		
		let selection = this._treeView.get_selection();
		selection.connect('changed', function(){
				delButton.sensitive = selection.count_selected_rows() > 0;
			});
		delButton.sensitive = selection.count_selected_rows() > 0;
		
		
        this._changedPermitted = true;
        this._refresh();


    },
    
  
    _createFolderDialog: function() {
    	let folderDialog = new Gtk.FileChooserDialog({	title: _("Select a folder"),
    													modal: true,
    													action: Gtk.FileChooserAction.SELECT_FOLDER });
    	folderDialog.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
    	folderDialog.add_button(Gtk.STOCK_ADD, Gtk.ResponseType.OK);
    	
    	folderDialog.connect('response', Lang.bind(this,function(dialog,id){
    		if(id != Gtk.ResponseType.OK){
				dialog.destroy();
			} else {
				let items = this._settings.get_strv(SETTINGS_FOLDER_LIST);
				let exists = items.indexOf(dialog.get_filename());
				if (exists == -1 ) {
					items.push(dialog.get_filename());
					this._settings.set_strv(SETTINGS_FOLDER_LIST, items);
				}
				dialog.destroy();
			}
			
    	}));
    	
    	folderDialog.run();
    },
    
    _deleteSelected: function() {
    	let [any, model, iter] = this._treeView.get_selection().get_selected();
    	if (any) {
    		let folderName = this._store.get_value(iter,Columns.FOLDER_NAME);
    		this._changedPermitted = false;
    		let currentItems = this._settings.get_strv(SETTINGS_FOLDER_LIST);
    		let index = currentItems.indexOf(folderName);
    		if(index < 0) {
    			return;
    		}
    		currentItems.splice(index,1);
    		this._settings.set_strv(SETTINGS_FOLDER_LIST, currentItems);
    		this._changedPermitted = true;
    		this._store.remove(iter);
    		this._refresh;
    	} 
    		
    },
    
    _changeInterval: function() {
    	let currentValue = this._interval.get_value();
    	//this._spawn_sync(Me.path + "/scripts/", ["randwallcron", Me.path], null);
    	this._settings.set_int(SETTINGS_CHANGE_TIME,currentValue);
    },

    _refresh: function() {
    	if(!this._changedPermitted)
    		return;
    	
    	let currentInterval = this._settings.get_int(SETTINGS_CHANGE_TIME);
    	this._interval.set_value(currentInterval);
    	
    	this._store.clear();
    	let currentItems = this._settings.get_strv(SETTINGS_FOLDER_LIST);
    	for (var i = 0; i < currentItems.length; i++) {
    		let iter = this._store.append();
    		this._store.set(iter,[Columns.FOLDER_NAME],[currentItems[i]]);
    	}
    }    
    
});

function init() {
	Convenience.initTranslations();
}

function buildPrefsWidget() {
	let widget = new RandWallSettingsWidget({ margin: 12 });
	widget.show_all();

	return widget;
}
