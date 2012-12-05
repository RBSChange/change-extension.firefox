
var webconsoledata = {
		signatureMethod: "HMAC-SHA1", 
		tokenURL: "/changescriptexec.php",
		change: {
			consumerKey : '',
			consumerSecret : '',
			token : '',
			tokenSecret : ''
		}
};


function getDefaultMessage()
{
	var message = {
			action : webconsoledata.tokenURL,
			method : "POST",
			parameters : []
		};
	message.parameters.push(["phpscript", "framework/bin/changeHTTP.php"]);
	message.parameters.push(["noframework", "true"]);
	return message;
}

function convertArgsStrToArray(argstr)
{
	var args = [];
	var splitedArgs = argstr.split(' ');
	for ( var e = 0; e < splitedArgs.length; ++e) {
		var val = splitedArgs[e].trim();
		if (val.length > 0)
		{
			args.push(val);
		}
	}	
	return args;
}


function sendCommand() {
	var cmdText = document.getElementById('webcmd').value;
	var args = ['-h'];
	if (cmdText != '-h')
	{
		args = convertArgsStrToArray(cmdText + ' ' + document.getElementById('webcmdargs').value);
	}
	var message = getDefaultMessage();
	for ( var e = 0; e < args.length; ++e) {
		message.parameters.push(["argv["+e+"]", args[e]]);
	}
	document.getElementById('send').disabled = true;
	var resultDiv = document.getElementById('result');
	while (resultDiv.lastChild) {resultDiv.removeChild(resultDiv.lastChild);}
	var html = '<span class="row_32">&gt;'+ cmdText + ' ' + args.join(' ') + '<br /></span>';
	
	resultDiv.appendChild(parseHTML(document, html, true, webconsoledata.URI, true));
	resultDiv.style.cursor = 'wait';
	sendMessage(message, displayCommandResult);	
}

function parseHTML(doc, html, allowStyle, baseURI, isXML) 
{ 
    // User the newer nsIParserUtils on versions that support it.
    if ("@mozilla.org/parserutils;1" in Components.classes) 
    {
    	var parser = Components.classes["@mozilla.org/parserutils;1"].getService(Components.interfaces.nsIParserUtils);
        if ("parseFragment" in parser)
        {
        	return parser.parseFragment(html, allowStyle ? parser.SanitizerAllowStyle : 0, !!isXML, baseURI, doc.documentElement);
        }
    }
    return Components.classes["@mozilla.org/feed-unescapehtml;1"]
                     .getService(Components.interfaces.nsIScriptableUnescapeHTML)
                     .parseFragment(html, !!isXML, baseURI, doc.documentElement);
}

function displayCommandResult(requestToken) 
{
	var text = requestToken.responseText;
	var resultDiv = document.getElementById('result');
	while (resultDiv.lastChild) {
		resultDiv.removeChild(resultDiv.lastChild);
	}
	
	if (text[0] == '<')
	{
		text = text.replace(/href="javascript:/g, "data-href=\"javascript:");
		resultDiv.appendChild(parseHTML(document, text, true, webconsoledata.URI, true));
		var items = resultDiv.getElementsByTagName('a');
		for (var i = 0; i < items.length; i++) 
		{ 
			if (items[i].hasAttribute('data-href'))
			{
				items[i].setAttribute('href', items[i].getAttribute('data-href'));
			}
		}
	} 
	else 
	{
		resultDiv.appendChild(parseHTML(document, '<pre></pre>', true, webconsoledata.URI, true));
		var tn  = document.createTextNode(text);
		resultDiv.firstChild.appendChild(tn);
	}
	resultDiv.style.cursor = 'default';
	document.getElementById('send').disabled = false;	
}

function sendMessage(message, callBack)
{
	var accessor = webconsoledata.change;
	var requestBody = OAuth.formEncode(message.parameters);
	OAuth.setParameter(message, "oauth_signature_method", webconsoledata.signatureMethod);
	OAuth.completeRequest(message, accessor);
	var authorizationHeader = OAuth.getAuthorizationHeader("", message.parameters);

	var requestToken = new XMLHttpRequest();
	requestToken.open(message.method, message.action, true);
	
	requestToken.onreadystatechange = function (aEvt) {
		if (requestToken.readyState == 4) {
			callBack(requestToken);
		}
	};
	requestToken.setRequestHeader("Authorization", authorizationHeader);
	requestToken.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	requestToken.send(requestBody);	
}

function onSelectCommand()
{
	var menu = document.getElementById('webcmd');
	var cmd = menu.value;
	var message = getDefaultMessage();
	message.parameters.push(["argv[0]", cmd]);
	message.parameters.push(["argv[1]", '-h']);
	sendMessage(message, displayCommandResult);
	var webcmdargs = document.getElementById('webcmdargs');
	webcmdargs.value= '';
	webcmdargs.focus();
}

function selectWebCommand(cmd)
{
   var webcmdargs = document.getElementById('webcmd');
   webcmdargs.value = cmd;
   onSelectCommand();
}

function onSelectParam(paramValue)
{
   var webcmdargs = document.getElementById('webcmdargs');
   webcmdargs.value = paramValue;
   webcmdargs.focus();
}

function onArgsChange()
{
	var webcmdargs = document.getElementById('webcmdargs');
	var argsstr = webcmdargs.value;
	if (argsstr.length == 0 || argsstr[argsstr.length -1] == ' ')
	{
		var cmd = document.getElementById('webcmd').value;
		if (cmd != '-h')
		{
			var args = convertArgsStrToArray('getParameters ' + cmd + ' ' + argsstr);			
			var message = getDefaultMessage();
			for ( var e = 0; e < args.length; ++e) {
				message.parameters.push(["argv["+e+"]", args[e]]);
			}
			sendMessage(message, displayCommandResult);
		}
	}
}


function onWebconsoleLoad()
{
	var identifier = window.arguments[0];
	webconsoledata.change.consumerKey = identifier.consumerKey;
	webconsoledata.change.consumerSecret = identifier.consumerSecret;
	webconsoledata.change.token = identifier.token;
	webconsoledata.change.tokenSecret = identifier.tokenSecret;
	webconsoledata.tokenURL = identifier.URL + webconsoledata.tokenURL;
	
	var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService().QueryInterface(Components.interfaces.nsIIOService);
	webconsoledata.URI = ioService.newURI(identifier.URL, null, null);
	
	var message = getDefaultMessage();
	message.parameters.push(["argv[0]", 'getCommands']);
	sendMessage(message, onCommandsLoaded);
}

function onCommandsLoaded(request)
{
	var XHTMLNS = 'http://www.w3.org/1999/xhtml';
	var parser = new DOMParser();  
	var doc = parser.parseFromString(request.responseText, "text/xml");
	var cmds = doc.getElementsByTagName('cmd');
	var menu = document.getElementById('webcmd');
	var resultDiv = document.getElementById('result');
	var elem = resultDiv.appendChild(document.createElementNS(XHTMLNS, 'span'));
	elem.setAttribute('class', 'row_std');
	elem.appendChild(document.createTextNode('Commands list:'));
	elem.appendChild(document.createElementNS(XHTMLNS, 'br'));
	for (var index = 0; index < cmds.length; index++) 
	{
		//Menu entry
		var cmdName = cmds[index].getAttribute('name');
		var cmdDesc = cmds[index].getAttribute('tt');
		var entry = menu.appendItem();
		entry.setAttribute('value', cmdName);
		entry.setAttribute('label', cmdName);
		entry.setAttribute('tooltiptext', cmdDesc);
		
		//Console entry
		var elem = resultDiv.appendChild(document.createElementNS(XHTMLNS, 'span'));
		elem.setAttribute('class', 'row_std');
		elem.appendChild(document.createTextNode('- '));
		var cmdelem = elem.appendChild(document.createElementNS(XHTMLNS, 'a'));
		cmdelem.setAttribute("href", "javascript:selectWebCommand('"+ cmdName + "')");
		cmdelem.appendChild(document.createTextNode(cmdName));
		elem.appendChild(document.createTextNode(' ' + cmdDesc));
		elem.appendChild(document.createElementNS(XHTMLNS, 'br'));
	}
}


function doClose()
{ 
	return true; 
}