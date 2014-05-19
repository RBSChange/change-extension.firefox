var ChangeToolKit = {
	trim: function(s) 
	{
	  if (!s || s=="") return "";
	  while ((s.charAt(0)==' ') || (s.charAt(0)=='\n') || (s.charAt(0,1)=='\r')) s=s.substring(1,s.length);
	  while ((s.charAt(s.length-1)==' ') || (s.charAt(s.length-1)=='\n') || (s.charAt(s.length-1)=='\r')) s=s.substring(0,s.length-1);
	  return s;
	},
	
	cleanHiddenChars: function(a)
	{
		if (typeof a == 'string') {return a.replace(/\x19/g, "");}
		return a;
	},
	
	debugactive : null,
	
	debug: function(str)
	{
		if (this.debugactive === null)
		{
			this.debugactive = this.getPreferencesService().getBranch("").getBoolPref('extensions.rbschange.ext.debug');
		}
		if (this.debugactive)
		{
			var consoleService=Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
			consoleService.logStringMessage(str);
		}
	},
	
	dump: function(obj, name, indent, depth)
	{
		if (typeof name == "undefined") {name = "anonymous";}
		if (typeof indent == "undefined") {indent = "";}
		if (typeof depth == "undefined") {depth = 1;}
		
		if (depth > 10) 
		{
			return indent + name + ": <Maximum Depth Reached>\n";
		}
		if (typeof obj == "object") {	
			var child = null;
			var output = indent + name + "\n";
			indent += "\t";
			for (var item in obj)
			{
				try {
					child = obj[item];
				} catch (e) {
					child = "<Unable to Evaluate>";
				}
				if (typeof child == "object") {
					output += ChangeToolKit.dump(child, item, indent, depth + 1);
				} else {
					output += indent + item + ": " + child + "\n";
				}
			}
			return output;
		} 
		else 
		{
			return obj;
		}
	},
	
	parseBoolean: function(mixed)
	{
        var bool = false;
        switch (typeof mixed)
        {
            case "object":
            	bool = this.parseBoolean(mixed == null ? false : mixed.toString());
                break;
            case "boolean":
                bool = mixed;
                break;
            case "number":
                bool = (mixed != 0);
                break;
            case "string":
                mixed = this.trim(mixed.toLowerCase());
                switch (mixed)
                {
                    case "false":
                    case "off":
                    case "no":
                    case "0":
                    case "":
                        bool = false;
                        break;
                    default:
                    	bool = true;
                    	break;
                }
                break;
        }
        return bool;
	},
	
	getCBJSObject: function(uri, paramsObject, callBack)
	{
		var data = null;
		if (typeof(paramsObject) == 'object')
		{
			var str = this.encodeURIParameters(paramsObject);
			if (str.length > 0)
			{
				data = str;
			}
		}
		this.debug('Info getCBJSObject get URI: ' + uri);
		try
		{
			var req = new XMLHttpRequest();
			req.open('POST', uri, true);
			req.onreadystatechange = function (aEvt) {
				if (req.readyState == 4) {
					var json = null;
					if (req.status == 200) {
						
						try {
							json = JSON.parse(req.responseText);
						} catch (e) {
							this.debug('Error in getCBJSObject on parsing: ' + req.responseText);
						}	
						
					} else {
						this.debug('Error in getCBJSObject invalid status: ' + req.status + ' for uri: '+ uri);
					}
					callBack(json);
				}
			};
			req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
			req.send(data);	
		}
		catch (e)
		{
			this.debug('Unable to send Request: ' + uri);
			callBack(null);
		}
	},
	
	encodeURIParameters: function(paramsObject)
	{
		var result = [];
		for (var name in paramsObject)
		{
			var value = paramsObject[name];
			if (value != null)
			{
				if (typeof(value) != 'function')
				{
					if (typeof(value) == 'object' && 'push' in value)
					{
						var paramAppears = false;
						for (var i in value)
						{
							result.push(name+'['+i+']='+encodeURIComponent(value[i]));
							paramAppears = true;
						}
						if (!paramAppears)
						{
							result.push(name+'[]=');
						}
					}
					else
					{
						result.push(name + '=' + encodeURIComponent(value));
					}
				}
			}
		}
		return result.join("&");
	},
   	
   	preferencesService: null,
	
   	getPreferencesService: function() 
	{
	    if (this.preferencesService === null) 
	    {
	    	this.preferencesService = Components.classes["@mozilla.org/preferences-service;1"].
	        getService(Components.interfaces.nsIPrefService);
	    }
	    return this.preferencesService;
	},
   	
	getNavigatorVersion: function()
	{
		var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
		this.debug('Navigator Version : ' + appInfo.vendor + ' ' + appInfo.name + ' ' + appInfo.version + '.');
		return appInfo.version;
	},
	
	getRegisteredSitesHistory: function()
	{
		var history = [];
		var prefs = this.getPreferencesService();
		var branch = prefs.getBranch("extensions.rbschange.history.");
		var children = branch.getChildList("", {});
		for (var i = 0; i <  children.length; i++)
		{
		    var prefname = "extensions.rbschange.history." + children[i];
		    var data = prefs.getBranch("").getComplexValue(prefname , Components.interfaces.nsISupportsString).data;
		    history.push(JSON.parse(data));
		}		
		return history;
	},
	
	orderHistoryByURL: function(entries)
	{
		entries.sort(function(r1, r2) {
			if (r1.url === r2.url) 
			{
				return 0;
			}
			else
			{
				return r1.url > r2.url ? 1 : -1;
			}
		});
	},	
	
	getLastLoginRegisteredSite: function()
	{
		var projectId = this.getPreferencesService().getCharPref('extensions.rbschange.ext.lastprojectid');
		if (projectId != null && projectId != '')
		{
			var entry = this.getRegisteredSiteByProjectId(projectId);
			if (entry === null)
			{
				this.getPreferencesService().clearUserPref('extensions.rbschange.ext.lastprojectid');
			}
			return entry;
		}
		return null;
	},
	
	getRegisteredSiteByProjectId: function(projectId)
	{
		var prefname = "extensions.rbschange.history." + projectId;
		var prefs = this.getPreferencesService();
		if (prefs.prefHasUserValue(prefname))
		{
			var data = prefs.getBranch("").getComplexValue(prefname , Components.interfaces.nsISupportsString).data;
			return JSON.parse(data);
		}
		return null;
	},

	clearRegisteredSiteByProjectId: function(projectId)
	{
		ChangeToolKit.debug('ChangeToolKit.clearRegisteredSiteByProjectId: ' + projectId);
		var prefs = this.getPreferencesService().getBranch("");
		if (prefs.getCharPref('extensions.rbschange.ext.lastprojectid') == projectId)
		{	
			prefs.clearUserPref('extensions.rbschange.ext.lastprojectid');
		}
		var prefname = "extensions.rbschange.history." + projectId;
		if (prefs.prefHasUserValue(prefname))
		{
			prefs.clearUserPref(prefname);
			return true;
		}		
		return false;
	},
	
	setRegisteredSite: function(history)
	{
		var historyentry = {pId: history.pId, url:history.url, login:history.login, lang:history.lang};
		var prefname = "extensions.rbschange.history." + historyentry.pId;
		var prefs = this.getPreferencesService();
		var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
	    str.data = JSON.stringify(historyentry);
	    prefs.getBranch("").setComplexValue(prefname, Components.interfaces.nsISupportsString, str);
	    return historyentry;
	},
	   	
	savePassword: function(projectId, userName, password)
   	{
		ChangeToolKit.debug('ChangeToolKit.savePassword: ' + projectId + ', ' + userName + ', ' + password);
		var hostname = 'xchrome://' + projectId;
   		var passwordManager = Components.classes["@mozilla.org/login-manager;1"].  
   				getService(Components.interfaces.nsILoginManager);
   		
   		var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",  
   				Components.interfaces.nsILoginInfo, "init");  
   		var extLoginInfo = new nsLoginInfo(hostname ,  null, 'RBS Change User',  userName, password, "", "");
   		passwordManager.addLogin(extLoginInfo);
   	},

   	getStoredLoginInfo: function(projectId, userName)
   	{
   		var hostname = 'xchrome://' + projectId;
   		var myLoginManager = Components.classes["@mozilla.org/login-manager;1"].  
   			getService(Components.interfaces.nsILoginManager);  
   		
   	    var logins = myLoginManager.findLogins({}, hostname, null, 'RBS Change User');  
   	        
   	    // Find user from returned array of nsILoginInfo objects  
   	    for (var i = 0; i < logins.length; i++)
   	    {  
   	       if (logins[i].username == userName) 
   	       {  
   	          return logins[i];   
   	       }  
   	    }
   	    return null;
   	},

   	getLoginPassword: function(projectId, userName)
   	{
   		var login = this.getStoredLoginInfo(projectId, userName);
   		if (login !== null)
   		{
   			return login.password;
   		}	
   	    return '';
   	},

   	clearStoredLoginInfos: function(projectId)
   	{
   		ChangeToolKit.debug('ChangeToolKit.clearStoredLoginInfos: ' + projectId);
   		var hostname = 'xchrome://' + projectId;
   		var myLoginManager = Components.classes["@mozilla.org/login-manager;1"].  
   			getService(Components.interfaces.nsILoginManager);  
   	    var logins = myLoginManager.findLogins({}, hostname, null, 'RBS Change User');  
   	    for (var i = 0; i < logins.length; i++)
   	    {  
   	       myLoginManager.removeLogin(logins[i]);
   	    }
   	    
   	    logins = myLoginManager.findLogins({}, hostname, null, 'RBS Change OAuth');  
   	    for (var i = 0; i < logins.length; i++)
   	    {  
   	       myLoginManager.removeLogin(logins[i]);
   	    }
   	},

   	updateStoredLoginInfo: function(projectId, userName, password)
   	{
   		ChangeToolKit.debug('ChangeToolKit.updateStoredLoginInfo: ' + projectId + ', ' + userName + ', ' + password);
   		var hostname = 'xchrome://' + projectId;
   		var myLoginManager = Components.classes["@mozilla.org/login-manager;1"].  
   			getService(Components.interfaces.nsILoginManager);  
   	    var logins = myLoginManager.findLogins({}, hostname, null, 'RBS Change User');  
   	        
   	    // Find user from returned array of nsILoginInfo objects  
   	    for (var i = 0; i < logins.length; i++)
   	    {  
   	       if (logins[i].username == userName) 
   	       {  
   	    	   if (logins[i].password == password)
   	    	   {
   	    		   return;
   	    	   }
   	    	   ChangeToolKit.debug('ChangeToolKit.updateStoredLoginInfo: removeLogin ' + userName);
   	    	   myLoginManager.removeLogin(logins[i]);
   	    	   break;
   	       }  
   	    }
   	    this.savePassword(projectId, userName, password);
   	},
   	
   	deleteStoredLoginInfo: function(projectId, userName)
   	{
   		var hostname = 'xchrome://' + projectId;
   		var myLoginManager = Components.classes["@mozilla.org/login-manager;1"].  
   			getService(Components.interfaces.nsILoginManager);  
   	    var logins = myLoginManager.findLogins({}, hostname, null, 'RBS Change User');  
   	        
   	    // Find user from returned array of nsILoginInfo objects  
   	    for (var i = 0; i < logins.length; i++)
   	    {  
   	       if (logins[i].username == userName) 
   	       {  
   	    	   myLoginManager.removeLogin(logins[i]);
   	    	   break;
   	       }  
   	    }
   	},
   	
   	updateOAuthInfo: function(projectId, userName, OAuthInfos)
   	{
   		var hostname = 'xchrome://' + projectId;
   		var myLoginManager = Components.classes["@mozilla.org/login-manager;1"].  
   			getService(Components.interfaces.nsILoginManager);  
   	    var logins = myLoginManager.findLogins({}, hostname, null, 'RBS Change OAuth');  
   	    var password = JSON.stringify(OAuthInfos);
   	    
   	    // Find user from returned array of nsILoginInfo objects  
   	    for (var i = 0; i < logins.length; i++)
   	    {  
   	       if (logins[i].username == userName) 
   	       {  
   	    	   if (logins[i].password == password)
   	    	   {
   	    		   return;
   	    	   }
   	    	   myLoginManager.removeLogin(logins[i]);
   	    	   break;
   	       }  
   	    }
   		var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",  
   				Components.interfaces.nsILoginInfo, "init");  
   		var extLoginInfo = new nsLoginInfo(hostname ,  null, 'RBS Change OAuth',  userName, password, "", "");
   		myLoginManager.addLogin(extLoginInfo);
   	},
   	
   	getStoredOAuthInfo: function(projectId, userName)
   	{
   		var hostname = 'xchrome://' + projectId;
   		var myLoginManager = Components.classes["@mozilla.org/login-manager;1"].  
   			getService(Components.interfaces.nsILoginManager);
   	    var logins = myLoginManager.findLogins({}, hostname, null, 'RBS Change OAuth');  
   	    for (var i = 0; i < logins.length; i++)
   	    {  
   	       if (logins[i].username == userName) 
   	       {  
   	          return JSON.parse(logins[i].password);   
   	       }  
   	    }
   	    return null;
   	},
   	
	removeCookieSessionPermission: function(url)
	{
		ChangeToolKit.debug('ChangeToolKit.removeCookieSessionPermission: ' + url);
		var host = url.replace(/^\s*([-\w]*:\/+)?/, "");
	    var pm = Components.classes["@mozilla.org/permissionmanager;1"]
	                .getService(Components.interfaces.nsIPermissionManager);
	    pm.remove(host, 'cookie');
	}
}
