function onRBSChangePopupShowing(aEvent)
{
	var popup = aEvent.target;
	while (popup.lastChild) {popup.removeChild(popup.lastChild);}

	var addoppen = false;
	var entries = ChangeToolKit.getRegisteredSitesHistory();
	ChangeToolKit.orderHistoryByURL(entries);
	
	for (var i = 0; i < entries.length; i++)
	{
		var history = entries[i];
		if (history.login != '')
		{
			var menuitem = document.createElement('menuitem');
			menuitem.setAttribute('label', history.url);
			menuitem.setAttribute('value', history.pId);
			menuitem.setAttribute('tooltiptext', history.url);
			popup.appendChild(menuitem);  
			addoppen = true;			
		}
	}	
	if (addoppen) 
	{
		var btn = document.getElementById('tbtnChange');
		if (btn)
		{
			popup.appendChild(document.createElement('menuseparator'));
			var menuitem = document.createElement('menuitem');
			menuitem.setAttribute('label', btn.getAttribute('defaulttooltip'));
			menuitem.setAttribute('value', '');
			popup.appendChild(menuitem);
		}
	}
	else
	{
		aEvent.preventDefault();
	}
}

function onRBSChangeShortOpen(aEvent)
{
	var projectId = null;
	if (aEvent.target.id == 'tbtnChange') 
	{
		projectId = ChangeToolKit.getPreferencesService().getCharPref('extensions.rbschange.ext.lastprojectid');
		ChangeToolKit.debug('onRBSChangeLastShortOpen:' + projectId);
	}
	else
	{
		projectId = aEvent.target.getAttribute('value');
		ChangeToolKit.debug('onRBSChangeShortOpen:'+projectId);
	}
	onRBSChangeOpenByIndex(projectId);
}

function onRBSChangeOpenByIndex(projectId)
{
	ChangeToolKit.debug('onRBSChangeOpenByIndex:'+ projectId);
	var identifier = ChangeManager.getIdentifierByPath(projectId);
	if (identifier != null)
	{
		ChangeManager.login(identifier.uri, identifier.login, identifier.password, identifier.uilang, function(result) {
			if (result != null && result['ok'] == identifier.path)
			{
				ChangeToolKit.getPreferencesService().setCharPref('extensions.rbschange.ext.lastprojectid', projectId);
				var btn = document.getElementById('tbtnChange');
				if (btn)
				{
					btn.setAttribute('tooltiptext', identifier.baseURI);
				}
				
				if (result['OAuth'] != null)
				{
					ChangeToolKit.updateOAuthInfo(identifier.path, identifier.login, result['OAuth']);
				}	
				
				onChangeLogin(identifier);			
			}
			else
			{
				openChangeLogin(identifier);
			}
		});
	}
	else
	{
		openChangeLogin(identifier);
	}
}

function openChangeLogin(ident)
{
	var identifier = {};
	if (ident != null && ident.baseURI) 
	{
		identifier.baseURI = ident.baseURI;
	}
	window.openDialog('chrome://rbschange/content/login.xul', 'login', 'chrome,extrachrome,resizable,centerscreen,width=650,height=300', identifier);
}

function onOpenWebConsole(identifier)
{
	//identifier {consumerKey:'',consumerSecret:'',token:'',tokenSecret:'',URL:''}
	if (identifier)
	{
		window.openDialog('chrome://rbschange/content/console/webconsole.xul', 'webconsole', 'chrome,extrachrome,resizable,centerscreen,width=650,height=300', identifier);
	}
}

function onChangeLogin(identifier)
{
	if (identifier.path)
	{
		var identifiedProject = ChangeManager.register(identifier);
		var extension = identifiedProject.extension;
		extension += 'action=Admin&module=uixul';
		if (identifier.uilang.length > 0)
		{
			extension += '&uilang=' + identifier.uilang;
		}
		ChangeToolKit.debug('load : ' + extension );
		if (identifier.openinnewwindow)
		{
			//winopts = "chrome,extrachrome ...			
			var winopts = "resizable,scrollbars,status,centerscreen,width=1024,height=720";
			window.open(extension, identifiedProject.path, winopts);
		}
		else
		{
			// In main window
			if (identifier.autoconnect || getWebNavigation().currentURI.spec == 'about:blank')
			{
				loadURI(extension);
			}
			else
			{
				getBrowser().selectedTab = getBrowser().addTab(extension);
			}
		}
	}
}

function rbsChangePageLoad(event)
{
	try 
	{

		if (event.originalTarget instanceof HTMLDocument) 
		{
			var doc = event.originalTarget;
			if (event.originalTarget.defaultView.frameElement) 
			{
				return;
			}
			
			ChangeToolKit.debug('rbsChangePageLoad...');	
			ChangeToolKit.delayedExtensionStartUp = window.setTimeout(function () {rbsChangeCheckPageContent(doc);}, 500);
		}
	}
	catch (e)
	{
		ChangeToolKit.debug('Error in rbsChangePageLoad : ' + e.toString());
	}
}

function rbsChangeCheckPageContent(doc)
{
	ChangeToolKit.delayedExtensionStartUp = null;
	ChangeToolKit.debug('rbsChangeCheckPageContent...');
	try 
	{
		var elem = doc.getElementById('changexchrome');
		if (elem)
		{
			var url = elem.getAttribute('url');
			if (url)
			{
				ChangeToolKit.debug('ChangePageLoad : ' +  url);
				elem.setAttribute('style', 'display:none');
				
				var location = doc.defaultView.location;
				var xchromeurl = location.toString();
				
				ChangeToolKit.debug('rbsChangeCheckPageContent:'  + xchromeurl);
				var identifier = null;
				var match = xchromeurl.match(/^xchrome:\/\/rbschange\/content\/ext\/(.+)\//);
				if (match)
				{
					identifier = ChangeManager.getIdentifierByPath(match[1]);
				}
				else if (elem.hasAttribute('data-xchromeurl'))
				{
					xchromeurl = elem.getAttribute('data-xchromeurl');
					match = xchromeurl.match(/^xchrome:\/\/rbschange\/content\/ext\/(.+)\//);
					if (match)
					{
						identifier = ChangeManager.getIdentifierByPath(match[1]);
					}
				}
				
				if (identifier)
				{
					var path = identifier.path;
					var login = identifier.login;
					var baseURI  = identifier.baseURI;
					ChangeManager.login(identifier.uri, identifier.login, identifier.password, identifier.uilang, function (result) {
						if (result != null && result['ok'] == path)
						{
							ChangeToolKit.getPreferencesService().setCharPref('extensions.rbschange.ext.lastprojectid', path);
							var btn = document.getElementById('tbtnChange');
							if (btn)
							{
								btn.setAttribute('tooltiptext', baseURI);
							}
							
							if (result['OAuth'] != null)
							{
								ChangeToolKit.updateOAuthInfo(path, login, result['OAuth']);
							}	
							ChangeToolKit.debug('Reload : ' + location.toString() + ' / ' + xchromeurl);
							if (xchromeurl == location.toString())
							{
								doc.defaultView.location.reload(true);
							}
							else
							{
								doc.defaultView.location.replace(xchromeurl + location.hash);
							}
						}
						else
						{
							var identifier = {autoconnect: url};
							window.openDialog('chrome://rbschange/content/login.xul', 'login', 'chrome,extrachrome,resizable,centerscreen,width=650,height=300', identifier);
						}
					});
				}
				else
				{
					var identifier = {autoconnect: url};
					window.openDialog('chrome://rbschange/content/login.xul', 'login', 'chrome,extrachrome,resizable,centerscreen,width=650,height=300', identifier);
				}
			}
		}
	}
	catch (e)
	{
		ChangeToolKit.debug('Error in rbsChangeCheckPageContent : ' + e.toString());
	}
}

window.addEventListener("load", rbsChangeInitialize , false);
window.addEventListener("unload", rbsChangeUninitialize , false);

function rbsChangeUninitialize()
{
	try
	{
		

	}
	catch (e)
	{
		// Do nothing
	}
}

function rbsChangeInitialize()
{
	try
	{
		rbsChangeCheckPref();
		rbsChangeRegisterAll();
		
		var prefs = ChangeToolKit.getPreferencesService();
		
		if (prefs.getCharPref('extensions.rbschange.ext.startmode') != 'event')
		{
			ChangeToolKit.delayedExtensionStartUp = null;
			gBrowser.addEventListener("load", rbsChangePageLoad, true);
		}
		
		document.addEventListener("RBSChangeExtensionOpenWebConsole", function(event)
		{
			var elem = event.target;
			ChangeToolKit.debug('RBSChangeExtensionOpenWebConsole...');
			var OAuth = ChangeToolKit.getStoredOAuthInfo(elem.getAttribute('projectid'), elem.getAttribute('login'));
			if (OAuth !== null)
			{
				OAuth.URL =  elem.getAttribute('url');
				onOpenWebConsole(OAuth);
			}
		}, true, true); 
		
		document.addEventListener("RBSChangeExtensionStartEvent", function(event)
		{ 
			if (ChangeToolKit.delayedExtensionStartUp)
			{
				window.clearTimeout(ChangeToolKit.delayedExtensionStartUp);
				ChangeToolKit.delayedExtensionStartUp = null;
			}
		    ChangeToolKit.debug('RBSChangeExtensionStartEvent...');
		    var elem = event.target;
			var doc = elem.ownerDocument;
			rbsChangeCheckPageContent(doc);
		}, true, true); 
		
		document.addEventListener("RBSChangeOpenDocumentEvent", function(event)
		{ 
			ChangeToolKit.debug('RBSChangeOpenDocumentEvent...');
			var elem = event.target;
			var url = elem.getAttribute('data-xchromeurl');
			var match = url.match(/^xchrome:\/\/rbschange\/content\/ext\/(.+)\//);
			if (match)
			{
				var tabs = getBrowser().tabs;
				var num = tabs.length;
				for (var i = 0; i < num; i++)
				{
					var tab = tabs[i];
					var b = getBrowser().getBrowserForTab(tab);
					try
					{
						var location = b.contentWindow.location;
						var match2 = location.toString().match(/^xchrome:\/\/rbschange\/content\/ext\/(.+)\//);
						if (match2 && match2[0] == match[0])
						{
							if (url == location.toString())
							{
								location.hash = '#';
							}
							location.replace(url);
							getBrowser().selectedTab = tab;
							return;
						}
					}
					catch (e)
					{
						ChangeToolKit.debug('RBSChangeOpenDocumentEvent: error');
					}
				}
				getBrowser().selectedTab = getBrowser().addTab(url);
			}
		}, true, true);
		
		var cacm = document.getElementById('contentAreaContextMenu');
		ChangeToolKit.debug('contentAreaContextMenu : ' + cacm.id);
		cacm.addEventListener("popupshowing", ChangeManager.checkContextMenuDisplay, true); 
		window.removeEventListener("load", rbsChangeInitialize, false);
	}
	catch (e)
	{
		ChangeToolKit.debug('Error on rbsChangeInitialize');
	}
}

function rbsChangeRegisterAll()
{
	ChangeToolKit.debug('RBSChange Register xchrome channel.');
	var prefs = ChangeToolKit.getPreferencesService();	
	var lastProjectId = prefs.getCharPref('extensions.rbschange.ext.lastprojectid');
	var removeCookies = prefs.getCharPref('extensions.rbschange.ext.refreshcookies');	
	var entries = ChangeToolKit.getRegisteredSitesHistory();
	for (var i = 0; i < entries.length; i++)
	{
		var history = entries[i];
		var identifier = {path : history.pId, uri : history.url + '/xchrome_controller.php'};
		if (removeCookies != "none")
		{
			ChangeToolKit.removeCookieSessionPermission(history.url);
		}
		ChangeManager.register(identifier);
		if (history.pId === lastProjectId) 
		{
			var btn = document.getElementById('tbtnChange');
			if (btn)
			{
				btn.setAttribute('tooltiptext', history.url);
			}
		}
	}
	
	if (removeCookies != 'none')
	{
		prefs.setCharPref('extensions.rbschange.ext.refreshcookies', 'none');
	}
}

function rbsChangeCheckPref()
{
	var prefs = ChangeToolKit.getPreferencesService();	
	var prefVersion = prefs.getIntPref('extensions.rbschange.ext.prefversion');
	if (prefVersion == 0)
	{		
		if (prefs.prefHasUserValue('rbschange.ext.debug'))
		{
			prefs.setBoolPref('extensions.rbschange.ext.debug', prefs.getBoolPref('rbschange.ext.debug'));
			prefs.clearUserPref('rbschange.ext.debug');
		}
		
		if (prefs.prefHasUserValue('rbschange.ext.refreshcookies'))
		{
			prefs.setCharPref('extensions.rbschange.ext.refreshcookies', prefs.getCharPref('rbschange.ext.refreshcookies'));
			prefs.clearUserPref('rbschange.ext.refreshcookies');
		}
		
		if (prefs.prefHasUserValue('rbschange.ext.startmode'))
		{
			prefs.setCharPref('extensions.rbschange.ext.startmode', prefs.getCharPref('rbschange.ext.startmode'));
			prefs.clearUserPref('rbschange.ext.startmode');
		}
		
		if (prefs.prefHasUserValue('rbschange.ext.lastprojectid'))
		{
			prefs.setCharPref('extensions.rbschange.ext.lastprojectid', prefs.getCharPref('rbschange.ext.lastprojectid'));
			prefs.clearUserPref('rbschange.ext.lastprojectid');
		}
		
		var branch = prefs.getBranch("rbschange.history.");
		var children = branch.getChildList("", {});
		for (var i = 0; i <  children.length; i++)
		{
		    var prefname = "rbschange.history." + children[i];
		    prefs.setCharPref('extensions.' + prefname, prefs.getCharPref(prefname));
			prefs.clearUserPref(prefname);
		}
		
		if (prefs.prefHasUserValue('rbschange.ext.prefversion'))
		{
			prefs.clearUserPref('rbschange.ext.prefversion');
		}
		prefs.setIntPref('extensions.rbschange.ext.prefversion', 1);
	}
}