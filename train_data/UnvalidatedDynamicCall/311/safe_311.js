(function(){for(var t={defaultSettings:{url:"https://demo.chevereto.com/upload",vendor:"auto",mode:"auto",lang:"auto",autoInsert:"bbcode-embed-medium",palette:"default",init:"onload",containerClass:1,buttonClass:1,sibling:0,siblingPos:"after",fitEditor:0,observe:0,observeCache:1,html:'<div class="%cClass"><button %x class="%bClass"><span class="%iClass">%iconSvg</span><span class="%tClass">%text</span></button></div>',css:".%cClass{display:inline-block;margin-top:5px;margin-bottom:5px}.%bClass{line-height:normal;-webkit-transition:all .2s;-o-transition:all .2s;transition:all .2s;outline:0;color:%2;border:none;cursor:pointer;border:1px solid rgba(0,0,0,.15);background:%1;border-radius:.2em;padding:.5em 1em;font-size:12px;font-weight:700;text-shadow:none}.%bClass:hover{background:%3;color:%4;border-color:rgba(0,0,0,.1)}.%iClass,.%tClass{display:inline-block;vertical-align:middle}.%iClass svg{display:block;width:1em;height:1em;fill:currentColor}.%tClass{margin-left:.25em}"},ns:{plugin:"chevereto-pup"},palettes:{default:["#ececec","#333","#2980b9","#fff"],clear:["inherit","inherit","inherit","#2980b9"],turquoise:["#16a085","#fff","#1abc9c","#fff"],green:["#27ae60","#fff","#2ecc71","#fff"],blue:["#2980b9","#fff","#3498db","#fff"],purple:["#8e44ad","#fff","#9b59b6","#fff"],darkblue:["#2c3e50","#fff","#34495e","#fff"],yellow:["#f39c12","#fff","#f1c40f","#fff"],orange:["#d35400","#fff","#e67e22","#fff"],red:["#c0392b","#fff","#e74c3c","#fff"],grey:["#ececec","#000","#e0e0e0","#000"],black:["#333","#fff","#666","#fff"]},classProps:["button","container"],iconSvg:'<svg class="%iClass" xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M76.7 87.5c12.8 0 23.3-13.3 23.3-29.4 0-13.6-5.2-25.7-15.4-27.5 0 0-3.5-0.7-5.6 1.7 0 0 0.6 9.4-2.9 12.6 0 0 8.7-32.4-23.7-32.4 -29.3 0-22.5 34.5-22.5 34.5 -5-6.4-0.6-19.6-0.6-19.6 -2.5-2.6-6.1-2.5-6.1-2.5C10.9 25 0 39.1 0 54.6c0 15.5 9.3 32.7 29.3 32.7 2 0 6.4 0 11.7 0V68.5h-13l22-22 22 22H59v18.8C68.6 87.4 76.7 87.5 76.7 87.5z" style="fill: currentcolor;"/></svg>',l10n:{ar:"تحميل الصور",cs:"Nahrát obrázky",da:"Upload billeder",de:"Bilder hochladen",es:"Subir imágenes",fi:"Lataa kuvia",fr:"Importer des images",id:"Unggah gambar",it:"Carica immagini",ja:"画像をアップロード",nb:"Last opp bilder",nl:"Upload afbeeldingen",pl:"Wyślij obrazy",pt_BR:"Enviar imagens",ru:"Загрузить изображения",tr:"Resim Yukle",uk:"Завантажити зображення",zh_CN:"上传图片",zh_TW:"上傳圖片"},vendors:{default:{check:function(){return 1},getEditor:function(){var t={textarea:{name:["recaptcha","search","recipients","coppa","^comment_list","username_list","add"]},ce:{dataset:["gramm"]}},e=["~","|","^","$","*"],i={};for(var s in t){i[s]="";var n=t[s];for(var r in n)for(var o=0;o<n[r].length;o++){var a="",l=n[r][o],d=l.charAt(0);e.indexOf(d)>-1&&(a=d,l=l.substring(1)),i[s]+=":not(["+("dataset"==r?"data-"+l:r+a+'="'+l+'"')+"])"}}return document.querySelectorAll('[contenteditable=""]'+i.ce+',[contenteditable="true"]'+i.ce+",textarea:not([readonly])"+i.textarea)}},bbpress:{settings:{autoInsert:"html-embed-medium",html:'<input %x type="button" class="ed_button button button-small" aria-label="%text" value="%text">',sibling:"#qt_bbp_reply_content_img",siblingPos:"before"},check:"bbpEngagementJS"},discourse:{settings:{autoInsert:"markdown-embed-medium",html:'<button %x title="%text" class="upload btn no-text btn-icon ember-view"><i class="fa fa-cloud-upload d-icon d-icon-upload"></i></button>',sibling:".upload.btn",siblingPos:"before",observe:".create,#create-topic,.usercard-controls button",observeCache:0,onDemand:1},check:"Discourse"},discuz:{settings:{buttonClass:1,html:'<a %x title="%text" class="%bClass">%iconSvg</a>',sibling:".fclr,#e_attach",css:"a.%bClass,.bar a.%bClass{box-sizing:border-box;cursor:pointer;background:%1;color:%2;text-indent:unset;position:relative}.b1r a.%bClass:hover,a.%bClass:hover{background:%3;color:%4}a.%bClass{font-size:14px}.b1r a.%bClass{border:1px solid rgba(0,0,0,.15)!important;font-size:20px;padding:0;height:44px}.%bClass svg{font-size:1em;width:1em;height:1em;-webkit-transform:translate(-50%,-50%);-ms-transform:translate(-50%,-50%);transform:translate(-50%,-50%);position:absolute;left:50%;top:50%;fill:currentColor}",palette:"purple"},palettes:{default:["transparent","#333","#2980b9","#fff"]},check:"DISCUZCODE",getEditor:function(){return document.querySelector('.area textarea[name="message"]')}},ipb:{settings:{autoInsert:"html-embed-medium",html:'<a %x class="cke_button cke_button_off %bClass" title="%text" tabindex="-1" hidefocus="true" role="button"><span class="cke_button_icon">%iconSvg</span><span class="cke_button_label" aria-hidden="false">%text</span><span class="cke_button_label" aria-hidden="false"></span></a>',sibling:".cke_button__ipslink",siblingPos:"before",css:".cke_button.%bClass{background:%1;position:relative}.cke_button.%bClass:hover{background:%3;border-color:%5}.cke_button.%bClass svg{font-size:15px;width:1em;height:1em;-webkit-transform:translate(-50%,-50%);-ms-transform:translate(-50%,-50%);transform:translate(-50%,-50%);position:absolute;left:50%;top:50%;fill:%2}.cke_button.%bClass:hover svg{fill:%4}"},palettes:{default:["inherit","#444","","inherit"]},check:"ips",getEditorFn:function(){var t=this.getEditor().dataset.ipseditorName;return CKEDITOR.instances[t]},getEditor:function(){return document.querySelector("[data-ipseditor-name]")},editorValue:function(t){var e=CKEDITOR.dom.element.createFromHtml("<p>"+t+"</p>");this.getEditorFn().insertElement(e)},useCustomEditor:function(){return 1}},mybb:{settings:{sibling:"#quickreply_e > tr > td > *:last-child, .sceditor-container",fitEditor:0,extracss:".trow2 .%cClass{margin-bottom:0}"},check:"MyBB",getEditor:function(){return MyBBEditor?MyBBEditor.getContentAreaContainer().parentElement:document.querySelector("#quickreply_e textarea")},editorValue:function(t){if(MyBBEditor){var e=MyBBEditor.inSourceMode()?"insert":"wysiwygEditorInsertHtml";MyBBEditor[e]("insert"==e?t:MyBBEditor.fromBBCode(t))}else this.getEditor().value+=t},useCustomEditor:function(){return!!MyBBEditor}},nodebb:{settings:{autoInsert:"markdown-embed-medium",html:'<li %x tabindex="-1" title="%text"><i class="fa fa-cloud-upload"></i></li>',sibling:'[data-format="picture-o"]',siblingPos:"before",observe:'[component="category/post"],[component="topic/reply"],[component="topic/reply-as-topic"],[component="post/reply"],[component="post/quote"]',observeCache:0,onDemand:1},check:"__nodebbSpamBeGoneCreateCaptcha__",callback:function(){for(var t=document.querySelectorAll(".btn-toolbar .img-upload-btn"),e=0;e<t.length;e++)t[e].parentNode.removeChild(t[e])}},phpbb:{settings:{html:document.querySelector("#format-buttons *:first-child")&&"BUTTON"==document.querySelector("#format-buttons *:first-child").tagName?' <button %x type="button" class="button button-icon-only" title="%text"><i class="icon fa-cloud-upload fa-fw" aria-hidden="true"></i></button> ':' <input %x type="button" class="button2" value="%text"> ',sibling:document.querySelector("#format-buttons *:first-child")&&"BUTTON"==document.querySelector("#format-buttons *:first-child").tagName?".bbcode-img":"#message-box textarea.inputbox",siblingPos:"after"},check:"phpbb",getEditor:function(){if("undefined"!=typeof form_name&&"undefined"!=typeof text_name)return document.forms[form_name].elements[text_name]}},proboards:{settings:{html:' <input %x type="submit" value="%text"> ',css:"",sibling:"input[type=submit]",siblingPos:"before"},check:"proboards",editorValue:function(t){var e=$(".wysiwyg-textarea").data("wysiwyg"),i=e.editors[e.currentEditorName];i.setContent(i.getContent()+t)},useCustomEditor:function(){return 1!==$(".container.quick-reply").size()},getEditor:function(){return document.querySelector("textarea[name=message]")}},redactor2:{getEditor:function(){var t=this.getEditorFn();return t?this.useCustomEditor()?t.$box[0]:t[0]:null},getEditorEl:function(){return this.useCustomEditor()?this.getEditorFn().$editor[0]:this.getEditorFn()[0]},editorValue:function(t){var e="<p><br></p>",i=this.useCustomEditor()?"innerHTML":"value";if("string"!=typeof t){var s=this.getEditorEl()[i];return this.useCustomEditor()&&"<p><br></p>"==s?"":this.getEditorEl()[i]}if(this.useCustomEditor()){var n="<p>"+t+"</p>";this.getEditorFn().insert.html(""!==this.editorValue()?e+n:n)}else this.getEditorEl()[i]=t},useCustomEditor:function(){return!(this.getEditorFn()instanceof jQuery)}},smf:{settings:{html:' <button %x title="%text" class="%bClass"><span class="%iClass">%iconSvg</span><span class="%tClass">%text</span></button> ',css:"%defaultCSS #bbcBox_message .%bClass{margin-right:1px;transition:none;color:%2;padding:0;width:23px;height:21px;border-radius:5px;background-color:%1}#bbcBox_message .%bClass:hover{background-color:%3}#bbcBox_message .%tClass{display:none}",sibling:"#BBCBox_message_button_1_1,.quickReplyContent + div",siblingPos:"before",fitEditor:1},palettes:{default:["#E7E7E7","#333","#B0C4D6","#333"]},check:"smf_scripturl",getEditor:function(){return smf_editorArray.length>0?smf_editorArray[0].oTextHandle:document.querySelector(".quickReplyContent textarea")}},quill:{settings:{autoInsert:"html-embed-medium",html:'<li class="richEditor-menuItem richEditor-menuItem_f1af88yq" role="menuitem"><button %x class="richEditor-button richEditor-embedButton richEditor-button_f1fodmu3" type="button" aria-pressed="false"><span class="richEditor-iconWrap_f13bdese"></span>%iconSvg</button></li>',sibling:"ul.richEditor-menuItems li.richEditor-menuItem:last-child",css:".%iClass {display: block; height: 24px; margin: auto; width: 24px;}"},check:"quill",editorValue:function(t){quill.clipboard.dangerouslyPasteHTML("\n"==quill.getText()?0:quill.getLength(),t)},useCustomEditor:function(){return 1},getEditor:function(){return quill.container}},vanilla:{settings:{autoInsert:"markdown-embed-medium",html:'<span %x class="icon icon-cloud-upload" title="%text"></span>',sibling:".editor-dropdown-upload"},check:"Vanilla",getEditor:function(){return document.getElementById("Form_Body")}},vbulletin:{settings:{autoInsert:"html-embed-medium",html:'<li %x class="%bClass b-toolbar__item b-toolbar__item--secondary" title="%text" tabindex="0">%iconSvg</li>',sibling:".b-toolbar__item--secondary:first-child",siblingPos:"before",css:".%bClass{background:%1;color:%2;position:relative}.%bClass:hover{background:%3;color:%4;border-color:%5}.%bClass svg{font-size:15px;width:1em;height:1em;-webkit-transform:translate(-50%,-50%);-ms-transform:translate(-50%,-50%);transform:translate(-50%,-50%);position:absolute;left:50%;top:50%;fill:currentColor}"},palettes:{default:["","#4B6977","","#007EB8"]},check:"vBulletin",getEditorFn:function(){var t=this.getEditor().getAttribute("ck-editorid");return CKEDITOR.instances[t]},getEditor:function(){return document.querySelector("[data-message-type]")},editorValue:function(t){var e=CKEDITOR.dom.element.createFromHtml("<p>"+t+"</p>");this.getEditorFn().insertElement(e)},useCustomEditor:function(){return 1}},WoltLab:{settings:{autoInsert:"html-embed-medium",sibling:'li[data-name="settings"]',html:'<li %x><a><span class="icon icon16 fa-cloud-upload"></span> <span>%text</span></a></li>'},check:"WBB",getEditorFn:function(){var t=$("#text").data("redactor");return t||null}},XF1:{settings:{autoInsert:"html-embed-medium",containerClass:1,buttonClass:1,html:'<li class="%cClass"><a %x class="%bClass" unselectable="on" title="%text">%iconSvg</a></li>',sibling:".redactor_btn_container_image",siblingPos:"before",css:"li.%cClass .%bClass{background:%1;color:%2;text-indent:unset;border-radius:3px;position:relative}li.%cClass a.%bClass:hover{background:%3;color:%4;border-color:%5}.%cClass .%bClass svg{font-size:15px;width:1em;height:1em;-webkit-transform:translate(-50%,-50%);-ms-transform:translate(-50%,-50%);transform:translate(-50%,-50%);position:absolute;left:50%;top:50%;fill:currentColor}",observe:".edit.OverlayTrigger",observeCache:1},palettes:{default:["none","inherit","none","inherit",""]},check:"XenForo",getEditorFn:function(){var t=document.querySelector("#exposeMask")&&document.querySelector("#exposeMask").offsetParent?".xenOverlay form":"form";if("form"!==t)for(var e=document.querySelectorAll(t),i=0;i<e.length;i++)if(e[i].offsetParent){t+='[action="'+e[i].getAttribute("action")+'"]';break}return XenForo.getEditorInForm(t)},getEditor:function(){var t=this.getEditorFn();return t?this.useCustomEditor()?t.$box[0]:t[0]:null},getEditorEl:function(){return this.useCustomEditor()?this.getEditorFn().$editor[0]:this.getEditorFn()[0]},editorValue:function(t){var e="<p><br></p>",i=this.useCustomEditor()?"innerHTML":"value";if("string"!=typeof t){var s=this.getEditorEl()[i];return this.useCustomEditor()&&"<p><br></p>"==s?"":this.getEditorEl()[i]}if(this.useCustomEditor()){var n="<p>"+t+"</p>";this.getEditorFn().insertHtml(""!==this.editorValue()?e+n:n)}else this.getEditorEl()[i]=t},useCustomEditor:function(){return!(this.getEditorFn()instanceof jQuery)}},XF2:{settings:{autoInsert:"html-embed-medium",containerClass:1,buttonClass:"button--link js-attachmentUpload button button--icon button--icon--upload fa--xf",html:'<div class="formButtonGroup"><div class="formButtonGroup-extra"><button type="button" tabindex="-1" role="button" title="%text" class="%bClass" %x><span class="button-text">%text</span></button></div></div>',sibling:"",siblingPos:"after",observe:'[data-xf-click="quick-edit"]',observeCache:1},palettes:{default:["transparent","#505050","rgba(20,20,20,0.06)","#141414"]},check:"XF",getEditorFn:function(t){var e=".js-editor";return"string"==typeof t&&(e=this.getEditorSel(t)),XF.getEditorInContainer($(e))},getEditorSel:function(e){return"["+t.ns.dataPluginTarget+'="'+e+'"]'},getEditor:function(t){return"string"==typeof t?document.querySelector(this.getEditorSel(t)):document.querySelectorAll(".js-editor")},getBbCode:function(t){return t.getTextArea()[0].value},editorValue:function(t,e){var i="<p><br></p>",s=this.getEditorFn(e),n=s.ed.bbCode.isBbCodeView()?["bbCode","getBbCode","insertBbCode"]:["html","get","insert"],r=s.ed[n[0]];if("string"!=typeof t){if(void 0===r[n[1]])var o=this.getBbCode(r);else o=r[n[1]]();return this.useCustomEditor()&&o==i?"":o}var a=""!==this.editorValue(!1,e);if("html"==n[0]){var l="<p>"+t+"</p>";r[n[2]](a?i+l:l)}else{var d=XF.ajax("POST",XF.canonicalizeUrl("index.php?editor/to-bb-code"),{html:t});d.done(function(t){r[n[2]](a?"\n"+t.bbCode:t.bbCode)})}},useCustomEditor:function(){return void 0!==XF.getEditorInContainer($(".js-editor"))}}},generateGuid:function(){var t=(new Date).getTime();return"undefined"!=typeof performance&&"function"==typeof performance.now&&(t+=performance.now()),"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(e){var i=(t+16*Math.random())%16|0;return t=Math.floor(t/16),("x"===e?i:3&i|8).toString(16)})},getNewValue:function(t,e){var i="string"!=typeof t.getAttribute("contenteditable")?"value":"innerHTML",s="value"==i?"\n":"<br>",n=t[i],r=e,o=!1;if(o&&(r=String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")),0==n.length)return r;var a="",l=n.match(/\n+$/g),d=l?l[0].split("\n").length:0;if(d<=2){var u=0==d?2:1;a+=s.repeat(u)}return a+r},insertTrigger:function(){var t,e=this.vendors[this.settings.vendor],i=this.settings.sibling?document.querySelectorAll(this.settings.sibling+":not(["+this.ns.dataPlugin+"])")[0]:0;if("auto"==this.settings.mode)t=this.vendors[e.hasOwnProperty("getEditor")?this.settings.vendor:"default"].getEditor();else{for(var s=document.querySelectorAll("["+this.ns.dataPluginTrigger+"][data-target]:not(["+this.ns.dataPluginId+"])"),n=[],r=0;r<s.length;r++)n.push(s[r].dataset.target);n.length>0&&(t=document.querySelectorAll(n.join(",")))}if(t){if(!document.getElementById(this.ns.pluginStyle)&&this.settings.css){var o=document.createElement("style"),a=this.settings.css;a=this.appyTemplate(a),o.type="text/css",o.innerHTML=a.replace(/%p/g,"."+this.ns.plugin),o.setAttribute("id",this.ns.pluginStyle),document.body.appendChild(o)}t instanceof NodeList||(t=[t]);var l=0;for(r=0;r<t.length;r++)if(!t[r].getAttribute(this.ns.dataPluginTarget)){var d=i||t[r];d.setAttribute(this.ns.dataPlugin,"sibling"),d.insertAdjacentHTML({before:"beforebegin",after:"afterend"}[this.settings.siblingPos],this.appyTemplate(this.settings.html));var u=d.parentElement.querySelector("["+this.ns.dataPluginTrigger+"]");this.setBoundId(u,t[r]),l++}this.triggerCounter=l,"function"==typeof e.callback&&e.callback.call()}},appyTemplate:function(t){if(!this.cacheTable){var e=[{"%iconSvg":this.iconSvg},{"%text":this.settings.langString}];if(this.palette){for(var i=/%(\d+)/g,s=i.exec(t),n=[];null!==s;)-1==n.indexOf(s[1])&&n.push(s[1]),s=i.exec(t);if(n){n.sort(function(t,e){return e-t});this.vendors[this.settings.vendor];for(var r=0;r<n.length;r++){var o=n[r]-1,a=this.palette[o]||"";a||"default"===this.settings.vendor||"default"===this.settings.palette||(a=this.palette[o-2]);var l={};l["%"+n[r]]=a,e.push(l)}}}var d=this.settings.buttonClass||this.ns.plugin+"-button",u=[{"%cClass":this.settings.containerClass||this.ns.plugin+"-container"},{"%bClass":d},{"%iClass":d+"-icon"},{"%tClass":d+"-text"},{"%x":this.ns.dataPluginTrigger},{"%p":this.ns.plugin}];for(r=0;r<u.length;r++)e.push(u[r]);this.cacheTable=e}return this.strtr(t,this.cacheTable)},strtr:function(t,e){t=t.toString();if(!t||void 0===e)return t;for(var i=0;i<e.length;i++){var s=e[i];for(var n in s)void 0!==s[n]&&(re=new RegExp(n,"g"),t=t.replace(re,s[n]))}return t},setBoundId:function(t,e){var i=this.generateGuid();t.setAttribute(this.ns.dataPluginId,i),e.setAttribute(this.ns.dataPluginTarget,i)},openPopup:function(t){if("string"==typeof t){var e=this;if(void 0===this.popups&&(this.popups={}),void 0===this.popups[t]){this.popups[t]={};var i={l:null!=window.screenLeft?window.screenLeft:screen.left,t:null!=window.screenTop?window.screenTop:screen.top,w:window.innerWidth?window.innerWidth:document.documentElement.clientWidth?document.documentElement.clientWidth:screen.width,h:window.innerHeight?window.innerHeight:document.documentElement.clientHeight?document.documentElement.clientHeight:screen.height},s={w:720,h:690},n={w:.5,h:.85};for(var r in s)s[r]/i[r]>n[r]&&(s[r]=i[r]*n[r]);var o={l:Math.trunc(i.w/2-s.w/2+i.l),t:Math.trunc(i.h/2-s.h/2+i.t)};this.popups[t].window=window.open(this.settings.url,t,"width="+s.w+",height="+s.h+",top="+o.t+",left="+o.l),this.popups[t].timer=window.setInterval(function(){e.popups[t].window&&!1===e.popups[t].window.closed||(window.clearInterval(e.popups[t].timer),e.popups[t]=void 0)},200)}else this.popups[t].window.focus()}},postSettings:function(t){this.popups[t].window.postMessage({id:t,settings:this.settings},this.settings.url)},liveBind:function(t,e,i){document.addEventListener(e,function(e){var s=document.querySelectorAll(t);if(s){for(var n=e.target,r=-1;n&&-1===(r=Array.prototype.indexOf.call(s,n));)n=n.parentElement;r>-1&&(e.preventDefault(),i.call(e,n))}},!0)},prepare:function(){var t=this;this.ns.dataPlugin="data-"+this.ns.plugin,this.ns.dataPluginId=this.ns.dataPlugin+"-id",this.ns.dataPluginTrigger=this.ns.dataPlugin+"-trigger",this.ns.dataPluginTarget=this.ns.dataPlugin+"-target",this.ns.pluginStyle=this.ns.plugin+"-style",this.ns.selDataPluginTrigger="["+this.ns.dataPluginTrigger+"]";var e=document.currentScript||document.getElementById(this.ns.plugin+"-src");e?e.dataset.buttonTemplate&&(e.dataset.html=e.dataset.buttonTemplate):e={dataset:{}};var i=0;for(var s in this.settings={},this.defaultSettings){var n=e&&e.dataset[s]?e.dataset[s]:this.defaultSettings[s];"1"!==n&&"0"!==n||(n="true"==n),"string"==typeof n&&this.classProps.indexOf(s.replace(/Class$/,""))>-1&&(i=1),this.settings[s]=n}if("auto"==this.settings.vendor)for(var s in this.settings.vendor="default",this.settings.fitEditor=0,this.vendors)if("default"!=s&&void 0!==window[this.vendors[s].check]){this.settings.vendor=s;break}var r=["lang","url","vendor","target"];"default"==this.settings.vendor&&(this.vendors.default.settings={});var o=this.vendors[this.settings.vendor];if(o.settings)for(var s in o.settings)e&&e.dataset.hasOwnProperty(s)||(this.settings[s]=o.settings[s]);else for(var s in o.settings={},this.defaultSettings)-1==r.indexOf(s)&&(o.settings[s]=this.defaultSettings[s]);if("default"!==this.settings.vendor)if(o.settings.hasOwnProperty("fitEditor")||e.dataset.hasOwnProperty("fitEditor")||(this.settings.fitEditor=1),this.settings.fitEditor)i=!o.settings.css;else{r=["autoInsert","observe","observeCache"];for(var s in o.settings)-1!=r.indexOf(s)||e.dataset.hasOwnProperty(s)||(this.settings[s]=this.defaultSettings[s])}if(i)this.settings.css="";else{this.settings.css=this.settings.css.replace("%defaultCSS",this.defaultSettings.css),o.settings.extracss&&this.settings.css&&(this.settings.css+=o.settings.extracss);var a=this.settings.palette.split(",");a.length>1?this.palette=a:this.palettes.hasOwnProperty(a)||(this.settings.palette="default"),this.palette||(this.palette=(this.settings.fitEditor&&o.palettes&&o.palettes[this.settings.palette]?o:this).palettes[this.settings.palette])}for(var l=this.classProps,d=0;d<l.length;d++){var u=l[d]+"Class";"string"!=typeof this.settings[u]&&(this.settings[u]=this.ns.plugin+"-"+l[d],this.settings.fitEditor&&(this.settings[u]+="--"+this.settings.vendor))}var c=("auto"==this.settings.lang?navigator.language||navigator.userLanguage:this.settings.lang).replace("-","_");this.settings.langString="Upload images";var g=c in this.l10n?c:c.substring(0,2)in this.l10n?c.substring(0,2):null;g&&(this.settings.langString=this.l10n[g]);var h=document.createElement("a");h.href=this.settings.url,this.originUrlPattern="^"+(h.protocol+"//"+h.hostname).replace(/\./g,"\\.").replace(/\//g,"\\/")+"$";var f=document.querySelectorAll(this.ns.selDataPluginTrigger+"[data-target]");if(f.length>0)for(d=0;d<f.length;d++){var p=document.querySelector(f[d].dataset.target);this.setBoundId(f[d],p)}if(this.settings.observe){var b=this.settings.observe;this.settings.observeCache&&(b+=":not(["+this.ns.dataPlugin+"])"),this.liveBind(b,"click",function(e){e.setAttribute(t.ns.dataPlugin,1),t.observe()}.bind(this))}this.settings.sibling&&!this.settings.onDemand?this.waitForSibling():"onload"==this.settings.init?"loading"===document.readyState?document.addEventListener("DOMContentLoaded",function(e){t.init()},!1):this.init():this.observe()},observe:function(){this.waitForSibling("observe")},waitForSibling:function(t){var e=this.initialized?"insertTrigger":"init";if(this.settings.sibling)var i=document.querySelector(this.settings.sibling+":not(["+this.ns.dataPlugin+"])");else if("observe"==t&&(this[e](),this.triggerCounter))return;if(i)this[e]();else{if("complete"===document.readyState&&"observe"!==t)return;setTimeout(("observe"==t?this.observe:this.waitForSibling).bind(this),250)}},init:function(){this.insertTrigger();var t=this,e=this.vendors[this.settings.vendor];this.liveBind(this.ns.selDataPluginTrigger,"click",function(e){var i=e.getAttribute(t.ns.dataPluginId);t.openPopup(i)}),window.addEventListener("message",function(i){var s=new RegExp(t.originUrlPattern,"i");if(s.test(i.origin)||void 0!==i.data.id&&void 0!==i.data.message){var n=i.data.id;if (n && i.source === t.popups[n].window) if (i.data.requestAction && t.hasOwnProperty(i.data.requestAction)) t[i.data.requestAction](n);
else {
	var r;
	if ("default" !== t.settings.vendor) {
	if (e.hasOwnProperty("useCustomEditor") && e.useCustomEditor()) return void e.editorValue(i.data.message, n) ;

	e.hasOwnProperty("getEditor") && (r = e.getEditor());
}

	if (r || (r = document.querySelector("[" + t.ns.dataPluginTarget + '="' + n + '"]'), r)) {
	var o = null === r.getAttribute("contenteditable") ? "value" : "innerHTML";
	r[o] += t.getNewValue(r, i.data.message);
	for(var a=["blur","focus","input","change","paste"],l=0;l<a.length;l++){var d=new Event(a[l]);r.dispatchEvent(d)}
}
else alert("Target not found");
}
}},!1),this.initialized=1}},e=["WoltLab","XF1"],i=0;i<e.length;i++)t.vendors[e[i]]=Object.assign(Object.assign({},t.vendors.redactor2),t.vendors[e[i]]);t.prepare()})();