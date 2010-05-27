var ChangeManager = 
{	
	getXChromeService: function ()
	{
	  return Components.classes["@mozilla.org/network/protocol;1?name=xchrome"].getService().wrappedJSObject;
	},
		
	getIdentifierByPath: function (path)
	{
		var history = ChangeToolKit.getRegisteredSiteByProjectId(path);
		if (history != null)
		{
			var password = '';
			if (history.login.length > 0)
			{
				password = ChangeToolKit.getLoginPassword(history.pId, history.login);
			}
			return {path: history.pId, uri: history.url +'/xchrome_controller.php', 
					login: history.login, password: password, baseURI: history.url, uilang: history.lang};
		}
		ChangeToolKit.debug('ChangeManager.getIdentifierByPath: ' + path + ' not found');
		return null;
	},
	
	register: function(identifier)
	{
		var xChromeService = this.getXChromeService();
		var ext = xChromeService.getRegisteredExtensionChange('rbschange', identifier.path);
		if (ext === null)
		{
			identifier.extension = xChromeService.registerExtensionChange('rbschange', identifier.path, identifier.uri);
			this.addCookieSessionPermission(identifier.uri);
		}
		else
		{
			identifier.extension = ext.getXchromeBaseUri();
			
		}
		return identifier;
	},
	
	unregister: function(projectId)
	{
		ChangeToolKit.debug('ChangeManager.unregister : ' + projectId);
		var xChromeService = this.getXChromeService();
		var ext = xChromeService.getRegisteredExtensionChange('rbschange', projectId);
		if (ext !== null)
		{
			ChangeToolKit.debug('ChangeManager.unregister xchrome: ' + projectId );
			xChromeService.unregisterExtensionChange(ext);
		}
		ChangeToolKit.debug('ChangeManager.unregister check History: ' + projectId );
		var history = ChangeToolKit.getRegisteredSiteByProjectId(projectId);
		if (history != null)
		{
			ChangeToolKit.clearRegisteredSiteByProjectId(projectId);
			ChangeToolKit.clearStoredLoginInfos(projectId);
			ChangeToolKit.removeCookieSessionPermission(history.url);
		}
	},
	
	portalRedirect: function(url, login, password)
	{
		ChangeToolKit.debug('ChangeManager.portalRedirect : ' + url + ', ' + login + ', ' + password);
		var identifier = {uri: url + '/xchrome_controller.php', login: login, password: password};
		var paramsObject = {login: identifier.login, password: identifier.password};
		var logUrl = identifier.uri + '?module=users&action=PortalLogin&ct=' + new Date().getTime();
		var b = ChangeToolKit.getJSObject(logUrl, paramsObject);
		if (b != null && b['ok'] != null)
		{
			identifier.path = b['ok'];
			var identifiedProject = this.register(identifier);
			var extension = identifiedProject.extension;
			extension += 'module=uixul&action=Admin';
			return extension;
		}
		return null;
	},
	
	login: function(uri, login, password, uilang)
	{
		ChangeToolKit.debug('ChangeManager.login : ' + uri);
		var paramsObject = {login: login, password: password};
		if (uilang.length > 0)
		{
			paramsObject.uilang = uilang;
		}
		var logUrl = uri + '?module=users&action=ChromeLogin';
		return ChangeToolKit.getJSObject(logUrl, paramsObject);
	},
	
	addCookieSessionPermission: function(url)
	{
		var host = url.replace(/^\s*([-\w]*:\/+)?/, "");
		try 
		{
			var ioService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
		    var uri = ioService.newURI("http://" + host, null, null);
		    host = uri.host;
		} 
		catch (ex) 
		{
			ChangeToolKit.debug('ChangeManager.addCookieSessionPermission: Invalid URL' + url);
			return;
		}

	    var pm = Components.classes["@mozilla.org/permissionmanager;1"].getService(Components.interfaces.nsIPermissionManager)
	    var enumerator = pm.enumerator;
	    while (enumerator.hasMoreElements()) 
	    {
			var nextPermission = enumerator.getNext().QueryInterface(Components.interfaces.nsIPermission);
			if (nextPermission.type == 'cookie' && nextPermission.host == host)
			{
				return;
			}
	    }
	    
	    ChangeToolKit.debug('ChangeManager.addCookieSessionPermission: ' + host);
	    var _cap = Components.interfaces.nsICookiePermission.ACCESS_ALLOW;
	    pm.add(uri, 'cookie', _cap);
	},
		
	test: function(arg)
	{
		/*
		ChangeToolKit.debug('ChangeManager.test');
		ChangeToolKit.debug(arg);
		*/
	}
}