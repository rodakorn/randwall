const { Gio, GObject, Gtk } = imports.gi;
const Lang = imports.lang;
const Config = imports.misc.config;

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

const margins = {
  margin_top: 10,
  margin_bottom: 10,
  margin_start: 10,
  margin_end: 10
};

function horizSeparator() {
  return new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL});
}

function horizBox() {
  return new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL, spacing: 20, ...margins
  });
}

const FILE_REGEX = /^file:\/\//;

const RandWallSettingsWidget = GObject.registerClass({
  GTypeName: 'RandWallSettingsWidget',
}, class RandWallSettingsWidget extends Gtk.Box {
  
  _init(params = {}) {
    super._init();
    this.set_size_request(-1,500);
    this.set_orientation(Gtk.Orientation.VERTICAL);
    
    this._settings = Convenience.getSettings();
    this._settings.connect('changed', Lang.bind(this, this._refresh));
    this._changedPermitted = false;
    
    this._store = new Gtk.ListStore();
    this._store.set_column_types([GObject.TYPE_STRING]);
    //Change Mode
    this.append(horizSeparator());
    
    let gHBoxMode = horizBox();
    
    gHBoxMode.append(new Gtk.Label({
      label: _("Change mode"), halign: 1,
    }));
    
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
    
    let grid = new Gtk.Grid({
      orientation: Gtk.Orientation.VERTICAL, row_spacing: 6, column_spacing: 6,
      margin_top: 6, margin_start: 20 
    });
    
    for (let i = 0; i < modes.length; i++) {
      let mode = modes[i];
      let label = modeLabels[mode];
      
      if (!label) {
        log('Unhandled option "%s" for lock-mode'.format(mode));
        continue;
      }
      
      radio = new Gtk.ToggleButton({
        active: currentMode == mode, label: label, group: radio
      });
      
      grid.attach(radio, 0, i, 1, 1);
      
      if (currentMode === mode) {
        radio.set_active(true);
      }
      
      radio.connect('toggled', Lang.bind(this, function(button) {
        if (button.active)
        this._settings.set_string(SETTINGS_CHANGE_MODE, mode);
      }));
    }
    
    gHBoxMode.append(grid);
    
    this.append(gHBoxMode);
    this.append(horizSeparator());
    
    //Hide Icon
    let gHBoxHideIcon = horizBox();
    
    gHBoxHideIcon.append(new Gtk.Label({
      halign: 1, hexpand: true, label: _("Hide Icon")
    }));
    
    let iconSwitch = new Gtk.Switch({
      active: this._settings.get_boolean(SETTINGS_HIDE_ICON),
    });
    
    gHBoxHideIcon.append(iconSwitch);
    
    this.append(gHBoxHideIcon);
    this.append(horizSeparator());
    
    this._settings.bind(SETTINGS_HIDE_ICON, iconSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    
    //Change time
    let gHBoxTimer = horizBox();
    
    let gLabelTimer = new Gtk.Label({
      label: _("Interval (in minutes)"), halign: 1, hexpand: true
    });
    gHBoxTimer.append(gLabelTimer);
    
    this._interval = Gtk.SpinButton.new_with_range(0, 3000, 1);
    gHBoxTimer.append(this._interval);
    this._settings.bind(SETTINGS_CHANGE_TIME, this._interval, 'value', Gio.SettingsBindFlags.DEFAULT);

    // this._interval.connect('changed',Lang.bind(this,this._changeInterval));
    this.append(gHBoxTimer);
    
    //Scroll list
    let scrolled = new Gtk.ScrolledWindow();
    scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
    this.append(scrolled);
    
    //Folder tree view
    this._treeView = new Gtk.TreeView({
      model: this._store, hexpand: true, vexpand: true
    });
    this._treeView.get_selection().set_mode(Gtk.SelectionMode.SINGLE);
    
    let folderColumn = new Gtk.TreeViewColumn({
      expand: true, sort_column_id: Columns.FOLDER_NAME, title: _("Image Folders")
    });  

    let nameRenderer = new Gtk.CellRendererText;
    folderColumn.pack_start(nameRenderer,true);
    folderColumn.add_attribute(nameRenderer,"text",Columns.FOLDER_NAME);
    this._treeView.append_column(folderColumn);
    scrolled.set_child(this._treeView);
    
    //Toolbar
    let toolbar = horizBox();
    this.append(toolbar);
    
    let newButtonBox = horizBox();
    newButtonBox.append(new Gtk.Label({ label: _("Add Folder") }));
    newButtonBox.append(new Gtk.Image({ icon_name: "bookmark-new-symbolic" }));

    //add Button
    this._newButton = new Gtk.Button();
    this._newButton.set_child(newButtonBox);
    
    
    this._newButton.connect('clicked',Lang.bind(this,this._createFolderDialog));
    toolbar.append(this._newButton);
    
    //delete button
    let delButton = new Gtk.Button({ icon_name: 'edit-delete-symbolic'  });
    delButton.connect('clicked',Lang.bind(this, this._deleteSelected));
    toolbar.append(delButton);
    
    let selection = this._treeView.get_selection();
    selection.connect('changed', function(){
      delButton.sensitive = selection.count_selected_rows() > 0;
    });
    delButton.sensitive = selection.count_selected_rows() > 0;
    
    let currentInterval = this._settings.get_int(SETTINGS_CHANGE_TIME);
    this._interval.set_value(currentInterval);
    
    this._changedPermitted = true;
    this._refresh();
  }
  
  
  _createFolderDialog() {
    let folderDialog = new Gtk.FileChooserNative({
      title: _("Select a folder"),
      modal: true,
      action: Gtk.FileChooserAction.SELECT_FOLDER
    });

    folderDialog.set_transient_for(this._newButton.get_root());
    
    folderDialog.connect('response', Lang.bind(this,function(dialog,id){
      log(id);
      if(id != Gtk.ResponseType.ACCEPT){
        dialog.destroy();
      } else {
        let filename = dialog.get_file().get_uri().replace(FILE_REGEX, "");

        let items = this._settings.get_strv(SETTINGS_FOLDER_LIST);
        let exists = items.indexOf(filename);
        if (exists == -1 ) {
          items.push(filename);
          this._settings.set_strv(SETTINGS_FOLDER_LIST, items);
        }
        dialog.destroy();
      }
    }));
    
    folderDialog.show();
  }
  
  _deleteSelected() {
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
    
  }
  
  _refresh() {
    if(!this._changedPermitted)
      return;
    
    this._store.clear();
    let currentItems = this._settings.get_strv(SETTINGS_FOLDER_LIST);
    for (var i = 0; i < currentItems.length; i++) {
      let iter = this._store.append();
      this._store.set(iter,[Columns.FOLDER_NAME],[currentItems[i]]);
    }
  }      
});