(function(global){

var NoEndingTag = {
  META:1, LINK:1, IMG:1, INPUT:1, BR:1, LI:1, TD:1, TR:1
};

function completeStartTag(hb) 
{
  if (hb._attrs) {
    buildAttrs(hb._buf, hb._attrs);
    hb._buf.push(">");
    hb._attrs = null;
  }  
}

function buildAttrs(buf, obj)
{
  for (var p in obj)
    buildAttr(buf, p, obj[p]);
}

function buildAttr(buf, n, v)
{
  if (v != null) {
    buf.push(" ", n);    
    buf.push("=", '"', escapeAttrValue(v), '"');
  }
}

function escapeAttrValue(s)
{
  if (_.isArray(s)) {
    return _.map(_.compact(s), escapeAttrValue).join(" "); 
  } else {
    return String(s).replace(/&<"/g,
                             function(ch) {
                               if (ch == '<') return "&lt;";
                               if (ch == '&') return "&amp;";
                               if (ch == '"') return "&quot;";
                             });
  };
}

function HTMLBuilder(){
  this._buf = [];
  this._tags = [];
  this._attrs = null;  
}

HTMLBuilder.prototype.element = function(name, attrs) {
  completeStartTag(this);
  this._attrs = {};
  this._tags.push({name: name});
  this._buf.push("<" + name);
  if (attrs)
    this.attrs(attrs);
  return this;
};

HTMLBuilder.prototype.attrs = function(obj) {
  if (!this._attrs)
    throw "IllegalStateError";

  for(var p in obj)
    this._attrs[p] = obj[p];
  
  return this;
};

HTMLBuilder.prototype.text = function(str) {
  completeStartTag(this);
  this._buf.push(
    String(str).replace(/&|</g,
                        function(ch) {
                          if (ch == '&') return "&amp;";
                          if (ch == '<') return "&lt;";
                        }));
  return this;
};

HTMLBuilder.prototype.end = function() {
  completeStartTag(this);
  var tag = this._tags.pop().name;
  if (NoEndingTag[tag.toUpperCase()] !== 1)
    this._buf.push("</", tag, ">");
  return this;
};

HTMLBuilder.prototype.transform = function(htmlae) {
  HTMLae_ToString(this, htmlae);
  return this;
};
  
HTMLBuilder.prototype.toString = function() {
  return this._buf.join("");
};

function HTMLae_ToString(hb, arr)
{
  var name = arr[0], attrs, i, standalone;

  if (typeof name != 'string')
    System._throw("TypeError", "tag name should be string");

  if (standalone = (name.substring(0, 6) != "#embed")) {
    if (name.charAt(0) == '<' && name.slice(-1) == '>') {
      name = name.slice(1, -1);
      i = name.indexOf(' ');
      if (i > 0) {
        attrs = name.substring(i + 1);
        name = name.substring(0, i);
      }
    }

    hb.element(name, attrs);
  }

  for (i = 1; i < arr.length; i++) {
    var v = arr[i];
    if (v == null)
      continue;
    if (v instanceof Array)
      HTMLae_ToString(hb, v);
    else if (typeof v == 'object') {
      hb.attrs(v);
    }
    else
      hb.text(v);
  }

  if (standalone)
    hb.end();
}

global.HTMLae = function(arr) {
  return new HTMLBuilder().transform(arr).toString();
};

})(this);
