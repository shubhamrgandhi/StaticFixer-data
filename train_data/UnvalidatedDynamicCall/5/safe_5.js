var Page=new function(){
			var t=this;
			var _code=0;
			var handle={};
			
			window.onmessage=function(e){
				var d=e.data;
				if(d && d.m && window[d.m]){
					window[d.m](d.d);
					return;
				}
				if(d&&d.code){
					callHandle(d.code,d.d);
				}
			}
			
			function getCode(){
				return ++_code;
			}
			
			function regHandle(cb){
				var code=getCode();
				handle[code]=cb;
				return code;
			}
			function callHandle(code,data){
				if(handle[code]){
					handle[code](data);
					delete handle[code];
				}
			}
			
			t.send=function(method,data,cb){
				var d={
					m:method,
					d:data,
					code:0
				}
				if(cb){
					d.code=regHandle(cb);
				}
				top.postMessage(d, "*");
			}
		};