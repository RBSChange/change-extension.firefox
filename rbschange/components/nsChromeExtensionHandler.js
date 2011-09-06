Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// Mozilla defined
const nsIIOService = Components.interfaces.nsIIOService;
const nsIProtocolHandler = Components.interfaces.nsIProtocolHandler;
const nsIRequest = Components.interfaces.nsIRequest;
const nsIStandardURL = Components.interfaces.nsIStandardURL;
const nsIURI = Components.interfaces.nsIURI;

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
	protocolFlags : nsIProtocolHandler.URI_STD,
  
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
	this.ConsoleService = Components.classes["@mozilla.org/consoleservice;1"]
		.getService(Components.interfaces.nsIConsoleService);
	this.debugOn = false;
	this.debug("[ChromeExtensionHandler.<init>]");
	this._system_principal = null;
	this._extensions = new Object();
  },

  registerExtension : function(ext) {
    
    var ext_spec = "xchrome://" + ext.pkg + "/content/ext/" + ext.path + "/";
    ext_spec = ext_spec.toLowerCase();
    
    this.debug("[ChromeExtensionHandler.registerExtension] " + ext_spec);

    if (this._extensions[ext_spec] != null) {
      this.debug("[ChromeExtensionHandler.registerExtension] failed - extension already registered: " + ext_spec);
      return false;
    }
    else {
      this._extensions[ext_spec] = ext;
      //this.debug("[ChromeExtensionHandler.registerExtension] extension registered: " + ext_spec);
      return true;
    }
  },
  
  // TODO: Specific RBS CHANGE Register
  registerExtensionChange : function(pkg, path, projectURI) {
  	//this.debug("[ChromeExtensionHandler.registerExtensionChange] " + pkg + ", " + path + ", " + projectURI);
  	var changeXChromeExtension	= 
	{ 
		pkg : pkg, // ex: rbschange
		path : path, // ex: prodrbs
		projectURI : projectURI, // ex: http://www.rbs.fr/xul_controller.php
		
		newChannel : function(uri) 
		{
			// uri in the form of:
			// xchrome://rbschange/content/ext/prodrbs/
			var uri_str = uri.spec;	
			var ext_path = "module=uixul&action=Admin";	
			if (uri_str.length > this.baseUriLength) 
			{
				ext_path = uri_str.substring(this.baseUriLength);
				var paramsIndex = ext_path.indexOf('?');
				if (paramsIndex != -1) 
				{
					ext_path = ext_path.substring(paramsIndex + 1);
				}
			}
			var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService();
			ioService = ioService.QueryInterface(Components.interfaces.nsIIOService);
			
			var ext_uri_str = this.projectURI;
			if (ext_path.length > 0)
			{
			 	ext_uri_str += "?" + ext_path;
			}
			
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
	
	this.registerExtension(changeXChromeExtension);
	
	//this.debug('[ChromeExtensionHandler.registerExtensionChange] registered('+changeXChromeExtension.baseUriLength+', '+changeXChromeExtension.getXchromeBaseUri()+')');
	
	return changeXChromeExtension.getXchromeBaseUri();
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
    //this.debug("[ChromeExtensionHandler.allowPort]");
    return false;
  },
  
  newURI : function(spec, charset, baseURI) {
    //this.debug("[ChromeExtensionHandler.newURI] " + spec);
      
    var new_url = Components.classes["@mozilla.org/network/standard-url;1"].createInstance(nsIStandardURL);
    new_url.init(1, -1, spec, charset, baseURI);    
    
    var new_uri = new_url.QueryInterface(nsIURI);
    return new_uri;
  },
  
  newChannel : function(uri) {
    //this.debug("[ChromeExtensionHandler.newChannel] new channel requested for: " + uri.spec);

    var chrome_service = Components.classesByID["{61ba33c0-3031-11d3-8cd0-0060b0fc14a3}"].getService();
    chrome_service = chrome_service.QueryInterface(nsIProtocolHandler);

    var new_channel = null;
    
    try {
      var uri_string = uri.spec.toLowerCase();

      for (ext_spec in this._extensions) {
        var ext = this._extensions[ext_spec];
        
        if (uri_string.indexOf(ext_spec) == 0) {
         //this.debug("[ChromeExtensionHandler.newChannel] matched to registered extension: " + ext_spec);

          if (this._system_principal == null) {
            //this.debug("[ChromeExtensionHandler.newChannel] no system principal cached");

            var ioService = Components.classesByID["{9ac9e770-18bc-11d3-9337-00104ba0fd40}"].getService();
            ioService = ioService.QueryInterface(nsIIOService);

			// Dummy chrome URL used to obtain a valid chrome channel
			// This one was chosen at random and should be able to be
			// substituted
			// for any other well known chrome URL in the browser installation
            var chrome_uri_str = "chrome://global/content/bindings/browser.xml";

            //this.debug("[ChromeExtensionHandler.newChannel] spoofing chrome channel to URL: " + chrome_uri_str);
            
            var chrome_uri = chrome_service.newURI(chrome_uri_str, null, null);
            var chrome_channel = chrome_service.newChannel(chrome_uri);

            //this.debug("[ChromeExtensionHandler.newChannel] retrieving system principal from chrome channel");
            
            this._system_principal = chrome_channel.owner;

            var chrome_request = chrome_channel.QueryInterface(nsIRequest);
            chrome_request.cancel(0x804b0002);
            
            //this.debug("[ChromeExtensionHandler.newChannel] system principal is cached");
            
          }

          //this.debug("[ChromeExtensionHandler.newChannel] retrieving extension channel for: " + ext_spec);
          
          var ext_channel = ext.newChannel(uri);

          if (this._system_principal != null) {
            //this.debug("[ChromeExtensionHandler.newChannel] applying cached system principal to extension channel");
            
            ext_channel.owner = this._system_principal;
          }
          else {
            //this.debug("[ChromeExtensionHandler.newChannel] no cached system principal to apply to extension channel");
          }

          ext_channel.originalURI = uri;

          //this.debug("[ChromeExtensionHandler.newChannel] returning extension channel for: " + ext_spec);
          
          return ext_channel;

        }

      }
    
      //this.debug("[ChromeExtensionHandler.newChannel] passing request through to ChromeProtocolHandler::newChannel");
      //this.debug("[ChromeExtensionHandler.newChannel] requested uri = " + uri.spec);
      
      if (uri_string.indexOf("chrome") != 0) {
        uri_string = uri.spec;
        uri_string = "chrome" + uri_string.substring(uri_string.indexOf(":"));
        
        //this.debug("[ChromeExtensionHandler.newChannel] requested uri fixed = " + uri_string);
        
        uri = chrome_service.newURI(uri_string, null, null);
        
        //this.debug("[ChromeExtensionHandler.newChannel] requested uri canonified = " + uri.spec);
        
      }
      
      new_channel = chrome_service.newChannel(uri);
      
    } catch (e) {
      //this.debug("[ChromeExtensionHandler.newChannel] error - NS_ERROR_FAILURE");
      
      throw Components.results.NS_ERROR_FAILURE;
    }
    
    return new_channel;
  },
    
    debug : function (str)
    {
      if (this.debugOn) { 
    	dump("XCHROME: " + str + "\n");
        this.ConsoleService.logStringMessage("XCHROME:" + str);
      }
    }
};


let components = [ChromeExtensionHandler];

/**
 * XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
 * XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
 */
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule(components);