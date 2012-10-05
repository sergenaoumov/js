// ==UserScript==
// @name           Loader
// @namespase      http://gcfs.webscripty.ru/
// @description    Script Loader
// @author         Don Morani
// @include        http://*.travian.*
// ==/UserScript==

var script_link = 'http://www.jstoolbox.com/js/windows.js';
var script_js = document.createElement('script');
script_js.setAttribute('type', 'text/javascript');
script_js.setAttribute('src', script_link);
document.getElementsByTagName("head")[0].appendChild(script_js);