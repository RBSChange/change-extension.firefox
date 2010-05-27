var serverHistory = [];
var checkedUrl = null;

function onLoginLoad()
{
	ChangeToolKit.debug('onLoginLoad');
	loadServerHistory();
	
	for (var i = 0; i < serverHistory.length; i++)
	{
		var mi = document.createElement('menuitem');
		mi.setAttribute('label', serverHistory[i].url);
		mi.addEventListener("command", updateUrl, false);
		document.getElementById('urlhistory').appendChild(mi);
	}
	
	var identifier = window.arguments[0];
	if (identifier.autoconnect)
	{
		document.getElementById('url').value = identifier.autoconnect;
	}
	else
	{
		var entry = ChangeToolKit.getLastLoginRegisteredSite();
		if (entry !== null)
		{
			document.getElementById('url').value = entry.url;
		}
		else
		{
			document.getElementById('url').value = '';
		}
	}
	updateUrl(null);
}

function openHistory()
{
	window.openDialog('chrome://rbschange/content/prefs.xul', 'prefs', 'modal,chrome,extrachrome,resizable');
	try
	{
		loadServerHistory();
		var urlhistory = document.getElementById('urlhistory');
		var menuitems = urlhistory.getElementsByTagName('menuitem');
		
		var lstItems = [];
		for (var i = 0; i < menuitems.length; i++)
		{
			lstItems.push(menuitems[i]);
		}
		
		var menuitem = null;
		for (var i = 0; i < lstItems.length; i++)
		{
			menuitem = lstItems[i];
			if (getInHistory(menuitem.label) == null)
			{
				menuitem.parentNode.removeChild(menuitem);
			}
		}
		
		var currentURL = document.getElementById('url').value;
		if (currentURL != '' && getInHistory(currentURL) == null)
		{
			document.getElementById('url').value = ''
			document.getElementById('browserCompatibility').value = '';
			if (!document.getElementById('persistidentity').checked)
			{
				document.getElementById('password').value = '';
				document.getElementById('login').value =  '';
			}
		}
	}
	catch (e)
	{
		ChangeToolKit.debug(e);
	}	
}

function checkBrowsersCompatibility(url)
{
	if (url == checkedUrl) {return;}
	checkedUrl = url;
	
	var msg = document.getElementById('error_versionchecking').value;
	document.getElementById('browserCompatibility').value = msg;
	
	var testUrl = url + '/xchrome_controller.php?module=uixul&action=GetBrowsersCompatibility&ct=' + new Date().getTime();
	var result = ChangeToolKit.getJSObject(testUrl, {});
	if (result != null)
	{
		var checked = false;
		var navVersion = ChangeToolKit.getNavigatorVersion();		
		var versions = result.contents;
		if (versions != null && versions.backoffice != null 
			&& versions.backoffice.firefox != null 
			&& versions.backoffice.firefox.length != null)
		{
			var lastversion = '';
			for (var i= 0; i < versions.backoffice.firefox.length; i++)
			{
				lastversion = versions.backoffice.firefox[i];
				if (lastversion == navVersion)
				{
					checked = true;
					break;
				}
			}
			if (!checked)
			{
				var msg = document.getElementById('error_wrongversion').value;
				msg = msg.replace(/navversion/, navVersion).replace(/lastversion/, lastversion);
				document.getElementById('browserCompatibility').value = msg;
			}
			else
			{
				document.getElementById('browserCompatibility').value = '';
			}
			
			if (versions.uiprotocol)
			{
				checkedUrl = url.replace(/^https?:/, versions.uiprotocol + ':');
				if (checkedUrl !== url)
				{
					document.getElementById('url').value = checkedUrl;
				}
			}
			
			if (versions.firstlogin)
			{
				document.getElementById('connexiontype').selectedIndex = 1;
				document.getElementById('adminlogin').value = versions.firstlogin;
			}
			else
			{
				document.getElementById('connexiontype').selectedIndex = 0;
			}
			
			if (versions.uilangs)
			{
				updateUILang(versions.uilangs);
				
			}
			else
			{
				updateUILang(null);
			}
			
		}
		else
		{
			var msg = document.getElementById('error_unknowversion').value;
			document.getElementById('browserCompatibility').value = msg;
			document.getElementById('connexiontype').selectedIndex = 0;
			updateUILang(null);
		}
	}
	else
	{
		var msg = document.getElementById('error_unknowversion').value;
		document.getElementById('browserCompatibility').value = msg;
		document.getElementById('connexiontype').selectedIndex = 0;
		updateUILang(null);
		return false;
	}
}

function updateUILang(langs)
{
	var uilangmenu = document.getElementById('uilang');
	uilangmenu.removeAllItems();
	if (langs === null || langs.length == 0)
	{
		document.getElementById('uilangselector').collapsed = true;
	}
	else
	{
		for(var i = 0; i < langs.length; i++)
		{
			var lang = langs[i];
			uilangmenu.appendItem(lang.toUpperCase(), lang);
		}
		document.getElementById('uilangselector').collapsed = false;
	}
}

function updateUrl(event)
{
	var newUrl = document.getElementById('url').value;
	ChangeToolKit.debug('updateUrl: ' + newUrl);
	var info = null;
	
	if (newUrl !== null && newUrl !== '')
	{
		checkBrowsersCompatibility(newUrl);
		info = getInHistory(newUrl);
		if (info != null)
		{
			document.getElementById('login').value =  info.login;
			onLoginUpdated();
			if (info.uilang.length > 0)
			{
				document.getElementById('uilang').value = info.uilang;
			}
			return;
		}
	}
	
	if (info == null || !document.getElementById('persistidentity').checked)
	{
		document.getElementById('password').value = '';
		document.getElementById('login').value =  '';
	}
}


function onLoginUpdated()
{
	ChangeToolKit.debug('onLoginUpdated');
	var password = '';
	if (document.getElementById('persistidentity').checked)
	{
		var login = document.getElementById('login').value;
		if (login.length > 0)
		{
			var info = getInHistory(checkedUrl);
			if (info != null)
			{
				password = ChangeToolKit.getLoginPassword(info.xpath, login);
			}
		}
	}
	var btn = document.getElementById('openConsole');
	btn.hidden = true;
	btn.identifier = null;
	
	if (password !== '')
	{
		var OAuth = ChangeToolKit.getStoredOAuthInfo(info.xpath, login);
		if (OAuth !== null)
		{
			btn.identifier = OAuth;
			btn.identifier.URL = checkedUrl;
			btn.hidden = false;
		}
	}	
	document.getElementById('password').value = password;
}

function onResetPassword()
{
	var login = document.getElementById('login').value;
	var url = cleanUrl(document.getElementById('url').value);
	if (login != '' && url != '')
	{
		var paramsObject = {login: login};
		var logUrl = url + '/xchrome_controller.php?module=users&action=ResetPassword&ct=' + new Date().getTime();
		var b = ChangeToolKit.getJSObject(logUrl, paramsObject);
		if (b != null && b.status != null)
		{
			if (b.status == 'OK')
			{
				alert(b.contents.message);
				document.getElementById('resetpassword').setAttribute('disabled', 'true');
			}
			else
			{
				alert(b.contents.errorMessage);
			}
		}
		else
		{
			var msg = document.getElementById('error_servernotfound').value + url;
			alert(msg);
		}
	}
}

function onOpenConsole()
{
	var btn = document.getElementById('openConsole');
	if (btn.identifier)
	{
		window.opener.onOpenWebConsole(btn.identifier);
	}
}

function doSave()
{ 
	if (document.getElementById('connexiontype').selectedIndex == 0)
	{
		return doLogin();
	}
	else
	{
		return doFirstLogin();
	}
}

function doLogin()
{
	var identifier = window.arguments[0];
	identifier.login = document.getElementById('login').value;
	identifier.password = document.getElementById('password').value;
	identifier.uilang = document.getElementById('uilangselector').collapsed ? '' : document.getElementById('uilang').value;
	
	var originalUrl = document.getElementById('url').value;
	var url = cleanUrl(originalUrl);
	if (url != '')
	{
		checkBrowsersCompatibility(url);
		
		url = checkedUrl;
		identifier.uri = url + '/xchrome_controller.php';
	}
	else
	{
		var msg = document.getElementById('error_invalidurl').value;
		alert(msg);
		return false;
	}
	
	if (identifier.login.length > 0 && identifier.password.length > 0)
	{
		var paramsObject = {login: identifier.login, password: identifier.password};
		var logUrl = identifier.uri + '?module=users&action=ChromeLogin';
		if (identifier.uilang.length > 0)
		{
			logUrl += '&uilang=' + identifier.uilang;
		}
		logUrl += '&ct=' + new Date().getTime();
		
		var b = ChangeToolKit.getJSObject(logUrl, paramsObject);
		if (b != null && b['ok'] != null)
		{		
			identifier.path = b['ok'];
			identifier.openinnewwindow = document.getElementById('openinnewwindow').checked;
			if (document.getElementById('persistidentity').checked)
			{
				addInHistory(url, identifier.login, identifier.path, identifier.uilang);
				ChangeToolKit.updateStoredLoginInfo(identifier.path, identifier.login, identifier.password);
			}
			else
			{
				addInHistory(url, '', identifier.path, identifier.uilang);				
				ChangeToolKit.deleteStoredLoginInfo(identifier.path, identifier.login);
			}
			if (b['OAuth'] != null)
			{
				ChangeToolKit.updateOAuthInfo(identifier.path, identifier.login, b['OAuth']);
			}
			
			window.opener.onChangeLogin(identifier);
		}
		else
		{
			if (b != null && b['error'] != null)
			{
				alert(b['error']);
				document.getElementById('resetpassword').removeAttribute('disabled');
				document.getElementById('password').setAttribute('value', '');
			}
			else
			{
				var msg = document.getElementById('error_notchangeserver').value;
				document.getElementById('browserCompatibility').value = msg;
			}
			return false;
		}
	}
	else
	{
		var msg = document.getElementById('error_allfieldsrequired').value;
		alert(msg);
		return false;
	}
	return true; 
} 

function doFirstLogin()
{
	var identifier = window.arguments[0];
	identifier.login = document.getElementById('adminlogin').value;
	identifier.password = document.getElementById('adminpassword').value;
	identifier.uilang = '';
	var adminemail = document.getElementById('adminemail').value;
	
	var originalUrl = document.getElementById('url').value;
	var url = cleanUrl(originalUrl);
	if (url != '')
	{
		checkBrowsersCompatibility(url);	
		url = checkedUrl;
		identifier.uri = url + '/xchrome_controller.php';
	}
	else
	{
		var msg = document.getElementById('error_invalidurl').value;
		alert(msg);
		return false;
	}
	
	if (identifier.login.length > 0 && identifier.password.length > 0 && adminemail.length > 0)
	{
		var paramsObject = {login: identifier.login, password: identifier.password, adminemail: adminemail};
		var logUrl = identifier.uri + '?module=users&action=ChromeLogin&ct=' + new Date().getTime();
		var b = ChangeToolKit.getJSObject(logUrl, paramsObject);
		if (b != null && b['ok'] != null)
		{		
			identifier.path = b['ok'];
			identifier.openinnewwindow = document.getElementById('openinnewwindow').checked;
			if (document.getElementById('persistidentity').checked)
			{
				addInHistory(url, identifier.login, identifier.path, '');
				ChangeToolKit.updateStoredLoginInfo(identifier.path, identifier.login, identifier.password);
			}
			else
			{
				addInHistory(url, '', '', identifier.path, '');
				ChangeToolKit.deleteStoredLoginInfo(identifier.path, identifier.login);
			}
			
			if (b['OAuth'] != null)
			{
				ChangeToolKit.updateOAuthInfo(identifier.path, identifier.login, b['OAuth']);
			}
			
			window.opener.onChangeLogin(identifier);
		}
		else
		{
			if (b != null && b['error'] != null)
			{
				alert(b['error']);
			}
			else
			{
				var msg = document.getElementById('error_notchangeserver').value;
				document.getElementById('browserCompatibility').value = msg;
			}
			return false;
		}
	}
	else
	{
		var msg = document.getElementById('error_allfieldsrequired').value;
		alert(msg);
		return false;
	}
	return true; 
}

function doCancel()
{ 
	window.arguments[0].path = false;
	return true; 
}

function cleanUrl(rawUrl)
{
	var match = rawUrl.match(/^(https?:\/\/[^\/]+)/);
	if (match)
	{
		return match[1];
	}
	
	return '';	
}

function loadServerHistory()
{
	ChangeToolKit.debug('loadServerHistory');
	var entries = ChangeToolKit.getRegisteredSitesHistory();
	ChangeToolKit.orderHistoryByURL(entries);
	for (var i = 0; i < entries.length; i++)
	{
		var history = entries[i];
		history.xpath = history.pId;
		history.uilang = history.lang;
	}
	serverHistory = entries;
}

function getInHistory(url)
{
	for(var i = 0; i < serverHistory.length; i++)
	{
		if (serverHistory[i].url == url)
		{
			return serverHistory[i];
		}
	}
	return null;
}

function addInHistory(url, login, xpath, uilang)
{
	var historyentry = {pId: xpath, url:url, login:login, lang: uilang};
	ChangeToolKit.setRegisteredSite(historyentry);
	ChangeToolKit.getPreferencesService().setCharPref('rbschange.ext.lastprojectid', xpath);
	if (window.opener)
	{
		var btn = window.opener.document.getElementById('tbtnChange');
		if (btn)
		{
			 btn.setAttribute('tooltiptext', url);
		}
	}
}