// Add an additional function to the string prototype
if (!String.prototype.format) {
    String.prototype.format = function () {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined'
              ? args[number]
              : match
            ;
        });
    };
}

// Add an additional function to the array prototype to allow a value comparison of the two
if (!Array.prototype.equals) {
    Array.prototype.equals = function (arr) {
        // Check length first
        if (this.length != arr.length) {
            return false;
        }

        for (var i = 0; i < this.length; i++) {
            if (this[i] !== arr[i]) {
                return false;
            }
        }
        return true;
    };
}

// Utility function for creating namespaces: avoid any global variables - put them in a namespace (mood.something)
var namespace = function (name, separator, container) {
    var ns = name.split(separator || '.'),
      o = container || window,
      i,
      len;
    for (i = 0, len = ns.length; i < len; i++) {
        o = o[ns[i]] = o[ns[i]] || {};
    }
    return o;
};

// Utility function to clone an object using JSON
var clone = function (obj) {
    return JSON.parse(JSON.stringify(obj));
}