// Minimal runtime for the Claude Design ".dc.html" templates, so the design's
// markup and logic class run unchanged as plain static files.
//
// Supports what the handoff uses: {{ expr }} in text and attributes,
// <sc-if value>, <sc-for list as>, onClick/onChange handlers, style-hover /
// style-focus / style-active, a React.createElement shim for the few nodes the
// logic builds in JS, and DCLogic (setState / forceUpdate / lifecycle).
// Rendering is a full template pass patched into the DOM with morphdom, so
// unchanged nodes (and their CSS animations) are left alone.
(function () {
  const VOID = new Set(["area", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "wbr"]);
  const UNITLESS = new Set(["fontWeight", "lineHeight", "opacity", "zIndex", "flex", "flexGrow", "flexShrink", "order"]);
  const EVENTS = { onclick: "click", onchange: "input", oninput: "input" };
  const PSEUDO = { "style-hover": "hover", "style-focus": "focus", "style-active": "active" };
  const TOKEN = /\{\{\s*([\s\S]*?)\s*\}\}/g;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const exprCache = new Map();
  function evalExpr(expr, scope) {
    let fn = exprCache.get(expr);
    if (!fn) {
      fn = new Function("__s", "with (__s) { return (" + expr + "); }");
      exprCache.set(expr, fn);
    }
    try { return fn(scope); } catch (e) { return undefined; }
  }

  // ── React.createElement shim ─────────────────────────────────────────────
  const isVNode = (v) => v && typeof v === "object" && v.__vnode;
  window.React = {
    createElement(type, props, ...children) {
      return { __vnode: true, type, props: props || {}, children };
    },
  };
  const kebab = (k) => (k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()));
  function styleObj(o) {
    return Object.entries(o)
      .filter(([, v]) => v !== null && v !== undefined && v !== false)
      .map(([k, v]) => kebab(k) + ":" + (typeof v === "number" && !UNITLESS.has(k) && !k.startsWith("--") ? v + "px" : v))
      .join(";");
  }

  // ── Renderer ─────────────────────────────────────────────────────────────
  class Renderer {
    constructor() {
      this.handlers = [];
      this.pseudo = new Map();
      this.sheet = document.createElement("style");
      document.head.appendChild(this.sheet);
    }
    pseudoClass(kind, css) {
      const key = kind + "|" + css;
      if (!this.pseudo.has(key)) {
        const cls = "dcp" + this.pseudo.size;
        this.pseudo.set(key, cls);
        const rules = css.split(";").filter(Boolean).map((r) => r.trim() + " !important").join(";");
        this.sheet.appendChild(document.createTextNode(`.${cls}:${kind}{${rules}}`));
      }
      return this.pseudo.get(key);
    }
    handler(fn) {
      this.handlers.push(fn);
      return this.handlers.length - 1;
    }
    value(v) {
      if (v === null || v === undefined || v === false) return "";
      if (Array.isArray(v)) return v.map((x) => this.value(x)).join("");
      if (isVNode(v)) return this.vnode(v);
      return esc(v);
    }
    vnode(v) {
      if (!isVNode(v)) return this.value(v);
      const attrs = [];
      for (const [k, val] of Object.entries(v.props)) {
        if (k === "key" || k === "children" || val === null || val === undefined || val === false) continue;
        if (typeof val === "function" && /^on[A-Z]/.test(k)) {
          const ev = EVENTS[k.toLowerCase()] || k.slice(2).toLowerCase();
          attrs.push(`data-dc-${ev}="${this.handler(val)}"`);
        } else if (k === "style" && typeof val === "object") {
          attrs.push(`style="${esc(styleObj(val))}"`);
        } else {
          attrs.push(`${k === "className" ? "class" : k}="${esc(val)}"`);
        }
      }
      const open = `<${v.type}${attrs.length ? " " + attrs.join(" ") : ""}>`;
      if (VOID.has(v.type)) return open;
      return open + v.children.map((c) => this.value(c)).join("") + `</${v.type}>`;
    }
    interp(str, scope) {
      return str.replace(TOKEN, (_, expr) => {
        const v = evalExpr(expr, scope);
        return v === null || v === undefined || v === false ? "" : String(v);
      });
    }
    nodes(list, scope) {
      let out = "";
      for (const n of list) out += this.node(n, scope);
      return out;
    }
    node(n, scope) {
      if (n.nodeType === 3) {
        const t = n.nodeValue;
        if (!t.includes("{{")) return esc(t);
        let out = "";
        let last = 0;
        t.replace(TOKEN, (m, expr, idx) => {
          out += esc(t.slice(last, idx)) + this.value(evalExpr(expr, scope));
          last = idx + m.length;
          return m;
        });
        return out + esc(t.slice(last));
      }
      if (n.nodeType !== 1) return "";
      const tag = n.tagName.toLowerCase();
      const attr = (name) => {
        const raw = n.getAttribute(name);
        const m = raw && raw.match(/^\s*\{\{\s*([\s\S]*?)\s*\}\}\s*$/);
        return m ? evalExpr(m[1], scope) : raw;
      };
      if (tag === "sc-if") return attr("value") ? this.nodes(n.childNodes, scope) : "";
      if (tag === "sc-for") {
        const list = attr("list") || [];
        const as = n.getAttribute("as") || "item";
        let out = "";
        for (const item of list) {
          const child = Object.create(scope);
          child[as] = item;
          out += this.nodes(n.childNodes, child);
        }
        return out;
      }
      const attrs = [];
      const classes = [];
      for (const a of n.attributes) {
        const name = a.name;
        if (name.startsWith("hint-")) continue;
        if (EVENTS[name]) {
          const fn = attr(name);
          if (typeof fn === "function") attrs.push(`data-dc-${EVENTS[name]}="${this.handler(fn)}"`);
          continue;
        }
        if (PSEUDO[name]) {
          classes.push(this.pseudoClass(PSEUDO[name], this.interp(a.value, scope)));
          continue;
        }
        if (name === "class") {
          classes.push(this.interp(a.value, scope));
          continue;
        }
        attrs.push(`${name}="${esc(this.interp(a.value, scope))}"`);
      }
      if (classes.length) attrs.push(`class="${esc(classes.join(" "))}"`);
      const open = `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>`;
      if (VOID.has(tag)) return open;
      return open + this.nodes(n.childNodes, scope) + `</${tag}>`;
    }
  }

  // ── Component base ───────────────────────────────────────────────────────
  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
      this.__cbs = [];
      this.__queued = false;
    }
    setState(update, cb) {
      const patch = typeof update === "function" ? update(this.state, this.props) : update;
      if (patch) this.state = Object.assign({}, this.state, patch);
      if (cb) this.__cbs.push(cb);
      this.__schedule();
    }
    forceUpdate(cb) {
      if (cb) this.__cbs.push(cb);
      this.__schedule();
    }
    __schedule() {
      if (this.__queued || !this.__mount) return;
      this.__queued = true;
      queueMicrotask(() => {
        this.__queued = false;
        this.__mount.render();
        const cbs = this.__cbs;
        this.__cbs = [];
        cbs.forEach((f) => f());
      });
    }
  }
  window.DCLogic = DCLogic;

  window.DC = {
    // Moves <helmet> content into <head>, then renders the template into rootEl.
    mount(Component, templateEl, rootEl, props) {
      const tpl = templateEl.content;
      const helmet = tpl.querySelector("helmet");
      if (helmet) {
        for (const el of [...helmet.children]) document.head.appendChild(document.importNode(el, true));
        helmet.remove();
      }
      const renderer = new Renderer();
      const comp = new Component(props);
      let handlers = [];
      const mountObj = {
        render() {
          renderer.handlers = [];
          const html = renderer.nodes(tpl.childNodes, comp.renderVals());
          handlers = renderer.handlers;
          window.morphdom(rootEl, `<div id="${rootEl.id}">${html}</div>`, {
            onBeforeElUpdated(from, to) {
              // Don't fight the caret in the input being typed into.
              if (from === document.activeElement && from.tagName === "INPUT") {
                for (const a of to.attributes) if (a.name !== "value") from.setAttribute(a.name, a.value);
                return false;
              }
              return !from.isEqualNode(to);
            },
          });
        },
      };
      comp.__mount = mountObj;
      window.__dcComponent = comp; // handy for debugging from the console
      const dispatch = (type) => (e) => {
        const el = e.target.closest(`[data-dc-${type}]`);
        if (!el || !rootEl.contains(el)) return;
        const fn = handlers[+el.getAttribute(`data-dc-${type}`)];
        if (fn) fn(e);
      };
      rootEl.addEventListener("click", dispatch("click"));
      rootEl.addEventListener("input", dispatch("input"));
      mountObj.render();
      if (comp.componentDidMount) comp.componentDidMount();
      return comp;
    },
  };
})();
