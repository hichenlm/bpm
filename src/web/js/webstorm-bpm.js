(function(_global) {

_global.wsbpm = wsbpm;

var _selectedTool;
var _selectedNodes = [];
var _selectedConnection;
var _canvas;
var _paper;
var _grapic;
var _gridLines;
var _canvasOffset;
var _showConnections = true;
var _allNodes = wsbpm.allNodes = [];
var _drawArrowContext;
var _viewPortOffset = Pos(0, 0);
var _processConfig = {name: "未命名流程"};

var DEFAULT_TOOL = "select";
var CANVAS_WIDTH = 5000;
var CANVAS_HEIGHT = 5000;
var CANVER_CELL_LENGTH = 20;
var CANVAS_DEFAULT_FONT_FAMILY = "Microsoft YaHei";
var CANVAS_DEFAULT_FONT_SIZE = "12px";

var ARROW_LENGTH = 8.0;
var ARROW_HEIGHT = 4.0;
var POINTER_RADIUS = 8.0;
var DEFAULT_DELAY = 60;
var POINT_WIDTH = 8.0;
var POINT_HEIGHT = 8.0;
var ENABLE_DRAG_SMOOTHLY = true;
var MIN_LINE_ANGLE = Math.PI / 180 * 5;

$(document).ready(function() {
  initToolbox();
  initCanvas();
  initToolbar();
});

// namespace
function wsbpm() {}

/* -- utilities -- */
function mousePosition(event) {
  return Pos(event.pageX - _canvasOffset.left,
             event.pageY - _canvasOffset.top).offset(_viewPortOffset.x, _viewPortOffset.y);
}

function Pos(x, y) {
  if (!(this instanceof Pos)) {
	return new Pos(x, y);
  }

  this.x = x;
  this.y = y;
}

function showAlertBox(message) {
  bootbox.dialog({
    message: message,
    className: "wsbpm-alert",
    buttons: {
      success: {
         label: "确定"
       }
    }
  });
}

Pos.prototype.offset = function(dx, dy) {
  return Pos(this.x + dx, this.y + dy);
};

Pos.prototype.toString = function() {
  return "[" + this.x + "," + this.y + "]";
};

Pos.prototype.toArray = function() {
  return [this.x, this.y];
};

Pos.prototype.equals = function(pos) {
  return pos != null && this.x == pos.x && this.y == pos.y;
};

Pos.prototype.rotate = function(dr) {
  if (dr == 0) {
    return this;
  }
  var r = Math.atan2(this.y, this.x);
  var l = Math.sqrt(this.x * this.x + this.y * this.y);
  var r2 = r + dr;
  var y = Math.sin(r2) * l;
  var x = Math.cos(r2) * l;
  return Pos(x, y);
};

Pos.prototype.toObject = function() {
  return {x: this.x, y: this.y};
};

function middlePoint(s, t) {
  return Pos((s.x + t.x) / 2, (s.y + t.y) / 2);
}

// TODO
function dragSmoothly(elem, dragMove, dragStart, dragEnd, delay) {
  function onstart(x, y, nativeEvent) {
    dragStart(x, y, nativeEvent);
  }

  function domove() {
    if (ctx.dpos.equals(ctx.lastdpos)) return;
    ctx.lastdpos = ctx.dpos;
    dragMove(ctx.dpos.x, ctx.dpos.y, ctx.pos.x, ctx.pos.y, ctx.nativeEvent);
  };

  function onmove(dx, dy, x, y, nativeEvent) {
    if (!ctx) {
      ctx = {intervalID: setInterval(domove, 30)};
      ctx.dpos = Pos(dx, dy);
      ctx.pos = Pos(x, y);
      ctx.nativeEvent = nativeEvent;
      domove();
    }
    ctx.dpos = Pos(dx, dy);
    ctx.pos = Pos(x, y);
    ctx.nativeEvent = nativeEvent;
  }

  function onend(nativeEvent) {
    if (ctx) {
      clearInterval(ctx.intervalID);
      domove();
    }
    dragEnd(nativeEvent);
    ctx = null;
  }

  var ctx;
  delay = delay || DEFAULT_DELAY;

  if (!ENABLE_DRAG_SMOOTHLY) {
    elem.drag(dragMove, dragStart, dragEnd);
  }

  elem.drag(onmove, onstart, onend);
}

function dragSmoothlyByCase(elem, case1, functions1, case2, functions2) {
  var fns = functions1.map(function(fn1, i) {
    var fn2 = functions2[i];
    return function() {
      if (case1()) {
        fn1.apply(null, arguments);
      } else if (case2()) {
        fn2.apply(null, arguments);
      }
    };
  });
  dragSmoothly.apply(null, [elem].concat(fns));
}

function circleCrossPoint(fromPos, toPos, r) {
  var dx = toPos.x - fromPos.x;
  var dy = toPos.y - fromPos.y;
  var a = Math.atan2(dy, dx);
  return Pos(toPos.x - Math.cos(a) * r, toPos.y - Math.sin(a) * r);
}

function diamondCrossPoint(fromPos, toPos, r) {
  var dx = toPos.x - fromPos.x;
  var dy = toPos.y - fromPos.y;
  var ax = Math.abs(dx);
  var ay = Math.abs(dy);
  var a = ax + ay;
  var m = (r * ax) / a;
  var n = (r * ay) / a;
  if (dx > 0) m = -m;
  if (dy > 0) n = -n;
  return Pos(toPos.x + m, toPos.y + n);
}

function unSelectAll() {
  selectNodes([]);
  selectConnection(null);
}

function select(type, content) {
  unSelectAll();
  if (type == "nodes") {
    selectNodes(content);
  } else if (type == "connection") {
    selectConnection(content);
  }
}

function notify(position, type, message) {
  $('#notification-' + position).notify({
    type: type,
    message: message
  }).show();
}

wsbpm.notify = notify;

function updateProcessName(name) {
  name = name || "未命名流程";
  $(".wsbpm-top-process-name").text(name);
  document.title = "业务流程设计 - " + name;
}

function getState(obj) {
  if (obj.state) {
    return obj.state;
  }

  var ext;
  if (obj.config.extensions) {
    ext = _.find(obj.config.extensions, function(ext) {
      return ext.id == "state";
    });
  }
  return ext ? ext.value : "default";
}

function getFontColorByState(state) {
  if (state == "executed") {
    return "#0a8008";
  } else if (state == "waiting"){
    return "#93a296";
  } else if (state == "running"){
    return "#a90e2f";
  } else {
    return "black";
  }
}

// copy from stack-overflow
function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) == variable) {
      return decodeURIComponent(pair[1]);
    }
  }
  return null;
}

/* -- toolbox -- */
function initToolbox(){
  $(".wsbpm-tool-button").click(function(){
    var toolName = this.id.replace(/^btn-/, "");
    selectTool(toolName);
  });
  $(".wsbpm-tool-button img").mousedown(function(event){
    event.preventDefault();
  });

  selectTool(DEFAULT_TOOL);
}

function selectTool(toolName) {
  function getToolByName(toolName) {
    return $("#btn-" + toolName);
  }

  if (_selectedTool == toolName) {
    return;
  }

  if (_selectedTool) {
    getToolByName(_selectedTool).removeClass("wbpm-tool-selected");
  }

  _selectedTool = toolName;
  getToolByName(toolName).addClass("wbpm-tool-selected");

  unSelectAll();

  if (_canvas) {
    _canvas.toggleClass("wsbpm-not-allowed", isConnectionTool());
    _canvas.toggleClass("wsbpm-grab", isMoveCanvasTool());
  }
}

function isTaskTool() {
  return /-task$/.test(_selectedTool);
}

function isGatewayTool() {
  return /-gateway/.test(_selectedTool);
}

function isNodeTool() {
  return isTaskTool() || isGatewayTool();
}

function isSelectionTool() {
  return _selectedTool == "select";
}

function isConnectionTool() {
  return _selectedTool == "connecting-line";
}

function isMoveCanvasTool() {
  return _selectedTool == "move-canvas";
}

/* -- toolbar -- */
function initToolbar() {
  var showGridLines = true;

  $(".wsbpm-toolbar .btn").click(function() {
    this.blur();
  });

  $("#btn-delete").click(function(event) {
    if (!isSelectionTool()) return;

    var nodes = _selectedNodes;

    if (_selectedNodes.length > 0) {
      var eventNodes = _.filter(_selectedNodes, function(node) {
        return node.category == "event";
      });

      if (eventNodes.length > 0) {
        _.each(eventNodes, function(node) {
          notify("top-right", "danger", "不能删除" + (node.type == "start" ? "开始" : "结束") + "节点" );
        });
        return;
      }

      unSelectAll();
      _allNodes = wsbpm.allNodes = _.difference(_allNodes, nodes);
      _.invoke(nodes, "remove");
    } else if (_selectedConnection != null) {
      _selectedConnection.remove();
      _selectedConnection = null;
      unSelectAll();
    }
  });

  $("#btn-halign").click(function(event) {
    if (!isSelectionTool()) return;

    if (_selectedNodes.length > 1) {
      var leftMostNode = _.min(_selectedNodes, function(node) {
        return node.pos.x;
      });

      _.each(_selectedNodes, function(node) {
        node.moveTo(Pos(node.pos.x, leftMostNode.pos.y));
      });
    }
  });

  $("#btn-valign").click(function(event) {
    if (!isSelectionTool()) return;

    if (_selectedNodes.length > 1) {
      var topMostNode = _.min(_selectedNodes, function(node) {
        return node.pos.y;
      });

      _.each(_selectedNodes, function(node) {
        node.moveTo(Pos(topMostNode.pos.x, node.pos.y));
      });
    }
  });

  // $("#checkbox-show-grid-lines").change(function(event){
  //   var b = $(this).prop("checked");
  //   if (b) {
  //     _gridLines.show();
  //   } else {
  //     _gridLines.hide();
  //   }
  // });

  $("#checkbox-show-grid-lines, #checkbox-show-connections").bootstrapSwitch();

  $("#checkbox-show-grid-lines").on('switchChange.bootstrapSwitch', function(event, state) {
    if (state) {
      _gridLines.show();
    } else {
      _gridLines.hide();
    }
    this.blur();
  });

  $("#checkbox-show-connections").on('switchChange.bootstrapSwitch', function(event, state) {
    _showConnections = state;
    _.invoke(allConnections(), "repaint");
    this.blur();
  });

  $("#btn-group-scale > ul > li > a").click(function() {
    var text = $(this).text();
    $("#scale-text").val(text);
    var scale = parseFloat(text) / 100;
    scaleCanvas(scale);
  });

  $("#btn-save").click(function() {
    var s = JSON.stringify({"id": id,
                            "process-config": _processConfig,
                            nodes: _.invoke(_allNodes, "toObject"),
                            connections: _.invoke(allConnections(), "toObject"),
                            fields: wsbpm.getAllFields()});
    var id = getQueryVariable("def");
    if (id) {
      var s = JSON.stringify({"id": id,
                              "process-config": _processConfig,
                              nodes: _.invoke(_allNodes, "toObject"),
                              connections: _.invoke(allConnections(), "toObject"),
                              fields: wsbpm.getAllFields()});
      //window.localStorage.setItem("wsbpm" + window.location.search, s);
      var url = "bpm-service/save-bp-def?" + $.param({id: id});
      $.post(url, s, function(data, textStatus) {
        if (textStatus == "success") {
          notify("top-right", "success", "流程信息已保存");
        } else {
          notify("top-right", "danger", "流程信息保存失败：" + textStatus);
        }
      }, "text");
    }
  });
}

/* -- node -- */
function selectNodes(nodes) {
  _.invoke(_selectedNodes, "highlight", false);
  _.invoke(nodes, "highlight", true);
  _selectedNodes = nodes;
}

function Node(category, type, config) {
  config = config || {};
  this.category = category;
  this.type = type;
  this.config = config;
  this.id = _.uniqueId();
  this.inConns = [];
  this.outConns = [];
}

var NODE_PAINT_FNS = {
  gateway: paintGateway,
  task: paintTask,
  event: paintEvent
};

Node.prototype.paint = function() {
  var text = this.config.name || "";

  var paintFn = NODE_PAINT_FNS[this.category];
  $.extend(this, paintFn(this.type, getState(this)));
  this.pos = this.ipos;

  this.bgGroup = _paper.set();
  this.bgGroup.push(this.bgElement);

  this.textBgElement = _paper.rect(0, 0, 0, 0, 5).attr({
    "fill": "#E4E7EF",
     "stroke-width": 0
  });
  this.bgGroup.push(this.textBgElement);
  this.group.push(this.textBgElement);

  var tpos = this.tpos;
  this.textElement = _paper.text(tpos.x, tpos.y, "").attr({
    'text-anchor': 'middle',
    "font-family": CANVAS_DEFAULT_FONT_FAMILY,
    "font-size": CANVAS_DEFAULT_FONT_SIZE,
    "fill": getFontColorByState(getState(this))
  });
  this.group.push(this.textElement);
  this.setText(text);

  this.highlighted = true;
  this.highlight(false);

  this.stateDisplay = $("<div class='wsbpm-node-state'>");
  this.stateDisplay.appendTo(_canvas);

  return this;
};

Node.prototype.activate = function (){
  function moveNodesStart(x, y, nativeEvent) {
    $.Event(nativeEvent).stopPropagation();
  }

  function moveNodesMove(dx, dy, x, y, nativeEvent) {
    if (movingNodes.length == 0) {
      if (!_.contains(_selectedNodes, thisNode)) {
        select("nodes", [thisNode]);
      }

      movingNodes = _.invoke(_selectedNodes, "copy");
    }

    _canvas.addClass("wsbpm-move");
    _.each(movingNodes, function(node) {
      node.moveTo(node.original.pos.offset(dx ,dy));
    });
  }

  function moveNodesEnd(nativeEvent) {
    if (!isSelectionTool()) return;

    _canvas.removeClass("wsbpm-move");
    if (movingNodes.length > 0) {
      _.each(movingNodes, function(node) {
        node.original.moveTo(node.pos);
        node.remove();
      });
      movingNodes = [];
    }
  }

  function arrowStart(x, y, nativeEvent) {
    $.Event(nativeEvent).stopPropagation();
    if (thisNode.canConnectOut()) {
      _drawArrowContext = {ipos: mousePosition(nativeEvent),
                           startNode: thisNode};
    }
  }

  function arrowMove(dx, dy, x, y, nativeEvent) {
    var ctx = _drawArrowContext;
    if (!ctx) return;

    if (ctx.arrow) {
      ctx.arrow.remove();
    }

    var l = Math.sqrt(dx * dx + dy * dy);
    if (l > ARROW_LENGTH + 4) {
      var toPos = circleCrossPoint(ctx.ipos, ctx.ipos.offset(dx, dy), POINTER_RADIUS);
      ctx.arrow = paintArrow([ctx.ipos, toPos]);
    }
  }

  function arrowEnd(nativeEvent) {
    var ctx = _drawArrowContext;
    if (!ctx) return;

    if (ctx.arrow) {
      ctx.arrow.remove();
    }

    if (ctx.startNode && ctx.endNode) {
      ctx.startNode.connectTo(ctx.endNode);
    }
    _drawArrowContext = null;
  }

  function on_dialog_close(data) {
    if (data != null) {
      thisNode.config = data;
      thisNode.setText(data.name);
    }
  }

  var thisNode = this;
  var movingNodes = [];

  this.group.hover(function() {
    var ctx = _drawArrowContext;
    if (isConnectionTool()) {
      //_canvas.addClass("wsbpm-allowed");
      if (ctx == null || ctx.startNode == null) {
        _canvas.toggleClass("wsbpm-allowed", thisNode.canConnectOut());
      } else {
        var b = thisNode.canConnectIn() && ctx.startNode != thisNode;
        _canvas.toggleClass("wsbpm-allowed", b);
        if (b) {
          ctx.endNode = thisNode;
        }
      }
    }
  }, function() {
    if (isConnectionTool()) {
      _canvas.removeClass("wsbpm-allowed");
      var ctx = _drawArrowContext;
      if (ctx && ctx.endNode == thisNode) {
        ctx.endNode = null;
      }
    }
  });

  dragSmoothlyByCase(this.group,
                     isSelectionTool, [moveNodesMove, moveNodesStart, moveNodesEnd],
                     isConnectionTool, [arrowMove, arrowStart, arrowEnd]);

  this.group.click(function(nativeEvent) {
    if (!isSelectionTool()) return;
    $.Event(nativeEvent).stopPropagation();

    select("nodes", [thisNode]);
  });

  this.group.dblclick(function(nativeEvent) {
    if (!isSelectionTool()) return;
    $.Event(nativeEvent).stopPropagation();

    select("nodes", [thisNode]);
    if (thisNode.category == "task") {
      var dialog = thisNode.type == "human" ? wsbpm.humanTaskDialog : wsbpm.serviceTaskDialog;
      dialog.show(thisNode.config, on_dialog_close, thisNode.isStartHumanTask());
    } else if (thisNode.category == "event") {
      wsbpm.eventDialog.show(thisNode.config, on_dialog_close, thisNode.type);
    } else if (thisNode.category == "gateway") {
      wsbpm.gatewayDialog.show(thisNode.config, on_dialog_close);
    }
  });

  return this;
};

Node.prototype.highlight = function(b) {
  if (this.highlighted == b) {
    return this;
  }

  this.highlighted = b;
  if (b) {
    this.bgGroup.show();
  } else {
    this.bgGroup.hide();
  }

  return this;
};

Node.prototype.moveTo = function(pos) {
  if (this.pos.equals(pos)) {
    return this;
  }
  this.pos = pos;
  this.group.transform(['T', pos.x - this.ipos.x, pos.y - this.ipos.y]);

  _.invoke(this.inConns, "repaint");
  _.invoke(this.outConns, "repaint");

  if (this.stateDisplay) {
    this.stateDisplay.css({left: (this.pos.x + 15) + "px",
                           top: (this.pos.y - 30) + "px"});

    if (getState(this) == "running") {
      this.stateDisplay.html("<i class='fa fa-refresh fa-spin'>");
    }
  }
  return this;
};

Node.prototype.setText = function(text) {
  this.textElement.attr("text", text);

  var w, h;
  if (text.length == 0) {
    w = h = 0;
  } else {
    var bbox = this.textElement.getBBox();
    w = bbox.width + 8;
    h = bbox.height + 4;
  }

  var bg = this.textBgElement;
  bg.attr({
    x: this.tpos.x - w / 2,
    y: this.tpos.y - h / 2,
    width: w,
    height: h
  });
  return this;
};

Node.prototype.copy = function() {
  var node = new Node(this.category, this.type).paint().moveTo(this.pos);
  node.original = this;
  return node;
};

Node.prototype.remove = function() {
  this.removed = true;
  this.group.remove();
  _.invoke(this.inConns, "remove");
  _.invoke(this.outConns, "remove");
  return this;
};

Node.prototype.connectTo = function(node) {
  var connection = new Connection(this, node);
  this.outConns.push(connection);
  node.inConns.push(connection);
  return this;
};

Node.prototype.canConnectOut = function() {
  if (this.category == "event" && this.type == "end") {
    return false;
  } else if ((this.category == "event" && this.type == "start") || this.category == "task") {
    return this.outConns.length == 0;
  } else if (this.category == "gateway") {
    return this.inConns.length < 2 || this.outConns.length < 2;
  }
  return false;
};

Node.prototype.canConnectIn = function() {
  if (this.category == "event" && this.type == "start") {
    return false;
  } else if ((this.category == "event" && this.type == "end") || this.category == "task") {
    return true;
  } else if (this.category == "gateway") {
    return this.outConns.length < 2;
  }
  return false;
};

Node.prototype.isStartHumanTask = function() {
  if (!wsbpm.isHumanTaskNode(this)) {
    return false;
  }

  return _.some(this.inConns, function(conn) {
    return conn.fromNode.category == "event" && conn.fromNode.type == "start";
  });
};

Node.prototype.toObject = function() {
  return {id: this.id,
          category: this.category,
          type: this.type,
          config: this.config,
          pos: this.pos.toObject(),
          inConns: _.pluck(this.inConns, "id"),
          outConns: _.pluck(this.outConns, "id")};
};

/* -- connection -- */
function Connection(fromNode, toNode, ipoints, highlighted, active) {
  this.fromNode = fromNode;
  this.toNode = toNode;
  this.highlighted = highlighted || false;
  this.ipoints = ipoints || [];
  this.active = active !== false;
  this.config = {};
  this.id = _.uniqueId();

  this.repaint();
}

Connection.prototype.repaint = function () {
  function paintPoint(pos, index, append) {
    function dragStart(x, y, nativeEvent) {
      if (!isSelectionTool()) return;

      context = {startPos: mousePosition(nativeEvent),
                 moved:false};
    }

    function dragMove(dx, dy, x, y, nativeEvent) {
      if (!isSelectionTool()) return;

      var c = thisConnection;
      var mc = context.movingConection;
      _canvas.addClass("wsbpm-move");
      c.ipoints.splice(index, append ? 0 : 1, context.startPos.offset(dx, dy));
      append = false;
      if (!mc) {
        thisConnection.group.hide();
        context.movingConection = new Connection(c.fromNode, c.toNode, c.ipoints, c.highlighted, false);
      } else {
        mc.repaint(); // mc share ipoints with c
      }
    }

    function dragEnd(nativeEvent) {
      if (!isSelectionTool()) return;

      var c = thisConnection;
      var mc = context.movingConection;
      if (mc) {
        mc.remove();
        c.checkIPoint(index);
        thisConnection.repaint();
      }
      _canvas.removeClass("wsbpm-move");
      context = null;
    }

    var x = pos.x - POINT_WIDTH / 2;
    var y = pos.y - POINT_HEIGHT / 2;
    var point = _paper.rect(x, y, POINT_WIDTH, POINT_HEIGHT).attr({
      stroke: "#1C77A4",
      "stroke-width": 2,
      fill: "#ffffff",
      "fill-opacity": 0.4
    });
    group.push(point);

    var context;

    dragSmoothly(point, dragMove, dragStart, dragEnd);
  }

  function on_dialog_close(data) {
    if (data != null) {
      thisConnection.config = data;
      thisConnection.repaint();
    }
  }

  var thisConnection = this;
  var fromNode = this.fromNode;
  var toNode = this.toNode;
  var fromPos, toPos;
  var mpoint;
  var i;

  if (this.group) {
    this.group.remove();
  }

  if (!_showConnections) {
    return;
  }

  if (!this.highlighted) {
    this.checkIPoints();
  }

  var fn = fromNode.category == "gateway" ? diamondCrossPoint : circleCrossPoint;
  var t = _.first(this.ipoints) || toNode.pos;
  fromPos = fn(t, fromNode.pos, fromNode.radius + 2);
  fn = (toNode.category == "gateway" ? diamondCrossPoint : circleCrossPoint);
  var s = _.last(this.ipoints) || fromNode.pos;
  toPos = fn(s, toNode.pos, toNode.radius + 3);

  var group = this.group = _paper.set();
  var points = _.flatten([fromPos, this.ipoints, toPos]);
  var state = this.highlighted ? "highlighted" : getState(this);
  group.push(paintArrow(points, state));

  if (this.highlighted) {
    _.each(this.ipoints, function(pos, i){
      paintPoint(pos, i, false);
    });

    if (this.active) {
      for(i = 0; i < points.length - 1; i++) {
        s = points[i];
        t = points[i + 1];
        var m = middlePoint(s, t);
        paintPoint(m, i, true);
      }
    }
  }

  if (this.config.name) {
    i = points.length / 2;
    if (points.length % 2 == 0) {
      i--;
      mpoint = middlePoint(points[i], points[i + 1]);
    } else {
      i = Math.floor(i);
      mpoint = points[i];
    }

    group.push(_paper.text(mpoint.x, mpoint.y + 15, this.config.name).attr({
      'text-anchor': 'middle',
      "font-family": CANVAS_DEFAULT_FONT_FAMILY,
      "font-size": CANVAS_DEFAULT_FONT_SIZE,
      "fill": getFontColorByState(getState(this))
    }));
  }

  if (this.active) {
    group.mousedown(function(nativeEvent) {
      if (!isSelectionTool()) return;
      $.Event(nativeEvent).stopPropagation();
    });

    group.click(function(nativeEvent){
      if (!isSelectionTool()) return;
      $.Event(nativeEvent).stopPropagation();
      select("connection", thisConnection);
    });

    group.hover(function() {
      if (!isSelectionTool()) return;
      _canvas.addClass("wsbpm-pointer");
    }, function() {
      if (!isSelectionTool()) return;
      _canvas.removeClass("wsbpm-pointer");
    });

    group.dblclick(function(nativeEvent) {
      if (!isSelectionTool()) return;
      $.Event(nativeEvent).stopPropagation();

      select("connection", thisConnection);
      wsbpm.connectionDialog.show(thisConnection.config, on_dialog_close);
    });
  }
  return this;
};

Connection.prototype.remove = function() {
  this.removed = true;
  this.group.remove();
  if (this.active) {
    this.fromNode.outConns = _.without(this.fromNode.outConns, this);
    this.toNode.inConns = _.without(this.toNode.inConns, this);
  }
  return this;
};

Connection.prototype.highlight = function(b) {
  if (this.highlighted == b) {
    return this;
  }
  this.highlighted = b;
  return this.repaint();
};

Connection.prototype.checkIPoint = function(i) {
  var ipoints = this.ipoints;
  var s = ipoints[i - 1] || this.fromNode.pos;
  var m = ipoints[i];
  var t = ipoints[i + 1] || this.toNode.pos;
  var a = Math.atan2(m.y - s.y, m.x - s.x);
  var b = Math.atan2(t.y - m.y, t.x - m.x);
  if (Math.abs(a - b) < MIN_LINE_ANGLE) {
    ipoints.splice(i, 1);
    return true;
  }
  return false;
};

Connection.prototype.checkIPoints = function() {
  var ipoints = this.ipoints;
  for(var i = 0; i < ipoints.length; i++) {
    if (this.checkIPoint(i)){
      continue;
    }
  }
};

Connection.prototype.toObject = function() {
  return {id: this.id,
          fromNode: this.fromNode.id,
          toNode: this.toNode.id,
          ipoints: _.invoke(this.ipoints, "toObject"),
          config: this.config};
};

function selectConnection(conn) {
  if (_selectedConnection) _selectedConnection.highlight(false);
  _selectedConnection = conn;
  if (_selectedConnection) _selectedConnection.highlight(true);
};

function allConnections() {
  var nodes = _allNodes;
  var inConns = _.union.apply(null, _.pluck(nodes, "inConns"));
  var outConns = _.union.apply(null, _.pluck(nodes, "outConns"));
  return _.union(inConns, outConns);
}

/* -- canvas -- */
function initCanvas() {
  function selectStart(x, y, nativeEvent) {
    dcontext = {startPos: mousePosition(nativeEvent)};
  }

  function selectMove(dx, dy, x, y, nativeEvent){
    var s = dcontext.startPos;
    if (dcontext.sbox) {
      selectionBox.show();
      selectionBox.toFront();
    }
    var sbox = dcontext.sbox = {
      x: (dx < 0 ? s.x + dx: s.x),
      y: (dy < 0 ? s.y + dy: s.y),
      width: Math.abs(dx),
      height: Math.abs(dy)
    };
    var x2 = sbox.x + sbox.width;
    var y2 = sbox.y + sbox.height;
    selectionBox.attr(sbox);
    var nodes = _.filter(_allNodes, function(node){
      var pos = node.pos;
      return (pos.x >= sbox.x && pos.x <= x2
              && pos.y >= sbox.y && pos.y <= y2);
    });
    select("nodes", nodes);
    _selectedNodes.preserve = true;
  }

  function selectEnd(nativeEvent) {
    dcontext = null;
    selectionBox.hide();
  }

  function moveCanvasStart(x, y, nativeEvent) {
    dcontext = {ioffset: _viewPortOffset};
    _canvas.addClass("wsbpm-grabbing");
    $(document.body).addClass("wsbpm-grabbing");
  }

  function moveCanvasMove(dx, dy, x, y, nativeEvent) {
    var of = dcontext.ioffset.offset(-dx, -dy);
    if (of.x < 0) of.x = 0;
    if (of.y < 0) of.y = 0;
    _viewPortOffset = of;
    _grapic.css({
      left: - of.x + "px",
      top: - of.y + "px"
    });
    //_paper.setViewBox(of.x, of.y, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  function moveCanvasEnd(nativeEvent) {
    dcontext = null;
    _canvas.removeClass("wsbpm-grabbing");
    $(document.body).removeClass("wsbpm-grabbing");
  }

  _paper = Raphael('wsbpm-canvas', CANVAS_WIDTH, CANVAS_HEIGHT);

  var draggingNode;
  var dcontext;
  var canvas = _canvas = $("#wsbpm-canvas");
  _grapic = $("#wsbpm-canvas > *");
  _grapic.css({position : "relative"});
  _canvasOffset = canvas.offset();

  var selectionBox = _paper.rect(0, 0, 0, 0).attr({
    fill: "rgb(102, 102, 102)",
    "fill-opacity": 0.1,
    "stroke-width": 0
  });
  selectionBox.hide();

  _gridLines = paintGridLines(CANVAS_WIDTH, CANVAS_HEIGHT, CANVER_CELL_LENGTH);

  loadBP();

  // if (_allNodes.length == 0) {
  // }

  //_allNodes.push(new Node("task", "human", "人工任务1").moveTo(Pos(200, 80)).activate());
  //_allNodes.push(new Node("gateway", "exclusive", "单一路由1").moveTo(Pos(300, 80)).activate());
  //paintArrow([Pos(20, 40), Pos(40, 20)]);

  canvas.mouseenter(function(event){
    if (!isNodeTool()) return;

    var m = /^(\w+)-(gateway|task)$/.exec(_selectedTool);
    var node;
    if (m) {
      node = new Node(m[2], m[1]).paint().moveTo(mousePosition(event));
      $(this).addClass("wsbpm-none");
    }
    draggingNode = node;
  });

  canvas.mousemove(function(event) {
    if (isNodeTool() && draggingNode) {
      draggingNode.moveTo(mousePosition(event));
    }
  });

  canvas.click(function(event){
    var node = draggingNode;

    if (isNodeTool() && draggingNode) {
      draggingNode = null;
      node.moveTo(mousePosition(event));
      selectTool(DEFAULT_TOOL);
      $(this).removeClass("wsbpm-none");

      if (node.category == "task") {
        var dialog = node.type == "human" ? wsbpm.humanTaskDialog : wsbpm.serviceTaskDialog;
        dialog.show(node.config, function(data) {
          if (data) {
            node.config = data;
            node.setText(data.name);
            _allNodes.push(node.activate());
          } else {
            node.remove();
          }
        });
      } else {
        _allNodes.push(node.activate());
      }
    } else if (isSelectionTool()) {
      if (_selectedNodes.preserve) {
        _selectedNodes.preserve = false;
      } else {
        unSelectAll();
      }
    }
  });

  canvas.mouseleave(function() {
    if (isNodeTool() && draggingNode) {
      draggingNode.remove();
      draggingNode = null;
      $(this).removeClass("wsbpm-move");
    }
  });

  canvas.dblclick(function(nativeEvent) {
    if (!isSelectionTool()) return;
    $.Event(nativeEvent).stopPropagation();

    wsbpm.processDialog.show(_processConfig, function(data) {
      if (data != null) {
        updateProcessName(data.name);
        _processConfig = data;
      }
    });
  });

  var elem = $.extend({
    node: canvas.get()[0],
    paper: _paper
  }, Raphael.el);

  dragSmoothlyByCase(elem,
                     isSelectionTool, [selectMove, selectStart, selectEnd],
                     isMoveCanvasTool, [moveCanvasMove, moveCanvasStart, moveCanvasEnd]);
}

function loadBP() {
  var id = getQueryVariable("def");
  var from;
  if (id != null) {
    from = "def";
  } else {
    id = getQueryVariable("instance");
    if (id != null) {
      from = "instance";
    }
  }

  if (from == null) {
    _allNodes.push(new Node("event", "start", {name: "开始"}).paint().moveTo(Pos(80, 80)).activate());
    _allNodes.push(new Node("event", "end", {name: "结束"}).paint().moveTo(Pos(400, 80)).activate());
    return;
  }

  $.getJSON("bpm-service/load-bp?" + $.param({from: from, id: id}), function(o, textStatus) {
    if (o["process-config"]) {
      _processConfig = o["process-config"];
      updateProcessName(_processConfig.name);
    }

    var allNodesMap = {};
    _allNodes = wsbpm.allNodes = _.map(o.nodes, function(n) {
      var node = new Node(n.category, n.type, n.config);
      node.id = n.id;
      node.state = n.state;
      node.paint().moveTo(Pos(n.pos.x, n.pos.y));
      node.inConns = n.inConns;
      node.outConns = n.outConns;
      allNodesMap[node.id] = node;
      return node;
    });

    var allConnsMap = {};
    _.each(o.connections, function(c) {
      var ipoints = _.map(c.ipoints, function(o) {
        return Pos(o.x, o.y);
      });

      var connection = new Connection(allNodesMap[c.fromNode], allNodesMap[c.toNode], ipoints);
      connection.id = c.id;
      connection.config = c.config;
      connection.state = c.state;
      connection.repaint();
      allConnsMap[c.id] = connection;
    });

    _.each(_allNodes, function(node) {
      node.inConns = _.map(node.inConns, function(id) {
        return allConnsMap[id];
      });
      node.outConns = _.map(node.outConns, function(id) {
        return allConnsMap[id];
      });
      node.activate();
    });
  });
}

function scaleCanvas(scale) {
  _paper.setViewBox(0, 0, CANVAS_WIDTH / scale , CANVAS_HEIGHT / scale);
}

function paintGridLines(canvasWidth, canvasHeight, length) {
  var group = _paper.set();
  var darkLineWidth = 0.7;
  var darkLineColor = "#D5DFD7";
  var lightLineWidth = 0.3;
  var lightLineColor = "#DDE6E0";

  var y = length * 2;
  while ( y < canvasHeight) {
    var pathString = "M0," + y + "H" + canvasWidth;
    group.push(_paper.path(pathString).attr({
      "fill": "none",
      "stroke": darkLineColor,
      "stroke-width": darkLineWidth
    }));
    y += length * 2;
  }

  y = length * 1;
  while ( y < canvasHeight) {
    pathString = "M0," + y + "H" + canvasWidth;
    group.push(_paper.path(pathString).attr({
      "fill": "none",
      "stroke": lightLineColor,
      "stroke-width": lightLineWidth
    }));
    y += length * 2;
  }

  var x = length * 2;
  while ( x < canvasWidth) {
    pathString = "M" + x + "," + 0 + "V" + canvasHeight;
    group.push(_paper.path(pathString).attr({
      "fill": "none",
      "stroke": darkLineColor,
      "stroke-width": darkLineWidth
    }));
    x += length * 2;
  }

  x = length * 1;
  while ( x < canvasWidth) {
    pathString = "M" + x + "," + 0 + "V" + canvasHeight;
    group.push(_paper.path(pathString).attr({
      "fill": "none",
      "stroke": lightLineColor,
      "stroke-width": lightLineWidth
    }));
    x += length * 2;
  }

  return group;
}

function paintEvent(type, state) {
  var paintFn;
  if (type == 'start') {
    paintFn = paintStartEvent;
  } else if (type == 'end') {
    paintFn = paintEndEvent;
  }

  return paintFn(state);
}

function paintStartEvent() {
  var x = 0, y = 0;
  var r = 15;
  var group = _paper.set();

  var bg = _paper.circle(x, y, r + 5).attr({
    "fill": "#E2E6ED",
    "stroke-width": 0
  });
  group.push(bg);

  group.push(_paper.circle(x, y, r).attr({
    "fill": "r(0.1,0.1)#ffffff-#9acd32",
    "stroke": "#000000",
    "stroke-width": "1"
  }));

  return {group: group,
          ipos: Pos(x, y),
          tpos: Pos(x, y + r + 18),
          bgElement: bg,
          radius: r};
}

function paintEndEvent(state) {
  var x = 0, y = 0;
  var r = 15;
  var group = _paper.set();

  var bg = _paper.circle(x, y, r + 7).attr({
    "fill": "#E2E6ED",
    "stroke-width": 0
  });
  group.push(bg);

  group.push(_paper.circle(x, y, r).attr({
    "fill": state == "waiting" ? "r(0.1, 0.1)#ffffff-#505852" : "r(0.1,0.1)#ffffff-#ff6347",
    "stroke": state == "waiting" ? "#8f968e" : "#000000",
    "stroke-width": state == "waiting" ? "2" : "3"
  }));

  return {group: group,
          ipos: Pos(x, y),
          tpos: Pos(x, y + r + 18),
          bgElement: bg,
          radius: r};
}

function paintGateway(type, state) {
  var color, bgColor, borderColor;

  function paintExclusiveGateway(){
    var group = _paper.set();
    group.push(_paper.path('M11.2,21.8L22,11').attr({
      "stroke": color,
      "stroke-width": 3,
      fill: 'none'
    }));
    group.push(_paper.path('M11,11.2L21.8,22').attr({
      "stroke": color,
      "stroke-width": 3,
      fill: 'none'
    }));
    return group;
  };

  function paintParallelGateway(){
    var group = _paper.set();
    group.push(_paper.path('M 9,16.4 24.2,16.4').attr({
      "stroke": color,
      "stroke-width": 3,
      fill: 'none'
    }));
    group.push(_paper.path('M 16.4,9 16.4,24.2').attr({
      "stroke": color,
      "stroke-width": 3,
      fill: 'none'
    }));
    return group;
  }

  function paintInclusiveGateway() {
    return _paper.circle(16.4, 16.4, 7.8).attr({
      "stroke": color,
      "stroke-width": 2.5,
      fill: 'none'
    });
  }

  if (state == "waiting") {
    color = "#6f766f";
    bgColor = "0-#ffffff-#cfe0ce";
    borderColor = "#8f968e";
  } else if (state == "executed") {
    color = "#255e24";
    bgColor = "#D3EF7E";
    borderColor = "#224d21";
  } else {
    color = "#a67f00";
    bgColor = "0-#ffffff-#f0e68c";
    borderColor = "#a67f00";
  }

  var group = _paper.set();

  var bg = _paper.path("M-7,16.6L16.6-7L39,16.6L16.6,39L-7,16.6z").attr({
    "fill": "#E2E6ED",
    "stroke-width": 0
  });
  group.push(bg);

  group.push(_paper.path('M0,16.4L16.4,0L32,16.4L16.4,32L0,16.4z').attr({
    "stroke": borderColor,
    "stroke-width": 1,
    fill: bgColor
  }));

  var paintFn;
  if (type == "exclusive") {
    paintFn = paintExclusiveGateway;
  } else if (type == "inclusive") {
    paintFn = paintInclusiveGateway;
  } else if (type == "parallel") {
    paintFn = paintParallelGateway;
  }
  group.push(paintFn(state));

  return {group: group,
          ipos: Pos(16.4, 16.4),
          tpos: Pos(16.4, 49.4),
          bgElement: bg,
          radius: 16.4};
}

function paintTask(type, state) {
  var paintFn;
  if (type == "human") {
    paintFn = paintHumanTask;
  } else if (type == "service") {
    paintFn = paintServiceTask;
  }
  return paintFn(state);
}

function paintHumanTask(state) {
  var group = _paper.set();
  var ipos = Pos(23.7, 16.7);

  var bg = _paper.circle(ipos.x, ipos.y, 16.6 + 5).attr({
    "fill": "#E2E6ED",
    "stroke-width": 0
  });
  group.push(bg);

  var color, borderColor;

  if (state == "waiting") {
    color = "#cfe0ce";
    borderColor = "#8f968e";
  } else if (state == "running") {
    color = "r(0.1, 0.1)#ffffff-#ef7186";
    borderColor = "#e10b2e";
  } else {
    color = "r(0.1, 0.1)#ffffff-#D3EF7E";
    borderColor = "#99B646";
  }

  group.push(_paper.circle(ipos.x, ipos.y, 16.6).attr({
    "fill": color,
    "stroke": borderColor,
    "stroke-width": "2"
  }));

  var contentColor = (state == "running" ? "#580311" : "#547422");
  group.push(_paper.path("M35.1,11.3c-0.3-0.4-1-0.5-1.4-0.1L31,13.4l-1.3-3.1c0-0.1-0.1-0.2-0.2-0.3c-0.3-0.6-0.7-1.1-1.3-1.3\
		                c-0.3-0.1-0.5-0.2-0.8-0.2c-0.1,0-0.1-0.1-0.2-0.1L22.4,7c-0.3-0.1-0.5,0-0.8,0.1c-0.3,0.1-0.5,0.3-0.6,0.6l-1.8,4.6\
		                c-0.2,0.5,0.1,1.1,0.6,1.3c0.5,0.2,1.1-0.1,1.3-0.6l1.5-3.9l2.2,0.6c-0.1,0.1-0.1,0.2-0.2,0.3l-2.8,6.1c0,0.1-0.1,0.2-0.1,0.3\
		                l-3.4,5.7L12.6,24c-0.6,0.5-0.8,1.4-0.3,2c0.5,0.6,1.4,0.8,2,0.3l5.8-2c0.2-0.1,0.3-0.3,0.4-0.5c0.1-0.1,0.2-0.1,0.2-0.2l2-3.4\
		                l3.6,3.1l-3.9,4.3c-0.5,0.6-0.5,1.5,0.1,2.1c0.6,0.5,1.5,0.5,2.1-0.1l4.8-5.4c0.1-0.2,0.2-0.4,0.3-0.6c0-0.1,0-0.2,0-0.3\
		                c0-0.1,0-0.1,0-0.2c0-0.4-0.2-0.8-0.5-1.1l-3.3-2.8c0.2-0.2,0.4-0.5,0.6-0.8l2.1-4.7l0.7,1.8c0,0.2,0.1,0.3,0.2,0.5\
		                c0.1,0.1,0.2,0.2,0.4,0.3c0,0,0,0,0,0c0.1,0,0.2,0.1,0.3,0.1c0.1,0,0.2,0,0.3,0c0,0,0,0,0,0c0,0,0.1,0,0.1,0\
		                c0.2-0.1,0.3-0.2,0.4-0.3l3.9-3.3C35.6,12.3,35.4,11.7,35.1,11.3z").attr({
                          fill: contentColor
                        }));
  group.push(_paper.circle(30.1, 6.2, 2.7).attr({
    fill: contentColor
  }));

  return {group: group,
          ipos: ipos,
          tpos: Pos(23.7, 50),
          bgElement: bg,
          radius: 16.6};
}

function paintServiceTask(state) {
  var group = _paper.set();
  var ipos = Pos(37.3, 27.1);

  var color, bgColor, borderColor;
  if (state == "waiting") {
    color = "#108025";
    bgColor = 'r(0.5,0.5)#ffffff-#cfe0ce';
    borderColor = "#8f968e";
  } else if (state == "executed") {
    color = "#306F8D";
    bgColor = 'r(0.5,0.5)#ffffff-#D3EF7E';
    borderColor = "#14ae31";
  } else {
    color = "#306F8D";
    bgColor = 'r(0.5,0.5)#ffffff-#C6E7FD';
    borderColor = "#7ECCEC";
  }

  var bg = _paper.circle(ipos.x, ipos.y, 16.6 + 5).attr({
    "fill": "#E2E6ED",
    "stroke-width": 0
  });
  group.push(bg);

  group.push(_paper.circle(ipos.x, ipos.y, 16.6).attr({
    "fill": bgColor,
    "stroke": borderColor,
    "stroke-width": "2"
  }));

  group.push(_paper.path("M48.8,28.5v-2.9l-3.1-0.5c-0.2-0.9-0.6-1.8-1.1-2.6l1.8-2.6l-2-2l-2.6,1.8c-0.8-0.5-1.7-0.9-2.6-1.1l-0.5-3.1h-2.9l-0.5,3.1\
	                    c-0.9,0.2-1.8,0.6-2.6,1.1l-2.6-1.8l-2,2l1.8,2.6c-0.5,0.8-0.9,1.7-1.1,2.6l-3.1,0.5v2.9l3.1,0.5c0.2,0.9,0.6,1.8,1.1,2.6l-1.8,2.6\
	                    l2,2l2.6-1.8c0.8,0.5,1.7,0.9,2.6,1.1l0.5,3.1h2.9l0.5-3.1c0.9-0.2,1.8-0.6,2.6-1.1l2.6,1.8l2-2l-1.8-2.6c0.5-0.8,0.9-1.7,1.1-2.6\
	                    L48.8,28.5z M37.3,32.9c-3.2,0-5.8-2.6-5.8-5.8s2.6-5.8,5.8-5.8c3.2,0,5.8,2.6,5.8,5.8S40.4,32.9,37.3,32.9z").attr({
                          fill: color
                        }));

  return {group: group,
          ipos: ipos,
          tpos: Pos(37.3, 59),
          bgElement: bg,
          radius: 16.6};
}

/* -- arrow -- */
var ARROW_STATE_COLORS = {
  "executed": "#2fec2b",
  "highlighted": "#1A1AFF",
  "waiting": "#8f968e",
  "default": "#000000"
};

function paintArrow(pa, state) {
  function ts(pos) {
    return pos.rotate(angle).offset(s.x, s.y);
  }

  function ps(arr) {
    return _.flatten(['M', _.invoke(arr, "toArray")]);
  }

  var color = ARROW_STATE_COLORS[state || "default"];
  var s = pa[pa.length - 2];
  var t = pa[pa.length - 1];;
  var dx = t.x - s.x;
  var dy = t.y - s.y;
  var l = Math.sqrt(dx * dx + dy * dy);
  var angle = Math.atan2(dy, dx);
  var aLen = ARROW_LENGTH;
  var aHeight = ARROW_HEIGHT;

  var m = ts(Pos(l - aLen, 0));
  var a = ts(Pos(l - aLen, -aHeight));
  var b = ts(Pos(l, 0));
  var c = ts(Pos(l - aLen, aHeight));

  var group = _paper.set();
  group.push(_paper.path(ps(pa)).attr({
    "stroke-width": 10,
    "stroke-opacity": 0
  }));

  pa[pa.length - 1] = m;
  group.push(_paper.path(ps(pa)).attr({
    "stroke-width": state == "highlighted" ? 2 : 1,
    "stroke": color
  }));
  group.push(_paper.path(ps([a, b, c, a])).attr({
    fill: color,
    "stroke-width": 0
  }));

  group.toBack();

  return group;
}

})(this);
