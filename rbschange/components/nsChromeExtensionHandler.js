Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

/*----------------------------------------------------------------------
 * The ChromeExtension Handler
 *----------------------------------------------------------------------
 */
function ChromeExtensionHandler() {
	this.init();
}

ChromeExtensionHandler.prototype = {
		scheme: "xchrome",
		defaultPort : -1,
		protocolFlags : Components.interfaces.nsIProtocolHandler.URI_STD | 
		Components.interfaces.nsIProtocolHandler.URI_IS_UI_RESOURCE | 
		Components.interfaces.nsIProtocolHandler.URI_IS_LOCAL_RESOURCE,

		classDescription: "Chrome Extension Protocol",
		classID: Components.ID("{6803D375-226F-4777-A8FF-D0022C2F4B40}"),
		contractID: "@mozilla.org/network/protocol;1?name=xchrome",

		_xpcom_categories: [{
			category: "app-startup",
			service: true
		}],

		QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsISupportsWeakReference, 
		                                       Components.interfaces.nsIProtocolHandler]),

       // Allow storage-Legacy.js to get at the JS object so it can
       // slap on a few extra properties for internal use.
        get wrappedJSObject() {
			return this;
		},

		init: function () {
			this.ConsoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);	
			this._system_principal = null;
			this._extensions = new Object();
			
			var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
			var branch = prefs.getBranch("extensions.");
			this._appVersion = parseInt(branch.getCharPref("lastAppVersion").split('.')[0]);
			
			branch = prefs.getBranch("rbschange.");
			this._debug = branch.getBoolPref("ext.debug");
			
			this.debug("initialized");
		},

		registerExtension : function(ext) {

			var ext_spec = "xchrome://" + ext.pkg + "/content/ext/" + ext.path + "/";
			ext_spec = ext_spec.toLowerCase();

			if (this._extensions[ext_spec] != null) {
				this.debug("registerExtension Already registered: " + ext_spec);
				return false;
			}
			else {
				this.debug("registerExtension " + ext_spec + ", " + ext.cacheDir.path);
				this._extensions[ext_spec] = ext;
				return true;
			}
		},

		// TODO: Specific RBS CHANGE Register
		registerExtensionChange : function(pkg, path, projectURI) {

			var changeXChromeExtension =  { 
					cacheDir : null,
					
					cacheContentTypeDir : null,

					pkg : pkg, // ex: rbschange
					path : path, // ex: prodrbs
					projectURI : projectURI, // ex: http://www.rbs.fr/xul_controller.php
					
					getExtraPath : function(xchrome_spec) {
						var base_spec = this.getXchromeBaseUri();
						if (xchrome_spec.indexOf(base_spec) == 0)
						{
							var ext_path = xchrome_spec.substring(base_spec.length);
							var paramsIndex = ext_path.indexOf('?');
							if (paramsIndex != -1) {ext_path = ext_path.substring(paramsIndex + 1);}
							return ext_path.split('#')[0];
						}
						return null;
					},
					
					deleteCache : function() {
						if (this.cacheDir.exists()) {
							this.cacheDir.remove(true);
						}
					},
					
					clearCache : function() {
						this.deleteCache();
						this.cacheDir = FileUtils.getDir("TmpD", [this.path], true);
						this.cacheContentTypeDir = FileUtils.getDir("TmpD", [this.path, 'ct'], true);
					},
					
					getFileCache : function(ext_path) {
						if (ext_path)
						{
							return FileUtils.getFile("TmpD", [this.path, ext_path.replace(/[\\\/:*?"<>|]/g, '_')]);
						}
						return null;
					},
					
					getContentTypeFileCache : function(ext_path) {
						if (ext_path)
						{
							return FileUtils.getFile("TmpD", [this.path, 'ct', ext_path.replace(/[\\\/:*?"<>|]/g, '_')]);
						}
						return null;
					},
					
					getHttpURI : function(ext_path) {
						if (ext_path)
						{
							var ext_uri_str = this.projectURI + "?" + ext_path;
							return NetUtil.ioService.newURI(ext_uri_str, null, null);
						}
						return null;
					},

					newChannel : function(uri) { 
						var uri_str = uri.spec;
						
						var ext_path = this.getExtraPath(uri_str);
						if (ext_path == null) {
							return null;
						}

						var ioService = NetUtil.ioService;
	
						var ctfile = this.getContentTypeFileCache(ext_path);
						var finalfile = this.getFileCache(ext_path);
						
						if (finalfile.exists() && ctfile.exists()) 
						{	
							var finalChanel = NetUtil.newChannel(finalfile);						
							var ctfilestream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
							ctfilestream.init(ctfile, -1, 0, 0);
							var ct = NetUtil.readInputStreamToString(ctfilestream, ctfilestream.available());
							ctfilestream.close();
							
							finalChanel.contentType = ct;
							return finalChanel;
						}
						else if ((ext_path.indexOf('action=Admin') != -1) && (ext_path.indexOf('module=uixul') != -1))
						{
							var chrome_service = ioService.getProtocolHandler("chrome");
							var chrome_uri_str = "chrome://rbschange/content/cache.xul";
							var chrome_uri = chrome_service.newURI(chrome_uri_str, null, null);
							return chrome_service.newChannel(chrome_uri);
						}
						
						var ext_uri_str = this.projectURI  + "?" + ext_path;

						var ext_uri = ioService.newURI(ext_uri_str, null, null);
						var ext_channel = ioService.newChannelFromURI(ext_uri);

						var bstream = ext_channel.open(); 
					
						var ostream = FileUtils.openSafeFileOutputStream(finalfile, FileUtils.MODE_CREATE | FileUtils.MODE_WRONLY | FileUtils.MODE_TRUNCATE);
						var size = 0;
						var data = '';
						while ((size = bstream.available()) > 0) 
						{
							data = NetUtil.readInputStreamToString(bstream, size);
							ostream.write(data, size);
						}
						
						FileUtils.closeSafeFileOutputStream(ostream);	
						bstream.close();

						if (ext_channel instanceof Components.interfaces.nsIHttpChannel)
						{			
							var ct = ext_channel.getResponseHeader("Content-Type");	
							if (ctfile.exists()) {
								ctfile.remove(false);
							}
							var finalChanel = NetUtil.newChannel(finalfile);
							finalChanel.contentType = ct;
							return finalChanel;
						}
						
						return null;
					},
					
					newRemoteChannel : function(uri) 
					{
						// uri in the form of:
						// xchrome://rbschange/content/ext/prodrbs/
						var uri_str = uri.spec;
						var ext_path = "action=Admin&module=uixul";
						if (uri_str.length > this.baseUriLength)
						{
							ext_path = uri_str.substring(this.baseUriLength);
							var paramsIndex = ext_path.indexOf('?');
							if (paramsIndex != -1) 
							{
								ext_path = ext_path.substring(paramsIndex + 1);
							}
						}
						var ioService = NetUtil.ioService;
						
						var ext_uri_str = this.projectURI + "?" + ext_path;
						
						var ext_uri = ioService.newURI(ext_uri_str, null, null);
						var ext_channel = ioService.newChannelFromURI(ext_uri);
						return ext_channel;
					},

					getXchromeBaseUri : function()
					{
						return 'xchrome://'+ this.pkg +'/content/ext/'+ this.path +'/';
					},

					baseUriLength : ('xchrome://'+ pkg +'/content/ext/'+ path +'/').length
			};

			changeXChromeExtension.cacheDir = FileUtils.getDir("TmpD", [path], true);
			changeXChromeExtension.cacheContentTypeDir = FileUtils.getDir("TmpD", [path, "ct"], true);

			this.registerExtension(changeXChromeExtension);

			return changeXChromeExtension.getXchromeBaseUri();
		},

		putInCache : function(ext, extPath, callBack, level) {
			try {
				if (extPath)
				{
					var fileCache = ext.getFileCache(extPath);
					var contentTypeFileCache = ext.getContentTypeFileCache(extPath);
					var httpURI = ext.getHttpURI(extPath);
					
					var ostream = FileUtils.openSafeFileOutputStream(fileCache, FileUtils.MODE_CREATE | FileUtils.MODE_WRONLY | FileUtils.MODE_TRUNCATE);				 
					var ext_channel = NetUtil.ioService.newChannelFromURI(httpURI);
					var istream = ext_channel.open();
					
					var size = 0;
					var data;
					while ((size = istream.available()) > 0) 
					{
						data = NetUtil.readInputStreamToString(istream, size);
						ostream.write(data, size);
					}
					istream.close();
					FileUtils.closeSafeFileOutputStream(ostream);

					if (ext_channel instanceof Components.interfaces.nsIHttpChannel)
					{
						if (ext_channel.responseStatus == 200)
						{
							var ct = ext_channel.getResponseHeader("Content-Type");
							var ctfilestream = FileUtils.openSafeFileOutputStream(contentTypeFileCache, FileUtils.MODE_CREATE | FileUtils.MODE_WRONLY | FileUtils.MODE_TRUNCATE);
							ctfilestream.write(ct, ct.length);
							FileUtils.closeSafeFileOutputStream(ctfilestream);
							if ('putInCacheUICallBack' in ext) {
								ext.putInCacheUICallBack(ext, extPath, ct);
							}
							if (callBack) {
								callBack(ext, level, fileCache);
							}
						}
					}
				}
				else
				{
					if (callBack) {callBack(ext, level, null);}
				}
			} catch (e) {
				this.debug("putInCache " + e.name + ' ' + e.message);
			}
		},
		
		putInCacheCallBack : function(ext, level, file) {
			if (level < 5 && file != null && file.exists() && file.isReadable()) {
				try {
				
					var istream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
					istream.init(file, 0x01, 420, 0);
					istream.QueryInterface(Components.interfaces.nsILineInputStream);
					
					var r = new RegExp(""); r.compile(ext.getXchromeBaseUri() + "([^\")\\s#]*)", "g");

					var line = {}, hasmore, s, m, i, xchrome_spec, extpath, tf;
					var uriArray = {};
					var countURI = 0;
					do {
						hasmore = istream.readLine(line);
						s = line.value;
						m = s.match(r);
						if (m != null) {
						   for (i = 0; i < m.length; i++) {
							   xchrome_spec = m[0].replace(/&amp;/g, '&');
							   extpath = ext.getExtraPath(xchrome_spec);
							   if (extpath) {
								   uriArray[extpath] = extpath;
								   countURI++;
							   }
						   }
						}
					} while (hasmore);			
					istream.close();
					
					if (countURI) {
						
						var me = this;
						var callback = function(ext, level, file) {me.putInCacheCallBack(ext, level, file);};
						
						for each (var extpath in uriArray) {
							tf = ext.getContentTypeFileCache(extpath);
							if (tf != null && tf.exists() == false) {
								this.putInCache(ext, extpath, callback, (level + 1));
							}
						}
					}
				} catch (e) {
					this.debug("putInCacheCallBack " + e.name + ' ' + e.message);
				}
			}
		},
		
		generateCache : function(xchromeURI, putInCacheUICallBack) {
			var xchrome_spec = xchromeURI.spec;
			var ext_spec = null;
			var me = this;
			var callback = function(ext, level, file) {me.putInCacheCallBack(ext, level, file);};
			
			for (ext_spec in this._extensions) {
				var ext = this._extensions[ext_spec];				
				if (xchrome_spec.indexOf(ext_spec) == 0) {
					ext.clearCache();
					ext.putInCacheUICallBack = putInCacheUICallBack;
					var extpath = ext.getExtraPath(xchrome_spec);
					this.putInCache(ext, extpath, callback, 0);
					return;
				}
			}
		},
		
		getRegisteredExtensionChange : function(pkg, path) {
			for (var ext_spec in this._extensions) {
				var ext = this._extensions[ext_spec];
				if (ext.pkg === pkg && ext.path === path) 
				{
					return ext;
				}
			}
			return null;
		},

		unregisterExtensionChange : function(ext) {  
			for (var ext_spec in this._extensions) {
				if (this._extensions[ext_spec] === ext) 
				{
					delete this._extensions[ext_spec];
					return;
				}
			}
		},

		allowPort : function(port, scheme) {
			return false;
		},

		newURI : function(spec, charset, baseURI) {
			var new_url = Components.classes["@mozilla.org/network/standard-url;1"].createInstance(Components.interfaces.nsIStandardURL);
			new_url.init(1, -1, spec, charset, baseURI);		
			var new_uri = new_url.QueryInterface(Components.interfaces.nsIURI);
			return new_uri;
		},

		getExtensionBySpec : function(spec) {
			var uri_string = spec.toLowerCase();
			var ext_spec = null;
			for (ext_spec in this._extensions) {
				var ext = this._extensions[ext_spec];
				if (uri_string.indexOf(ext_spec) == 0) {
					return ext;
				}
			}
			return null
		},
		
		newChannel : function(uri) {
			try {

				if (this._system_principal == null) {
					this.debug("Caching system principal ....");

					var chrome_service = NetUtil.ioService.getProtocolHandler("chrome");

					var chrome_uri_str = "chrome://rbschange/content/changeManager.js";
					var chrome_uri = chrome_service.newURI(chrome_uri_str, null, null);
					var chrome_channel = chrome_service.newChannel(chrome_uri);

					this._system_principal = chrome_channel.owner;

					var chrome_request = chrome_channel.QueryInterface(Components.interfaces.nsIRequest);
					chrome_request.cancel(0x804b0002);
				}

				var uri_string = uri.spec.toLowerCase();
				var ext_spec = null;
				for (ext_spec in this._extensions) {
					var ext = this._extensions[ext_spec];
					if (uri_string.indexOf(ext_spec) == 0) {
						
						var ext_channel = (this._appVersion >= 17) ? ext.newChannel(uri) : ext.newRemoteChannel(uri);
						if (ext_channel)
						{
							this.debug("newChannel: " + uri_string);
							ext_channel.owner = this._system_principal;
							ext_channel.originalURI = uri;
							return ext_channel;
						}
						else
						{
							this.debug("newChannel not found: " + uri_string);
						}
						throw Components.results.NS_ERROR_FAILURE;
					}
				}

				throw Components.results.NS_ERROR_FAILURE;
			} catch (e) {
				this.debug("newChannel NS_ERROR_FAILURE " + e.name + ' ' + e.message);
				throw Components.results.NS_ERROR_FAILURE;
			}
		},

		debug : function (str)
		{
			if (this._debug) { 
				dump("XCHROME: " + str + "\n");
				this.ConsoleService.logStringMessage("XCHROME:" + str);
			}
		}
};


let components = [ChromeExtensionHandler];

if (XPCOMUtils.generateNSGetFactory)
	var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
else
	var NSGetModule = XPCOMUtils.generateNSGetModule(components);