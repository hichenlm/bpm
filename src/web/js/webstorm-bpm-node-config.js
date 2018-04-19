(function(_global) {

var ae = _global.HTMLae;
var wsbpm = _global.wsbpm;
wsbpm.isHumanTaskNode = isHumanTaskNode;

ModalDialog.all = [];
var _uiSelector = new ModalDialog("modal-ui-selector");
var _serviceSelector = new ModalDialog("modal-service-selector");
var _participantSelector = new ModalDialog("modal-participant-selector");
var _extensionEditor = new ModalDialog("modal-extension-editor");
var _participantRuleEditor = new ModalDialog("modal-participant-rule-editor");
var _dataSelector = new ModalDialog("modal-data-selector");

var _uiList, _serviceList;
var _participantRules;
var _dataDict;

var _addedParticipants;
var _addedParticipantRules;

var _loadingData = false;

var TIME_LIMIT_INPUTS = [
  {name: "start-time-limit", defaultValue: false},
  {name: "time-limit-calendar", type:"radios", defaultValue:"default"},
  {name: "time-limit-policy", type:"radio", defaultValue:"fixed"},
  "timeout-hours",
  "timeout-minutes",
  {name: "timeout-email", defaultValue: true},
  {name: "time-limit-warn-policy", type: "radios", defaultValue: "fixed"},
  "warn-hours",
  "warn-minutes",
  {name: "warn-email", defaultValue: true}
];

var HUMAN_TASK_INPUTS = [
  {name: "id", instance: "task-id"},
  {name: "name", instance: "task-name"},
  {name: "ui", instance: "task-ui"},
  {name: "description", instance: "task-description"},
  {name: "allow-agent", defaultValue: true},
  {name: "set-participant-by", type: "nav", prefix: "tab-participant-", defaultValue: "bussiness-rule", parent: "human-task-participant"},
  {name: "participant-list", type: "list"},
  {name: "participant-rule-list", type: "list"},
  'allow-participant-assignment',
  "participant-task-executor",
  "participant-relative-data",
  {name: "output-data", type: "list", instance: "human-task-data-list"},
  {name: "start-work-item", defaultValue: false},
  {name: "work-item-allocation-policy", type: "radios", defaultValue: "by-operator"},
  {name: "work-item-execute-sequentially", type: "radios", defaultValue: "no"},
  {name: "work-item-complete-rule", type: "radios", defaultValue: "all"},
  "work-item-complete-count",
  "work-item-complete-percentage",
  {name: "end-undone-work-items", type: "radios", defaultValue: "no"},
  {name: "extensions", type: "list", instance: "extension-list"}
].concat(TIME_LIMIT_INPUTS);

var SERVICE_TASK_INPUTS = [
  {name: "id", instance: "service-task-id"},
  {name: "name", instance: "service-task-name"},
  {name: "service", instance: "task-service"},
  {name: "description", instance: "service-task-description"},
  {name: "output-data", type: "list", instance: "service-task-data-list"},
  {name: "extensions", type: "list", instance: "extension-list"}
];

var EVENT_INPUTS = [
  // {name: "id", instance: "event-id"},
  {name: "name", instance: "event-name"},
  {name: "description", instance: "event-description"},
  {name: "extensions", type: "list", instance: "extension-list"}
];

var GATEWAY_INPUTS = [
  {name: "name", instance: "gateway-name"},
  {name: "description", instance: "gateway-description"},
  {name: "extensions", type: "list", instance: "extension-list"}
];

var CONNECTION_INPUTS = [
  {name: "name", instance: "connection-name"},
  {name: "description", instance: "connection-description"},
  {name: "priority", instance: "connection-priority", defaultValue: "5"},
  {name: "is-default-connection",defaultValue: true},
  {name: "cond-type", instance: "connection-cond", type: "radios", defaultValue: "simple"},
  {name: "cond-variable", instance: "connection-cond-variable"},
  {name: "cond-comparator", instance: "connection-cond-comparator"},
  {name: "cond-value-is-variable", instance: "connection-cond-value-is-variable"},
  {name: "cond-value", instance: "connection-cond-value"},
  {name: "cond-complex", instance: "connection-cond-complex"},
  {name: "extensions", type: "list", instance: "extension-list"}
];

var PROCESS_INPUTS = [
  {name: "id", instance: "process-id"},
  {name: "name", instance: "process-name"},
  {name: "description", instance: "process-description"},
  {name: "extensions", type: "list", instance: "extension-list"}
].concat(TIME_LIMIT_INPUTS);

var PARTICIPANT_TYPES = {"bank": "机构", "user": "用户", "role": "角色"};

var DATA_TYPES = {
  "string": "文本",
  "number": "数字",
  "date": "日期",
  "org": "机构",
  "user": "用户",
  "rule": "角色",
  "select(qjlx)": "选项（请假类型）",
  "select(tyf)": "选项（同意否）"
};

var EXTENSION_EDITOR_KEYS = ["id", "name", "value", "note"];

var DEFAULT_MODAL_OPTIONS = {
  backdrop: "static"
};

/* -- ready -- */
$(document).ready(function() {
  getDataDict();
  getUIList();
  getUITree();
  getServiceList();
  getServiceTree();
  getParticipantTree();
  getParticipantRules();

  DataList.initAll();
  ModalDialog.initAll();

  $("#btn-ui-selector").click(function(event){
    event.preventDefault();
    _uiSelector.show(null, function(data) {
      if (data) {
        $("#task-ui").val(data);
        $("#task-ui").get(0).focus();
      }
    });
  });

  $("#btn-service-selector").click(function(event){
    event.preventDefault();
    _serviceSelector.show(null, function(data) {
      if (data) {
        $("#task-service").val(data);
        $("#task-service").get(0).focus();
      }
    });
  });

  _.each(["participant-task-executor", "participant-relative-data"], function(name) {
    $('#human-task-participant > .nav > li > a[href="#tab-' + name + '"]').on('shown.bs.tab', function () {
      var sel = document.getElementById(name);
      if (sel.options.length > 0) {
        sel.focus();
      }
    });
  });

  $("#start-time-limit").change(function() {
    var b = $(this).prop("checked");
    if (_loadingData) {
      $("#form-time-limit").toggleClass("in", b ? true : false);
    } else {
      $("#form-time-limit").collapse(b ? "show" : "hide");
    }
  });

  $("#fieldset-time-limit-policy input:radio").click(function() {
    var v = $(this).val();
    $(".time-limit-policy-fixed").prop("disabled", v != "fixed");
    $(".time-limit-policy-data").prop("disabled", v != "data");
  });

  $("#fieldset-timeout-policy input:radio").click(function() {
    var v = $(this).val();
    $(".timeout-policy-fixed").prop("disabled", v != "fixed");
    $(".timeout-policy-data").prop("disabled", v != "data");
  });

  $("#start-work-item").change(function() {
    var b = $(this).prop("checked");
    if (_loadingData) {
      $("#form-work-item").toggleClass("in", b);
    } else {
      $("#form-work-item").collapse(b ? 'show' : 'hide');
    }
  });

  $("#fieldset-work-item-complete-rule input:radio").click(function() {
    var v = $(this).val();
    var c = $("#work-item-complete-count"), p = $("#work-item-complete-percentage");

    if (v == "all") {
      c.prop("disabled", true);
      p.prop("disabled", true);
    } else if (v == 'count') {
      c.prop("disabled", false);
      p.prop("disabled", true);
    } else if (v == 'percentage') {
      c.prop("disabled", true);
      p.prop("disabled", false);
    }
  });

  $("#is-default-connection").change(function() {
    var b = $(this).prop("checked");
    var form = $("#form-connection-condition");
    if (_loadingData) {
      form.toggleClass("in", !b);
    } else {
      form.collapse(!b ? 'show' : 'hide');
    }
  });

  $("#form-connection-condition input:radio").click(function() {
    var v = $(this).val();
    $("#connection-cond-complex").prop("disabled", v == "simple");
    _.each($("#connection-simple-expression-container select"), function(sel) {
      sel.disabled = sel.options.length == 0 || v != "simple";
    });
    _.each($("#connection-simple-expression-container input"), function(input) {
      var disabled = v != "simple";
      if (input.type == "checkbox") {
        $(input).bootstrapSwitch('disabled', disabled, true);
      } else {
        input.disabled = disabled;
      }
    });
  });

  $("#connection-cond-variable").change(function() {
    var sel = document.getElementById("connection-cond-comparator");
    if (this.value) {
      var dt = _dataDict.fields[this.value];
      updateSelect(sel, getComparatorOptions(dt.type));
    } else {
      updateSelect(sel, []);
    }
    repaintCondValueCell();
  });

  $("#connection-cond-value-is-variable").bootstrapSwitch().on('switchChange.bootstrapSwitch', function() {
    repaintCondValueCell();
  });
});

/* -- utilities -- */
function deepCopy(arr) {
  return _.map(arr, _.clone);
}

function showTab(parentSelector, tabId) {
  $(parentSelector + " > ul.nav > li").each(function(){
    var href = $(this).find("a").attr("href");
    $(this).toggleClass("active", href == "#" + tabId);
  });
  $(parentSelector + " > .tab-content > .tab-pane").each(function(){
    $(this).toggleClass("in active", this.id == tabId);
  });
}

function dataTypeToString(type, isArray) {
  var s = DATA_TYPES[type];
  return isArray ? s + "数组" : s;
}

function updateSelect(sel, options, value) {
  sel.selectedIndex = -1;
  sel.options.length = 0;
  
  if (options.length == 0) {
    sel.disabled = true;
    return null;
  } else {
    sel.disabled = false;
  }

  options = _.map(options, function(opt) {
    return _.isString(opt) ? {value: opt, text: opt} : opt;
  });

  _.each(options, function(opt) {
    $(ae(['option', {value: opt.value}, opt.text])).appendTo(sel);
  });

  if (_.contains(_.pluck(options, "value"), value)) {
    sel.value = value;
    return value;
  } else {
    return null;
  }
}

function setSelectValue(sel, value) {
  var b = _.some(sel.options, function(opt) {
    return opt.value == value;
  });
  if (b) {
    sel.value = value;
  }
}

function isHumanTaskNode(node) {
  return node.category == "task" && node.type == "human";
}

function getAllOutputData(typeIs) {
  var all = [];
  _.each(wsbpm.allNodes, function(node) {
    if (node.category == "task") {
      _.each(node.config["output-data"], function(x) {
        if (typeIs != null) {
          var dt = _dataDict.fields[x];
          if (dt.type != typeIs.type || dt["array?"] != typeIs["array?"]) {
            return;
          }
        }
        if (!_.contains(all, x)) {
          all.push(x);
        }
      });
    }
  });
  return all;
}

function getAllFields() {
  return _.map(getAllOutputData(), function(name) {
    return _dataDict.fields[name];
  });
}

wsbpm.getAllFields = getAllFields;

function getComparatorOptions(dt) {
  if (dt == "number") {
    return ["大于", "大于等于", "等于", "小于等于", "小于"];
  } else if (dt == "date") {
    return ["早于", "不晚于", "等于", "不早于", "晚于"];
  } else {
    return ["是", "不是"];
  }
}

/* -- get-json-data -- */
function getDataDict() {
  $.getJSON("data/data-dict.json", function(data) {    
    _dataDict = {fields:  _.object(_.pluck(data.fields, "name"), data.fields),
                 selects: _.object(_.pluck(data.selects, "name"), _.pluck(data.selects, "options"))};
  });
};

function getUIList() {
  $.getJSON("data/ui-list.json", function(data) {
    _uiList = _.map(data, function(x) {
      return _.isString(x) ? {name: x, "output": []} : x;
    });
    var source = _.pluck(_uiList, "name").sort();
    $("#task-ui").typeahead({source: source});
    _.each(_uiList, function(ui) {
      _uiList[ui.name] = ui;
    });
  });
}

function getServiceList() {
  $.getJSON("data/service-list.json", function(data) {
    _serviceList = _.map(data, function(x) {
      return _.isString(x) ? {name: x, "output": []} : x;
    });
    var source = _.pluck(_serviceList, "name").sort();
    $("#task-service").typeahead({source: source});
    _.each(_serviceList, function(ui) {
      _serviceList[ui.name] = ui;
    });
  });
}

function getUITree() {
  $.get("data/ui-tree.json", function(data) {
    $("#ui-selector-tree").jstree({'core' : {
      'data' : data,
      "multiple" : false
    }}).on("changed.jstree", function(event, data) {
      var hasLeaf = _.some(data.selected, function(id) {
        var jstree = data.instance;
        return jstree.is_leaf(id);
      });
      $("#modal-ui-selector .btn-primary").prop("disabled", !hasLeaf);
    });    
  });
}

function getServiceTree() {
  $.get("data/service-tree.json", function(data) {
    $("#service-selector-tree").jstree({'core' : {
      'data' : data,
      "multiple" : false
    }}).on("changed.jstree", function(event, data) {
      var hasLeaf = _.some(data.selected, function(id) {
        var jstree = data.instance;
        return jstree.is_leaf(id);
      });
      $("#modal-service-selector .btn-primary").prop("disabled", !hasLeaf);
    });    
  });
}

function getParticipantTree() {
  $.get("data/participant-tree.json", function(data) {
    $("#participant-selector-tree").jstree(
      {
        'core' : {
          'data' : data,
          "multiple" : true
        }, 
        "plugins" : ["checkbox"],
        "checkbox": {
          "three_state": false,
          keep_selected_style: false
        }
      });
  });
};

function getParticipantRules() {
  $.get("data/participant-rules.json", function(data) {
    _.each(data, function(rule) {
      _.each(rule.params, function(param) {
        rule.params[param.name] = param;
      });
    });
    _participantRules = _.object(_.pluck(data, "name"), data);
    var sel = $("#participant-rule");
    $("<option>").text("").appendTo(sel);
    _.each(_.keys(_participantRules).sort(), function(name){
      $("<option>").text(name).appendTo(sel);
    });
    sel.change(function() {
      var ruleName = sel.val();
      if (ruleName) {
        var rule = _participantRules[ruleName];
        repaintParticipantRuleParamList(rule.params);
      } else {
        repaintParticipantRuleParamList([]);
      }
    });
  });
}

/* -- DataList -- */
function DataList(id){
  this.data = [];
  this.id = id;
  
  DataList.all.push(this);
  DataList.all[id] = this;
}

DataList.all = [];

DataList.initAll = function() {
  _.invoke(DataList.all, "init");
};

DataList.prototype.setData = function(data) {
  this.data = data;
  this.repaint();
};

DataList.prototype.getActiveRows = function() {
  return $("#" + this.id + " tr.info");
};

DataList.prototype.removeActiveRows = function() {
  var indexes = _.map(this.getActiveRows(), function(row) {
    return $(row).data("index");
  });
  this.setData(_.filter(this.data, function(x, i) {
    return !_.contains(indexes, i);
  }));
};

DataList.prototype.editActiveRow = function() {
  var index = this.getActiveRows().data("index");
  if (index != null) {
    this.showRowEditor(index);
  }
};

DataList.prototype.repaint = function() {
  var tbody = $("#" + this.id + " tbody").get(0);
  $(tbody).empty();
  var self = this;

  _.each(this.data, function(rowData, rowIndex) {
    var row = tbody.insertRow();
    $(row).data("index", rowIndex);
    self.paintRow(row, rowData, rowIndex);

    $(row).click(function() {
      $(this).toggleClass("info");
    });
  });
};

DataList.prototype.showRowEditor = function(rowIndex) {
  var self = this;
  this.rowEditor.show(this.data[rowIndex], function(data) {
    if (data) {
      self.data[rowIndex] = data;
      self.repaint();
    }
  });  
};

var _extensionList = new DataList("extension-list");

_extensionList.rowEditor = _extensionEditor;

_extensionList.init = function() {
  var self = this;
  $("#extension .wsbpm-btn-add").click(function(event) {
    event.preventDefault();
    self.rowEditor.show({}, function(rowData) {
      if (rowData) {
        self.data.push(rowData);
        self.repaint();
      }
    });
  });

  $("#extension .wsbpm-btn-edit").click(function(event){
    event.preventDefault();
    self.editActiveRow();
    this.blur();
  });

  $("#extension .wsbpm-btn-remove").click(function(event){
    event.preventDefault();
    self.removeActiveRows();
    this.blur();
  });
};

_extensionList.paintRow = function(row, rowData, rowIndex) {
  _.each([rowIndex + 1, rowData.id, rowData.name, rowData.value, rowData.note], function(text, i) {
    var cell = row.insertCell();
    if (i < 4) {
      $(cell).addClass("text-nowrap");
    }
    $(cell).text(text);
  });
};

_addedParticipants = new DataList("participant-list");

_addedParticipants.init = function() {
  var self = this;
  $("#btn-select-participant").click(function(event){
    event.preventDefault();
    _participantSelector.show(_addedParticipants.data, function(data) {
      if (data) {
        self.setData(data);
      }
    });
  });

  $("#btn-remove-participant").click(function(event){
    self.removeActiveRows();
    this.blur();
  });
};

_addedParticipants.paintRow = function(row, rowData, rowIndex) {  
  _.each([rowIndex + 1, rowData.id, rowData.name, null], function(text, i) {
    var cell = row.insertCell();
    if (text) {
      $(cell).text(text);
    } else {
      $(ae(['div', 
            ['i', {'class': 'fa fa-' + (rowData.type == 'role' ? "male" : rowData.type)}], 
            " ", 
            PARTICIPANT_TYPES[rowData.type]])).appendTo(cell);
    }
  });
};

_addedParticipantRules = new DataList("participant-rule-list");

_addedParticipantRules.rowEditor = _participantRuleEditor;

_addedParticipantRules.init = function() {
  var self = this;

  $("#btn-add-participant-rule").click(function(event) {
    event.preventDefault();
    self.rowEditor.show(null, function(rowData) {
      if (rowData) {
        self.data.push(rowData);
        self.repaint();
      }
    });
  });

  $("#btn-edit-participant-rule").click(function(event){
    event.preventDefault();
    self.editActiveRow();
    this.blur();
  });

  $("#btn-remove-participant-rule").click(function(event){
    event.preventDefault();
    self.removeActiveRows();
    this.blur();
  });
};

function repaintParticipantRuleParamList(params) {
  var container = $("#participant-rule-param-list-container");

  if (params == null || params.length == 0) {
    container.collapse('hide');
    return;
  }

  var tbody = $("#participant-rule-param-list tbody").get(0);
  $(tbody).empty();

  _.each(params, function(param) {
    var row = tbody.insertRow();
    $(row).data("paramName", param.name);
    _.each([param.name, dataTypeToString(param.type, param["array?"]), null], function(text) {
      var cell = row.insertCell();
      if (text != null) {
        $(cell).text(text);
      } else {        
        repaintParamValueCell($(cell), param);
      }
    });
  });

  container.collapse('show');
}

function repaintParamValueCell(cell, param) {
  var isVar = param.valueIsVar == null ? true : param.valueIsVar;
  var value = param.value || '';
  cell.empty();
  $(ae(['table', {style: 'width: 100%'},
        ['tr',
         ['td', {style: 'padding-right: 5px;'},
          ['input', {type: 'checkbox', checked: isVar ? 'checked' : undefined, 
                     name: 'is-var',
                     'data-size': 'small', 'data-on-text': '变量', 'data-off-text': '常量'}]],
         ['td', {style: 'width: 100%'},
          (isVar ? ['select', {'class': 'form-control input-sm', name: 'param-value'}]
           : ['input', {type: 'text', 'class': 'form-control input-sm', name: 'param-value'}])]]]))
    .appendTo(cell);
  if (isVar) {
    var sel = cell.find("select[name='param-value']").get(0);    
    var all = getAllOutputData(param);
    if (all.length > 0) {
      all.unshift("");
    }
    updateSelect(sel, all, value);
  } else {
    cell.find("input[name='param-value']").val(value);
  }
  cell.find("input[name='is-var']").bootstrapSwitch().on('switchChange.bootstrapSwitch', function(event, state) {
    var p = _.clone(param);
    p.valueIsVar = state;
    p.value = "";
    repaintParamValueCell(cell, p);
  });
}

_addedParticipantRules.paintRow = function(row, rowData, rowIndex) {
  _.each([rowIndex + 1, rowData.ruleName, null], function(text, i) {
    var cell = row.insertCell();
    if (text != null) {
      $(cell).text(text);
    } else {
      var first = true;
      _.each(rowData.params, function(param, index) {
        var v = param.value;
        if (v == "") {
          return;
        }
        if (!param.valueIsVar) {
          v = "'" + v + "'";
        }
        if (!first) {
          $("<span class='wsbpm-rule-param-separator'>").appendTo(cell);
        } else {
          first = false;
        }
        $(ae(['span', {"class": 'wsbpm-rule-param-name text-nowrap'}, param.name + ":"])).appendTo(cell);
        $(ae(['span', {"class": 'wsbpm-rule-param-value text-nowrap'}, v])).appendTo(cell);
      });
    }
  });
};

function OutputDataList(id, tabId, serviceInput, selectFrom){
  DataList.call(this, id);
  this.tabId = tabId;
  this.serviceInput = serviceInput;
  this.selectFrom = selectFrom;
};

OutputDataList.prototype = _.clone(DataList.prototype);

OutputDataList.prototype.init = function() {
  var self = this;

  $("#" + self.tabId + " .wsbpm-btn-select").click(function(event) {
    event.preventDefault();
    var service = document.getElementById(self.serviceInput).value;
    if (service) {
      _dataSelector.show({service: service, selected: self.data, selectFrom: self.selectFrom}, function(selected) {
        if (selected) {
          self.setData(selected);
        }
      });
    } else {
      var s = self.selectFrom == "ui" ? "用户界面" : "调用服务";
      wsbpm.notify("top-right", "danger", "“输出数据”是从“" + s + "”中选择的，请先在“基本信息”中输入“" + s + "”");
    }
    this.blur();
  });

  $("#" + self.tabId + " .wsbpm-btn-remove").click(function(event) {
    event.preventDefault();
    self.removeActiveRows();
    this.blur();
  });
};

OutputDataList.prototype.paintRow = function(row, rowData, rowIndex) {
  var name = rowData;
  var dt = _dataDict.fields[name];
  var type = dataTypeToString(dt.type, dt["array?"]);
  _.each([rowIndex + 1, name, type], function(text) {
    $(row.insertCell()).text(text);
  });
};

new OutputDataList("human-task-data-list", "human-task-data", "task-ui", "ui");
new OutputDataList("service-task-data-list", "service-task-data", "task-service", "service");

/* -- ModalDialog -- */
function ModalDialog(id) {
  this.id = id;
  ModalDialog.all.push(this);
};

ModalDialog.initAll = function() {
  _.invoke(ModalDialog.all, "init");
};

ModalDialog.prototype.init = function() {
  var selector = "#" + this.id;
  var self = this;

  $(selector + " .btn-primary").click(function(){
    self.data = self.collectData();
    $(selector).modal('hide');
  });

  $(selector).on('hidden.bs.modal', function() {
    if (self.onclose) {
      self.onclose(self.data);
    }
  });
};

ModalDialog.prototype.show = function(data, onclose) {
  this.data = null;
  this.onclose = onclose;

  $("#" + this.id).modal(DEFAULT_MODAL_OPTIONS);

  if (this.loadData) {
    this.loadData(data);
  }
};

function ConfigDialog(name, inputs, borrowTabs) {
  ModalDialog.call(this, "modal-" + name);
  this.name = name;
  this.inputs = inputs;
  this.borrowTabs = borrowTabs || [];
}

ConfigDialog.prototype = _.clone(ModalDialog.prototype);

ConfigDialog.prototype.loadData = function(data) {
  var currentTaskName = data.name;
  var SPECIAL_INITS = {
    "participant-task-executor": initParticipantTaskExecutor,
    "participant-relative-data": initParticipantRelativeData,
    "cond-variable": initCondVariable,
    "cond-comparator": initCondComparator,
    "cond-value": initCondValue
  };

  function initParticipantTaskExecutor(value) {
    var sel = document.getElementById("participant-task-executor");
    var options = _.sortBy(_.compact(_.map(wsbpm.allNodes, function(node) {
      var taskName = node.config.name;
      var value, text;
      if (isHumanTaskNode(node) && taskName != currentTaskName && taskName) {
        return {value: node.id, text: taskName};
      } else {
        return null;
      }
    })), function(opt) {
      return opt.text;
    });
    
    updateSelect(sel, options, value);
  }

  function initParticipantRelativeData(value) {
    updateSelect(document.getElementById("participant-relative-data"), 
                 _.filter(getAllOutputData(),function(name){
                   var dt = _dataDict.fields[name];
                   return _.contains(['role', 'org', 'user'], dt.type);
                 }), value);
  }

  function initCondVariable(value) {
    var sel = document.getElementById("connection-cond-variable");
    return updateSelect(sel, getAllOutputData(), value);
  }

  function initCondComparator(value) {
    var varSel = document.getElementById("connection-cond-variable");
    var compSel = document.getElementById("connection-cond-comparator");
    if (varSel.value) {
      var dt = _dataDict.fields[varSel.value];
      updateSelect(compSel, getComparatorOptions(dt.type), value);
    } else {
      updateSelect(compSel, []);
    }
  }

  function initCondValue(value) {
    repaintCondValueCell(value);
  }

  showTab("#" + this.id + " .modal-body", this.name + "-basic");
  _loadingData = true;

  _.each(this.inputs, function(def) {
    if (_.isString(def)) {
      def = {name: def};
    }
    
    var value = data[def.name];
    if (def.defaultValue != null && value == null) {
      value = def.defaultValue;
    }
    
    var instance = def.instance || def.name;
    var initFn = SPECIAL_INITS[def.name];

    if (initFn) {
      initFn(value);
    } else if (def.type == null) {
      var input = document.getElementById(instance);
      if (input.type == "checkbox") {
        input.checked = value;
      } else {
        input.value = value || "";
      }
      $(input).change();
    } else if (def.type == "list") {
      DataList.all[instance].setData(value || []);
    } else if (def.type == "radios") {      
      $("input[type='radio'][name='" + instance + "-radios'][value='" + value + "']")
        .prop("checked", true).click();
    } else if (def.type == "nav") {
      showTab("#" + def.parent, def.prefix + value);
    }
  });

  _loadingData = false;
};

ConfigDialog.prototype.collectData = function () {
  var data = {};
  _.map(this.inputs, function(def) {
    var value = null;
    if (_.isString(def)) {
      def = {name: def};      
    }

    var instance = def.instance || def.name;

    if (def.type == null) {
      var input = document.getElementById(instance);
      if (input.type == "checkbox") {
        value =  input.checked;
      } else {
        value = input.value;
      }
    } else if (def.type == "list") {
      value = DataList.all[instance].data || [];
    } else if (def.type == "radios") {
      value = _.find($("input[type='radio'][name='" + instance + "-radios']"), function(input) {
        return input.checked;
      }).value;
    } else if (def.type == "nav") {
      var id = $("#" + def.parent + " > .tab-content > .tab-pane.active").attr("id");
      value = id.substring(def.prefix.length);
    }
    data[def.name] =  value;
  });
  return data;
};

ConfigDialog.prototype.show = function(data, onclose) {
  var self = this;
  ModalDialog.prototype.show.apply(this, arguments);
  _.each(this.borrowTabs, function(tabId) {
    var tab = document.getElementById(tabId);
    var anchor = document.getElementById(self.name + "-" + tabId + "-anchor");
    $(tab).removeClass("in active");
    if ($(tab).next().get(0) != anchor) {
      anchor.parentNode.insertBefore(tab, anchor);
    }
  });
};

function EventDialog() {
  ConfigDialog.apply(this, arguments);
}

wsbpm.humanTaskDialog = new ConfigDialog("human-task", HUMAN_TASK_INPUTS, ["time-limit", "extension"]);
wsbpm.humanTaskDialog.show = function(data, onclose, isStart) {
  ConfigDialog.prototype.show.apply(this, arguments);
  $("#" + this.id).toggleClass("wsbpm-start-node", Boolean(isStart));

  var tab = document.getElementById("time-limit");
  $(tab).removeClass("in active");
  var anchor = document.getElementById("human-task-work-item");
  anchor.parentNode.insertBefore(tab, anchor);  
};

wsbpm.serviceTaskDialog = new ConfigDialog("service-task", SERVICE_TASK_INPUTS, ["extension"]);
wsbpm.eventDialog = new ConfigDialog("event", EVENT_INPUTS, ["extension"]);
wsbpm.gatewayDialog = new ConfigDialog("gateway", GATEWAY_INPUTS, ["extension"]);
wsbpm.connectionDialog = new ConfigDialog("connection", CONNECTION_INPUTS, ["extension"]);
wsbpm.processDialog = new ConfigDialog("process", PROCESS_INPUTS, ["time-limit", "extension"]);

function repaintCondValueCell(value) {
  var cell = $("#connection-cond-value-cell");
  var valueIsVar = $("#connection-cond-value-is-variable").prop("checked"); 
  var varSel = document.getElementById("connection-cond-variable");
  var dt;
  var valueOptions;
  var valueSel;

  if (varSel.value) {
    dt = _dataDict.fields[varSel.value];
    valueOptions = _dataDict.selects[dt.type];
  }

  cell.empty();

  if (valueIsVar) {
    valueSel = $('<select class="form-control input-sm" id="connection-cond-value">');
    valueSel.appendTo(cell);
    if (dt) {
      valueOptions = getAllOutputData(dt);
      valueOptions = _.without(valueOptions, varSel.value);
      updateSelect(valueSel.get(0), valueOptions, value);
    } else {
      updateSelect(valueSel.get(0), []);
    }
  } else {
    if (valueOptions) {
      valueSel = $('<select class="form-control input-sm" id="connection-cond-value">');
      valueSel.appendTo(cell);
      updateSelect(valueSel.get(0), valueOptions, value);
    } else {
      var input = $('<input type="text" class="form-control input-sm" id="connection-cond-value">');
      input.appendTo(cell);
      input.val(value);
    }
  }
}

_uiSelector.loadData = function() {
  $.jstree.reference('#ui-selector-tree').deselect_all();
};

_uiSelector.collectData = function() {
  var jstree = $.jstree.reference('#ui-selector-tree');
  var id = jstree.get_selected()[0];
  var node = jstree.get_node(id);
  return node.text;
};

_serviceSelector.loadData = function() {
  $.jstree.reference('#service-selector-tree').deselect_all();
};

_serviceSelector.collectData = function() {
  var jstree = $.jstree.reference('#service-selector-tree');
  var id = jstree.get_selected()[0];
  var node = jstree.get_node(id);
  return node.text;
};

_participantSelector.loadData = function(data) {
  var jstree = $.jstree.reference('#participant-selector-tree');
  jstree.deselect_all();
  _.each(data, function(x) {
    jstree.select_node(x.type + "-" + x.id);
  });
};

_participantSelector.collectData = function() {
  var jstree = $.jstree.reference('#participant-selector-tree');
  var a = _.map(jstree.get_selected(), function(id) {
    var node = jstree.get_node(id);
    var r = /^(bank|user|role)-(.+)$/.exec(id);
    return r ? {type: r[1], id: r[2], name: node.text} : null;
  });
  a = _.compact(a);
  return _.sortBy(a, function(x){
    return x.type;
  });  
};

_extensionEditor.loadData = function(data) {
  _.each(EXTENSION_EDITOR_KEYS, function(k) {
    var input = $("#extension-" + k);
    var v = data[k] || "";
    input.val(v);
  });  
};

_extensionEditor.collectData = function() {
  return _.object(EXTENSION_EDITOR_KEYS, _.map(EXTENSION_EDITOR_KEYS, function(k) {
    return $("#extension-" + k).val();        
  }));  
};

_participantRuleEditor.loadData = function(data) {
  var sel = $("#participant-rule");
  sel.prop("disabled", data != null);

  if (data) {
    sel.val(data.ruleName);
    var rule = _participantRules[data.ruleName];
    var params = _.map(data.params, function(param) {
      return _.extend({}, rule.params[param.name], param);
    });
    repaintParticipantRuleParamList(params);
  } else {
    sel.val("").change();
  }
};

_participantRuleEditor.collectData = function() {
  var sel = $("#participant-rule");
  var s = "''";
  var ruleName = sel.val();
  if (ruleName) {
    var data = {ruleName : ruleName};
    var tbody = $("#participant-rule-param-list tbody").get(0);
    data.params = _.map(tbody.rows, function(row) {
      var param = {};
      param.name = $(row).data("paramName");
      param.valueIsVar = $(row).find("input[name='is-var']").prop("checked");
      param.value = $(row).find("*[name='param-value']").val();
      return param;
    });
    return data;
  } else {
    return null;
  }
};

_dataSelector.loadData = function(data) {
  var serviceName = data.service;
  var selectFrom = data.selectFrom == "ui" ? _uiList : _serviceList;
  var service = selectFrom[serviceName];
  var selected = data.selected;
  $("#data-select-from").text(data.selectFrom == "ui" ? "用户界面" : "调用服务");
  $("#data-service-name").text(serviceName);
  var form = $("#" + this.id + " form");
  form.empty();
  _.each(service.output, function(name) {
      $(ae(['div', {"class": "checkbox"},
            ["label",
             ["input", {type: "checkbox", value: name, 
                        checked: _.contains(selected, name) ? "checked" : undefined},
              name]]])).appendTo(form);
  });
};

_dataSelector.collectData = function() {
  var form = $("#" + this.id + " form");
  return _.compact(_.map(form.find("input:checkbox"), function(input) {
    return input.checked ? input.value : null;
  }));
};

})(this);
