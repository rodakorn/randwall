/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
const Config = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

let shellMajorVersion = parseInt(Config.PACKAGE_VERSION.split('.')[0]);

let RandWallSettingsWidget;

if (shellMajorVersion >= 40) {
	RandWallSettingsWidget = Me.imports.assets.settings.RandWallSettingsWidget;
} else {
	RandWallSettingsWidget = Me.imports.legacy.settings.RandWallSettingsWidget;
}

function init() {
	Convenience.initTranslations();
}

function buildPrefsWidget() {
	let widget = new RandWallSettingsWidget();

	if (shellMajorVersion < 40) {
		widget.show_all();
	}

	return widget;
}
