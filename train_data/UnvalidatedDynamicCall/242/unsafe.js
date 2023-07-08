var palette = null;

//functions return number from 0 to (maxIter-1)
var fractalFunctions = {
    'julia': function(cx, cy, maxIter, cr, ci) {
        var iter, xn, yn, x = cx, y = cy;
        for (iter = 0; iter < maxIter; iter++) {
            xn = x*x - y*y + cr;
            yn = (x*y)*2 + ci;
            if (xn*xn + yn*yn > 4) {
                break;
            }
            x = xn;
            y = yn;
        }
        
        return iter;
    }
}

var commands = {
    palette: function(data, cb) {
        palette = new Uint32Array(data.palette);
    },
    render: function(data,cb) {
        if (!palette) {
            cb();
            return;
        };
        
        var scale = Math.pow(2, data.z - 1);
        var x0 = data.x / scale - 1;
        var y0 = data.y / scale - 1;
        var d = 1/(scale<<8);
        var pixels = new Array(65536);
        var MAX_ITER=data.maxIter;
        var c,cx,cy,iter,i=0,px,py;
        
        var debugIter = [];
        
        while (i < 65536) {
            px = i%256;
            py = (i-px)>>8;
            cx = x0 + px*d;
            cy = y0 + py*d;    
            iter = fractalFunctions[data.type](cx, cy, MAX_ITER, data.cr, data.ci);
            pixels[i++] = palette[iter];
        }
        var array = new Uint32Array(pixels);
        data.pixels = array.buffer;
        cb(data,[data.pixels]);
    }
}

function callBack(a,b){
    self.postMessage(a,b);
}

self.onmessage=function(e){
	var commandName = e.data.command;
	commands[commandName](e.data, callBack);
};