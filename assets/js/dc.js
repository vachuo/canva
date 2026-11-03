/*
 * Vachuo page runtime.
 *
 * Each page keeps its markup in <template id="dc-<Name>"> and its data and
 * behaviour in a component class (extends DCLogic), registered with
 * DC.component(). The runtime renders the template into #app and patches the
 * DOM in place whenever the component calls setState(), so elements keep
 * their identity (CSS transitions, focus, scroll-reveal attributes survive).
 *
 * Template syntax:
 *   {{path.to.value}}            text or attribute value from renderVals() / loop scope
 *   onclick="{{handler}}"        any on* attribute bound to a function (onchange = every input)
 *   value="{{v}}" checked="{{b}}" on form fields are kept in sync as properties
 *   ref="{{fn}}"                 fn(element) after render, fn(null) once it is removed
 *   <template data-for="{{list}}" data-as="item">   repeat
 *   <template data-if="{{flag}}">                   conditional
 *   <dc-import name="Other" prop="{{x}}" on-done="{{fn}}">   embed another component
 *
 * Component lifecycle: componentDidMount(), componentDidUpdate(prevProps, prevState),
 * componentWillUnmount().
 */
(function () {
  'use strict';

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var ONLY_HOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;
  var EVENT_ALIASES = { change: 'input', doubleclick: 'dblclick' };
  var registry = {};
  var keyed = new WeakSet();

  // ---- template evaluation ------------------------------------------------

  function lookup(expr, scope) {
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    var parts = expr.split('.');
    var value = scope;
    for (var i = 0; i < parts.length; i++) {
      if (value == null) return undefined;
      value = value[parts[i]];
    }
    return value;
  }

  function hole(str, scope) {
    var m = str && str.match(ONLY_HOLE);
    return m ? lookup(m[1], scope) : str;
  }

  function fill(str, scope) {
    return str.replace(HOLE, function (_, expr) {
      var v = lookup(expr, scope);
      return v == null ? '' : String(v);
    });
  }

  function child(scope, name, value) {
    var s = Object.create(scope);
    s[name] = value;
    return s;
  }

  // Write style attributes the way the browser serializes them
  // ("background: rgb(244, 244, 239);"), as a CSSOM-driven page would. The
  // dark theme stylesheet matches on that form with [style*="…"] selectors.
  var styleProbe = document.createElement('div');
  var styleCache = new Map();
  function normalizeStyle(css) {
    var out = styleCache.get(css);
    if (out === undefined) {
      styleProbe.style.cssText = css;
      out = styleProbe.getAttribute('style') || '';
      if (styleCache.size > 5000) styleCache.clear();
      styleCache.set(css, out);
    }
    return out;
  }

  // Prepare a template once: give every element a stable id, so re-renders can
  // match new elements to the ones already on the page, and park attributes
  // holding {{holes}} under a prefix so the browser never parses the raw
  // placeholder (SVG would log errors, on* would compile as inline script).
  var PARKED = 'dc-x-';
  var nextKey = 0;
  function prepareTemplate(content) {
    if (keyed.has(content)) return;
    keyed.add(content);
    var els = content.querySelectorAll('*');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      el.setAttribute('data-dck', String(nextKey++));
      if (el.tagName === 'TEMPLATE') { prepareTemplate(el.content); continue; }
      if (el.tagName === 'DC-IMPORT') continue;
      var attrs = Array.prototype.slice.call(el.attributes);
      for (var j = 0; j < attrs.length; j++) {
        if (attrs[j].value.indexOf('{{') === -1) {
          if (attrs[j].name === 'style') el.setAttribute('style', normalizeStyle(attrs[j].value));
          continue;
        }
        el.removeAttribute(attrs[j].name);
        el.setAttribute(PARKED + attrs[j].name, attrs[j].value);
      }
    }
  }

  function dispatch(e) {
    var fn = this.__dcOn && this.__dcOn[e.type];
    if (!fn) return;
    if (!e.nativeEvent) e.nativeEvent = e;
    fn.call(this, e);
  }

  // The component whose template is being rendered; owns the refs it binds.
  var rendering = null;

  function processAttrs(el, scope, path) {
    el.__dcKey = el.getAttribute('data-dck') + path;
    el.removeAttribute('data-dck');
    var attrs = Array.prototype.slice.call(el.attributes);
    for (var i = 0; i < attrs.length; i++) {
      if (attrs[i].name.indexOf(PARKED) !== 0) continue;
      var name = attrs[i].name.slice(PARKED.length);
      var value = attrs[i].value;
      el.removeAttribute(attrs[i].name);
      var whole = value.match(ONLY_HOLE);
      if (name.slice(0, 2) === 'on' && whole) {
        var type = name.slice(2);
        type = EVENT_ALIASES[type] || type;
        el.__dcOn = el.__dcOn || {};
        el.__dcOn[type] = lookup(whole[1], scope);
        el.addEventListener(type, dispatch);
        continue;
      }
      if (name === 'ref' && whole) {
        el.__dcRef = lookup(whole[1], scope);
        el.__dcRefOwner = rendering;
        el.setAttribute('data-dc-ref', '');
        continue;
      }
      if (whole) {
        var v = lookup(whole[1], scope);
        var stringly = name.slice(0, 5) === 'aria-' || name.slice(0, 5) === 'data-';
        if (v == null || (v === false && !stringly)) continue;
      }
      var filled = fill(value, scope);
      el.setAttribute(name, name === 'style' ? normalizeStyle(filled) : filled);
    }
    el.__dcAttrs = Array.prototype.map.call(el.attributes, function (x) { return x.name; });
  }

  function importProps(el, scope) {
    var props = {};
    var attrs = Array.prototype.slice.call(el.attributes);
    for (var i = 0; i < attrs.length; i++) {
      var name = attrs[i].name;
      if (name === 'name' || name === 'data-dck') continue;
      var camel = name.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
      props[camel] = hole(attrs[i].value, scope);
    }
    return props;
  }

  function processNode(node, scope, path) {
    if (node.nodeType === 3) {
      if (node.nodeValue.indexOf('{{') !== -1) node.nodeValue = fill(node.nodeValue, scope);
      return;
    }
    if (node.nodeType !== 1) return;

    if (node.tagName === 'TEMPLATE' && (node.hasAttribute('data-for') || node.hasAttribute('data-if'))) {
      var out = document.createDocumentFragment();
      if (node.hasAttribute('data-for')) {
        var list = hole(node.getAttribute('data-for'), scope) || [];
        var as = node.getAttribute('data-as');
        for (var i = 0; i < list.length; i++) {
          out.appendChild(renderFragment(node.content, child(scope, as, list[i]), path + '.' + i));
        }
      } else if (hole(node.getAttribute('data-if'), scope)) {
        out.appendChild(renderFragment(node.content, scope, path));
      }
      node.parentNode.replaceChild(out, node);
      return;
    }

    if (node.tagName === 'DC-IMPORT') {
      node.__dcImport = { name: node.getAttribute('name'), props: importProps(node, scope) };
      var key = node.getAttribute('data-dck') + path;
      while (node.attributes.length) node.removeAttribute(node.attributes[0].name);
      node.__dcKey = key;
      node.__dcAttrs = [];
      node.style.display = 'block';
      return;
    }

    processAttrs(node, scope, path);
    var kids = Array.prototype.slice.call(node.childNodes);
    for (var k = 0; k < kids.length; k++) processNode(kids[k], scope, path);
  }

  function renderFragment(content, scope, path) {
    var frag = document.importNode(content, true);
    var kids = Array.prototype.slice.call(frag.childNodes);
    for (var i = 0; i < kids.length; i++) processNode(kids[i], scope, path);
    return frag;
  }

  // ---- patching -----------------------------------------------------------

  function morphChildren(oldParent, newParent) {
    var byKey = new Map();
    for (var c = oldParent.firstChild; c; c = c.nextSibling) {
      if (c.__dcKey) byKey.set(c.__dcKey, c);
    }
    var cursor = oldParent.firstChild;
    var incoming = Array.prototype.slice.call(newParent.childNodes);
    for (var i = 0; i < incoming.length; i++) {
      var n = incoming[i];
      var match = null;
      if (n.nodeType === 1) {
        var o = byKey.get(n.__dcKey);
        if (o && o.tagName === n.tagName) { match = o; byKey.delete(n.__dcKey); }
      } else if (cursor && cursor.nodeType === n.nodeType && !cursor.__dcKey) {
        match = cursor;
      }
      if (!match) { oldParent.insertBefore(n, cursor); continue; }
      if (match === cursor) cursor = cursor.nextSibling;
      else oldParent.insertBefore(match, cursor);
      morph(match, n);
    }
    while (cursor) {
      var next = cursor.nextSibling;
      oldParent.removeChild(cursor);
      cursor = next;
    }
  }

  function morph(old, n) {
    if (n.nodeType !== 1) {
      if (old.nodeValue !== n.nodeValue) old.nodeValue = n.nodeValue;
      return;
    }

    if (n.tagName === 'DC-IMPORT') {
      old.__dcImport = n.__dcImport;
      return;
    }

    // Attributes: only touch the ones the template manages, so attributes set
    // by component code (e.g. data-shown from a scroll observer) survive.
    var prev = old.__dcAttrs || Array.prototype.map.call(old.attributes, function (x) { return x.name; });
    for (var i = 0; i < prev.length; i++) {
      if (!n.hasAttribute(prev[i])) old.removeAttribute(prev[i]);
    }
    for (var j = 0; j < n.attributes.length; j++) {
      var a = n.attributes[j];
      if (old.getAttribute(a.name) !== a.value) old.setAttribute(a.name, a.value);
    }
    old.__dcAttrs = n.__dcAttrs;

    var types = n.__dcOn ? Object.keys(n.__dcOn) : [];
    for (var t = 0; t < types.length; t++) {
      if (!old.__dcOn || !(types[t] in old.__dcOn)) old.addEventListener(types[t], dispatch);
    }
    old.__dcOn = n.__dcOn;
    old.__dcRef = n.__dcRef;
    old.__dcRefOwner = n.__dcRefOwner;

    if (old.tagName !== 'TEXTAREA') morphChildren(old, n);
    syncFormState(old, n, prev);
  }

  function syncFormState(old, n, prevAttrs) {
    var tag = old.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;
    if (n.hasAttribute('value')) {
      var v = n.getAttribute('value');
      if (old.value !== v) old.value = v;
    }
    if (tag === 'INPUT' && (n.hasAttribute('checked') || prevAttrs.indexOf('checked') !== -1)) {
      old.checked = n.hasAttribute('checked');
    }
  }

  // Fresh elements only have their value as an attribute; selects and
  // textareas ignore that, so apply it as a property after insertion.
  function initFormState(root) {
    var els = root.querySelectorAll('select[value], textarea[value]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].value !== els[i].getAttribute('value')) els[i].value = els[i].getAttribute('value');
    }
  }

  // ---- components ---------------------------------------------------------

  function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  }

  DCLogic.prototype.renderVals = function () { return {}; };

  DCLogic.prototype.setState = function (patch, callback) {
    var self = this;
    var base = this._pendingState || this.state;
    var next = typeof patch === 'function' ? patch(base, this.props) : patch;
    this._pendingState = Object.assign({}, base, next);
    if (callback) (this._callbacks = this._callbacks || []).push(callback);
    if (this._scheduled) return;
    this._scheduled = true;
    queueMicrotask(function () {
      self._scheduled = false;
      if (!self._host) return;
      var prevState = self.state;
      self.state = self._pendingState;
      self._pendingState = null;
      self._update(self.props, prevState);
    });
  };

  DCLogic.prototype.forceUpdate = function () {
    this._update(this.props, this.state);
  };

  DCLogic.prototype._render = function () {
    var tpl = registry[this._name].template;
    var vals = this.renderVals();
    var outer = rendering;
    rendering = this;
    try {
      var frag = renderFragment(tpl.content, vals, '');
    } finally {
      rendering = outer;
    }
    morphChildren(this._host, frag);
    initFormState(this._host);
    applyRefs(this);
    syncChildren(this);
  };

  // Call ref callbacks like React: the new callback gets the element, a
  // replaced or removed one gets null.
  function setRef(el, fn) {
    var prev = el.__dcRefApplied;
    if (prev === fn) return;
    el.__dcRefApplied = fn;
    if (typeof prev === 'function') prev(null);
    if (typeof fn === 'function') fn(el);
  }

  function applyRefs(inst) {
    var live = new Set();
    var els = inst._host ? inst._host.querySelectorAll('[data-dc-ref]') : [];
    for (var i = 0; i < els.length; i++) {
      if (els[i].__dcRefOwner !== inst) continue;
      live.add(els[i]);
      setRef(els[i], els[i].__dcRef);
    }
    (inst._refEls || []).forEach(function (el) { if (!live.has(el)) setRef(el, null); });
    inst._refEls = Array.from(live);
  }

  DCLogic.prototype._update = function (prevProps, prevState) {
    this._render();
    if (this.componentDidUpdate) this.componentDidUpdate(prevProps, prevState);
    var cbs = this._callbacks;
    this._callbacks = null;
    if (cbs) cbs.forEach(function (cb) { cb(); });
  };

  // Mount, update or unmount the components embedded with <dc-import>.
  function syncChildren(parent) {
    var seen = new Set();
    var hosts = parent._host.querySelectorAll('dc-import');
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      // Skip hosts that belong to a nested component; it syncs its own.
      var owner = host.parentNode.closest('dc-import');
      if (owner && owner !== parent._host && parent._host.contains(owner)) continue;
      var spec = host.__dcImport;
      var inst = host.__dcInstance;
      if (inst && inst._name === spec.name) {
        var prevProps = inst.props;
        inst.props = withDefaults(spec.name, spec.props);
        inst._update(prevProps, inst.state);
      } else {
        if (inst) unmount(inst);
        inst = create(spec.name, spec.props, host);
        host.__dcInstance = inst;
      }
      seen.add(inst);
    }
    (parent._children || []).forEach(function (c) { if (!seen.has(c)) unmount(c); });
    parent._children = Array.from(seen);
  }

  function withDefaults(name, props) {
    return Object.assign({}, registry[name].defaults, props);
  }

  function create(name, props, host) {
    var def = registry[name];
    if (!def) throw new Error('Unknown component: ' + name);
    prepareTemplate(def.template.content);
    var inst = new def.Component(withDefaults(name, props));
    inst._name = name;
    inst._host = host;
    inst._render();
    if (inst.componentDidMount) inst.componentDidMount();
    return inst;
  }

  function unmount(inst) {
    (inst._children || []).forEach(unmount);
    if (inst.componentWillUnmount) inst.componentWillUnmount();
    (inst._refEls || []).forEach(function (el) { setRef(el, null); });
    inst._refEls = null;
    if (inst._host) inst._host.__dcInstance = null;
    inst._host = null;
  }

  // factory() runs the component's script and returns its class.
  function component(name, factory, defaults) {
    registry[name] = {
      Component: factory(),
      template: document.getElementById('dc-' + name),
      defaults: defaults || {}
    };
  }

  function mount(name, opts) {
    opts = opts || {};
    var root = document.getElementById(opts.target || 'app');
    var props = Object.assign({}, opts.props);
    // Declared props can be set from the query string, e.g. profile.html?pid=library
    var params = new URLSearchParams(location.search);
    Object.keys(registry[name].defaults).forEach(function (k) {
      if (params.has(k)) props[k] = params.get(k);
    });
    var inst = create(name, props, root);

    // Content arrives after the browser's own hash scroll; redo it.
    if (location.hash) {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
    return inst;
  }

  window.DCLogic = DCLogic;
  window.DC = { component: component, mount: mount };
})();
