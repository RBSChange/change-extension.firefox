var serverHistory = [];

function onPrefsLoad() {
	loadServerHistory();
	document.getElementById('urlhistory').addEventListener("keypress",
			checkKey, false);
	for (var i = 0; i < serverHistory.length; i++) {
		var li = document.createElement('listitem');
		li.setAttribute('hstidx', i.toString());

		var cell = document.createElement('listcell');
		var img = cell.appendChild(document.createElement('image'));
		img.setAttribute('width', '16');
		img.setAttribute('height', '16');
		li.appendChild(cell);

		cell = document.createElement('listcell');
		cell.setAttribute('label', serverHistory[i].url);
		li.appendChild(cell);
		document.getElementById('urlhistory').appendChild(li);
	}

	var startMode = ChangeToolKit.getPreferencesService()
			.getCharPref('rbschange.ext.startmode');
	if (startMode != 'event') {
		document.getElementById('admindetection').checked = false;
	} else {
		document.getElementById('admindetection').checked = true;
	}
}

function doSave() {
	saveHistory();
	if (document.getElementById('admindetection').checked) {
		ChangeToolKit.getPreferencesService().setCharPref(
				'rbschange.ext.startmode', 'event');
	} else {
		ChangeToolKit.getPreferencesService().setCharPref(
				'rbschange.ext.startmode', 'all');
	}
}

function doCancel() {
	return true;
}

function onDeleteAll() {
	try {
		var lst = document.getElementById('urlhistory');
		var length = lst.getRowCount();
		for (var i = 0; i < length; i++) {
			lst.removeItemAt(0);
		}

		for (var i = 0; i < serverHistory.length; i++) {
			serverHistory[i].deleted = true;
		}
	} catch (e) {
		ChangeToolKit.debug(e);
	}
}

function onCheckAll() {
	try {
		var navVersion = ChangeToolKit.getNavigatorVersion();
		
		var lst = document.getElementById('urlhistory');
		var length = lst.getRowCount();
		for (var i = 0; i < length; i++) {
			var item = lst.getItemAtIndex(i);
			var hstidx = parseInt(item.getAttribute('hstidx'));
			var identifier = serverHistory[hstidx];
			var img = checkBrowsersCompatibility(identifier.url, navVersion);
			ChangeToolKit.debug('onCheckAll ' + identifier.url + ':' + img);
			item.firstChild.firstChild.src = img;
		}
	} catch (e) {
		ChangeToolKit.debug(e);
	}
}

function checkBrowsersCompatibility(url, navVersion) {
	var testUrl = url
			+ '/xchrome_controller.php?module=uixul&action=GetBrowsersCompatibility&ct='
			+ new Date().getTime();
	var result = ChangeToolKit.getJSObject(testUrl, {});
	if (result != null) {
		var versions = result.contents;
		if (versions != null && versions.backoffice != null
				&& versions.backoffice.firefox != null
				&& versions.backoffice.firefox.length != null) {
			var lastversion = '';
			for (var i = 0; i < versions.backoffice.firefox.length; i++) {
				lastversion = versions.backoffice.firefox[i];
				if (lastversion == navVersion) {
					return 'chrome://rbschange/skin/change_17.png';
				}
			}
			return 'chrome://global/skin/icons/warning-16.png';
		} else {
			return 'chrome://global/skin/icons/error-16.png';
		}
	} else {
		return 'chrome://global/skin/icons/error-16.png';
	}
}

function onDeleteSelected() {
	// Delete Back
	var deleted = [];
	var lst = document.getElementById('urlhistory');
	if (lst.selectedItems.length > 0) {
		for (var i = 0; i < lst.selectedItems.length; i++) {
			var item = lst.selectedItems[i];
			if (item.hasAttribute('hstidx')) {
				deleted.push(item);
			}
		}
	}
	if (deleted.length > 0) {
		for (var i = 0; i < deleted.length; i++) {
			var idx = parseInt(deleted[i].getAttribute('hstidx'));
			serverHistory[idx].deleted = true;
			lst.removeChild(deleted[i]);
		}
	}
}

function checkKey(event) {
	if (event.keyCode == 46 || event.keyCode == 8) {
		onDeleteSelected();
	} else if (event.ctrlKey && (event.charCode == 97 || event.charCode == 65)) {
		// Ctrl + a
		var lst = document.getElementById('urlhistory');
		lst.selectAll();
	}
}

function loadServerHistory() {
	ChangeToolKit.debug('loadServerHistory');
	var entries = ChangeToolKit.getRegisteredSitesHistory();
	ChangeToolKit.orderHistoryByURL(entries);
	for (var i = 0; i < entries.length; i++) {
		var history = entries[i];
		history.xpath = history.pId;
		history.uilang = history.lang;
		history.deleted = false;

	}
	serverHistory = entries;
}

function saveHistory() {
	if (serverHistory.length == 0) {
		return;
	}
	for (var i = 0; i < serverHistory.length; i++) 
	{
		var h = serverHistory[i];
		if (h.deleted)
		{
			ChangeManager.unregister(h.xpath);
		}
	}
	serverHistory = [];
}