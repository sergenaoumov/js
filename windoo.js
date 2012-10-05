/* Windoo 1.2-beta1(r166) (c) 2007 Yevgen Gorshkov - Maintained by Scott Murphy - Open Source MIT License */
Drag.Transition = {
	linear: {
		step: function (start, current, direction) {
			return direction * current - start
		},
		inverse: function (start, current, direction) {
			return (start + current) / direction
		}
	}
};
Drag.Multi = new Class({
	Extends: Drag,
	elementOptions: {
		unit: 'px',
		direction: 1,
		limit: false,
		grid: false,
		bind: false,
		fn: Drag.Transition.linear
	},
	initialize: function (options) {
		this.setOptions(options);
		this.handle = $(this.options.handle);
		this.document = this.handle.ownerDocument;
		this.element = [];
		this.mouse = {
			'start': {},
			'now': {}
		};
		this.modifiers = {};
		this.bound = {
			'start': this.start.bind(this),
			'check': this.check.bind(this),
			'drag': this.drag.bind(this),
			'stop': this.stop.bind(this)
		};
		var htype = $type(this.options.handle);
		this.handles = (htype == 'array' || htype == 'collection') ? $$(this.options.handle) : $(this.options.handle) || this.element;
		this.attach()
	},
	add: function (el, options, bind) {
		el = $(el);
		if (!$defined(bind)) bind = {};
		var result = {};
		for (var z in options) {
			if ($type(options[z]) != 'object' || !$defined(options[z].style)) continue;
			if (!$defined(this.modifiers[z])) this.modifiers[z] = [];
			var mod = $merge(this.elementOptions, options[z], {
				modifier: z,
				element: el,
				bind: false,
				binded: false
			});
			if (bind[z]) {
				mod.bind = bind[z];
				mod.bind.binded = true
			}
			var sign = mod.style.slice(0, 1);
			if (sign == '-' || sign == '+') {
				mod.direction = (sign + 1).toInt();
				mod.style = mod.style.slice(1)
			}
			this.modifiers[z].push(mod);
			result[z] = mod
		}
		if (!this.element.contains(el)) this.element.push(el);
		return result
	},
	remove: function (el) {
		el = $(el);
		for (var z in this.modifiers) this.modifiers[z] = this.modifiers[z].filter(function (e) {
			return el != e.element
		});
		this.element.remove(el);
		return this
	},
	detach: function (mod) {
		for (var z in mod) if ($type(mod[z]) == 'object' && !mod[z].binded) this.modifiers[z].remove(mod[z]);
		return this
	},
	start: function (event) {
		this.fireEvent('onBeforeStart', this.element);
		this.mouse.start = event.page;
		for (var z in this.modifiers) {
			var mouse = this.mouse.start[z];
			this.modifiers[z].each(function (mod) {
				mod.now = mod.element.getStyle(mod.style).toInt();
				mod.start = mod.fn.step(mod.now, mouse, mod.direction, true);
				mod.$limit = [];
				var limit = mod.limit;
				if (limit) for (var i = 0; i < 2; i++) {
					if ($chk(limit[i])) mod.$limit[i] = ($type(limit[i]) == 'function') ? limit[i](mod) : limit[i]
				}
			}, this)
		}
		document.addEvents({
			'mousemove': this.bound.check,
			'mouseup': this.bound.stop
		});
		this.fireEvent('onStart', this.element);
		event.stop()
	},
	modifierUpdate: function (mod) {
		var z = mod.modifier,
			mouse = this.mouse.now[z];
		mod.out = false;
		mod.now = mod.fn.step(mod.start, mod.bind ? mod.bind.inverse : mouse, mod.direction);
		if (mod.$limit && $chk(mod.$limit[1]) && (mod.now > mod.$limit[1])) {
			mod.now = mod.$limit[1];
			mod.out = true
		} else if (mod.$limit && $chk(mod.$limit[0]) && (mod.now < mod.$limit[0])) {
			mod.now = mod.$limit[0];
			mod.out = true
		}
		if (mod.grid) mod.now -= ((mod.now + mod.grid / 2) % mod.grid) - mod.grid / 2;
		if (mod.binded) mod.inverse = mod.fn.inverse(mod.start, mod.now, mod.direction);
		mod.element.setStyle(mod.style, mod.now + mod.unit)
	},
	drag: function (event) {
		this.mouse.now = event.page;
		for (var z in this.modifiers) this.modifiers[z].each(this.modifierUpdate, this);
		this.fireEvent('onDrag', this.element);
		event.stop()
	}
});
Drag.Multi.$direction = {
	east: {
		'x': 1
	},
	west: {
		'x': -1
	},
	north: {
		'y': -1
	},
	south: {
		'y': 1
	},
	nw: {
		'x': -1,
		'y': -1
	},
	ne: {
		'x': 1,
		'y': -1
	},
	sw: {
		'x': -1,
		'y': 1
	},
	se: {
		'x': 1,
		'y': 1
	}
};
Drag.Resize = new Class({
	Implements: [Events, Options],
	options: {
		zIndex: 10000,
		moveLimit: false,
		resizeLimit: {
			'x': [0],
			'y': [0]
		},
		grid: false,
		modifiers: {
			'x': 'left',
			'y': 'top',
			'width': 'width',
			'height': 'height'
		},
		container: null,
		preserveRatio: false,
		ghost: false,
		snap: 6,
		direction: Drag.Multi.$direction,
		limiter: {
			'x': {
				'-1': ['left', 'right'],
				'1': ['right', 'left']
			},
			'y': {
				'-1': ['top', 'bottom'],
				'1': ['bottom', 'top']
			}
		},
		moveLimiter: {
			'x': ['left', 'right'],
			'y': ['top', 'bottom']
		},
		ghostClass: 'ghost-sizer sizer-visible',
		classPrefix: 'sizer sizer-',
		hoverClass: 'sizer-visible',
		shadeBackground: 'transparent url(s.gif)'
	},
	initialize: function (el, options) {
		var self = this;
		this.element = this.el = $(el);
		this.fx = {};
		this.binds = {};
		this.bound = {};
		this.setOptions(options);
		this.options.container = this.options.container === null ? this.el.getParent() : $(this.options.container);
		if ($type(this.options.direction) == 'string') {
			if (dir == 'all') {
				this.options.direction = Drag.Multi.$direction
			} else {
				var dir = this.options.direction.split(/\s+/);
				this.options.direction = {};
				dir.each(function (d) {
					this[d] = Drag.Multi.$direction[d]
				}, this.options.direction)
			}
		}
		var ce = this.el.getCoordinates(),
			positionStyle = this.el.getStyle('position');
		this.el.setStyles({
			'width': ce.width,
			'height': ce.height
		});
		if (this.options.container) {
			if (!(['relative', 'fixed'].contains(positionStyle))) {
				var cc = this.options.container.getCoordinates();
				this.el.setStyles({
					'left': ce.left - cc.left,
					'top': ce.top - cc.top
				})
			}
			this.options.moveLimit = $merge({
				'x': [0],
				'y': [0]
			}, this.options.moveLimit)
		}
		if (this.options.preserveRatio) {
			var R = ce.width / ce.height;
			var rlim = self.options.resizeLimit;
			var fix = function (z1, z2, op, no, coeff) {
				if (rlim && rlim[z1] && rlim[z2] && rlim[z1][no] && rlim[z2][no]) rlim[z1][no] = Math[op](rlim[z1][no], coeff * rlim[z2][no])
			};
			fix('x', 'y', 'max', 0, R);
			fix('y', 'x', 'max', 0, 1 / R);
			fix('x', 'y', 'min', 1, R);
			fix('y', 'x', 'min', 1, 1 / R);
			this.aspectStep = {
				x: {
					step: function (s, c, d) {
						return d * c / R - s
					}
				},
				y: {
					step: function (s, c, d) {
						return d * c * R - s
					}
				}
			};
			this.options.direction = $merge(this.options.direction);
			['nw', 'ne', 'sw', 'se'].each(function (z) {
				delete this[z]
			}, this.options.direction)
		}
		if (this.options.ghost) {
			this.ghost = new Element('div', {
				'class': this.options.ghostClass,
				'styles': {
					'display': 'none'
				}
			}).inject(this.el, 'after');
			for (var d in this.options.direction) this.ghost.adopt(new Element('div', {
				'class': this.options.classPrefix + d
			}))
		}
		var rOpts = {
			snap: this.options.snap,
			onBeforeStart: function () {
				self.fireEvent('onBeforeStart', this);
				self.started = true;
				this.shade = new Fx.Overlay(window, {
					'styles': {
						'position': positionStyle,
						'cursor': this.options.handle.getStyle('cursor'),
						'background': self.options.shadeBackground,
						'z-index': self.options.zIndex + 1
					}
				}).show();
				if (self.ghost) {
					var ce = self.el.getCoordinates();
					self.ghost.setStyles({
						'display': 'block',
						'z-index': self.options.zIndex,
						'left': self.el.getStyle('left'),
						'top': self.el.getStyle('top'),
						'width': ce.width,
						'height': ce.height
					});
					for (var z in this.modifiers) this.modifiers[z].each(function (mod) {
						if (mod.element === self.ghost) mod.element.setStyle(mod.style, self.el.getStyle(mod.style))
					});
					if (self.options.hoverClass) self.el.removeClass(self.options.hoverClass)
				}
			},
			onSnap: function () {
				self.fireEvent('onSnap', this)
			},
			onStart: function () {
				self.fireEvent('onStart', this)
			},
			onDrag: function () {
				self.fireEvent('onResize', this)
			},
			onComplete: function () {
				self.started = false;
				if (self.options.hoverClass) self.el.removeClass(self.options.hoverClass);
				this.shade.destroy();
				if (self.ghost) {
					for (var z in this.modifiers) {
						this.modifiers[z].each(function (mod) {
							if (mod.element === self.ghost) self.el.setStyle(mod.style, mod.now + mod.unit)
						})
					}
					self.ghost.setStyle('display', 'none')
				}
				self.fireEvent('onComplete', this)
			}
		};
		var rlimitFcn = function (sign, props, limit) {
			if (!self.options.container) return limit;
			if (!limit) limit = [0];
			var generator = function (lim) {
				return function (mod) {
					var cc = self.options.container.getCoordinates(),
						ec = mod.element.getCoordinates();
					var value = sign * (cc[props[0]] - ec[props[1]]);
					switch ($type(lim)) {
					case 'number':
						return Math.min(value, lim);
					case 'function':
						return Math.min(value, lim(mod));
					default:
						return value
					}
				}
			};
			return [limit[0], generator(limit[1])]
		};
		var mlimitFcn = function (props, limit, rlimit) {
			var container = self.options.container;
			var generator = function (lim, rlim, op, rdef) {
				if (!$type(rlim)) rlim = rdef;
				var lim_type = $type(lim);
				if (rlim === null) return lim_type == 'function' ? lim : function () {
					return lim
				};
				return function (mod) {
					var cc = container.getCoordinates(),
						ec = mod.element.getCoordinates();
					var value = ec[props[1]] - cc[props[0]] - rlim;
					switch (lim_type) {
					case 'number':
						return Math[op](value, lim);
					case 'function':
						return Math[op](value, lim(mod));
					default:
						return value
					}
				}
			};
			if (!container) {
				if (!limit) limit = false;
				container = self.el.getParent()
			} else if (!limit) limit = [0];
			return [generator(limit[0], rlimit[1], 'max', null), generator(limit[1], rlimit[0], 'min', limit[1])]
		};
		var opt = this.options,
			el = this.ghost ? this.ghost : this.el;
		if ($type(opt.grid) == 'number') opt.grid = {
			'x': opt.grid,
			'y': opt.grid
		};
		for (var d in opt.direction) {
			var mod = opt.direction[d];
			rOpts.handle = new Element('div', {
				'class': opt.classPrefix + d
			});
			var drag = this.fx[d] = new Drag.Multi(rOpts);
			var resizeLimit = {
				'x': rlimitFcn(mod.x, opt.limiter.x['' + mod.x], opt.resizeLimit.x),
				'y': rlimitFcn(mod.y, opt.limiter.y['' + mod.y], opt.resizeLimit.y)
			};
			var moveOpts = {};
			for (var z in mod) {
				if (mod[z] < 0) {
					moveOpts[z] = {
						limit: mlimitFcn(opt.moveLimiter[z], opt.moveLimit[z], opt.resizeLimit[z]),
						style: opt.modifiers[z],
						grid: opt.grid.x
					}
				}
			}
			var binds = {
				move: drag.add(el, moveOpts)
			}, resize = {
				opts: {},
				bind: {}
			};
			this.binds[d] = binds;
			if ($defined(mod.x)) {
				resize.opts.x = {
					limit: mod.x < 0 ? false : resizeLimit.x,
					grid: mod.x < 0 ? false : opt.grid.x,
					style: opt.modifiers.width,
					direction: mod.x
				};
				if (mod.x < 0) resize.bind.x = binds.move.x
			}
			if ($defined(mod.y)) {
				resize.opts.y = {
					limit: mod.y < 0 ? false : resizeLimit.y,
					grid: mod.y < 0 ? false : opt.grid.y,
					style: opt.modifiers.height,
					direction: mod.y
				};
				if (mod.y < 0) resize.bind.y = binds.move.y
			}
			binds.resize = drag.add(el, resize.opts, resize.bind);
			if (opt.preserveRatio) {
				var aspect = {
					'x': {
						fn: this.aspectStep.x,
						style: ($defined(mod.x)) ? opt.modifiers.height : null,
						direction: mod.x
					},
					'y': {
						fn: this.aspectStep.y,
						style: ($defined(mod.y)) ? opt.modifiers.width : null,
						direction: mod.y
					}
				};
				binds.aspect = drag.add(el, aspect, binds.resize)
			}
			this.fireEvent('onBuild', [d, binds])
		}
		this.bound = (!this.options.hoverClass) ? {} : {
			'mouseenter': function () {
				this.addClass(self.options.hoverClass)
			},
			'mouseleave': function () {
				if (!self.started) this.removeClass(self.options.hoverClass)
			}
		};
		this.attach();
		if (this.options.initialize) this.options.initialize()
	},
	add: function (callback) {
		for (var d in this.options.direction) callback.call(this, d, this.binds[d])
	},
	attach: function () {
		$each(this.bound, function (fn, ev) {
			this.addEvent(ev, fn)
		}, this.el);
		for (var z in this.fx) this.element.adopt(this.fx[z].handle);
		return this
	},
	detach: function () {
		$each(this.bound, function (fn, ev) {
			this.removeEvent(ev, fn)
		}, this.el);
		for (var z in this.fx) this.fx[z].handle.remove();
		return this
	},
	stop: function () {
		this.detach();
		if (this.ghost) this.ghost.destroy();
		for (var z in this.fx) this.fx[z].handle.destroy();
		this.fx = this.bound = this.binds = {}
	}
});
Element.implement({
	makeResizable: function (options) {
		options = options || {};
		if (options.handle) return new Drag(this, $merge({
			modifiers: {
				'x': 'width',
				'y': 'height'
			}
		}, options));
		return new Drag.Resize(this, options)
	}
});
Drag.ResizeImage = new Class({
	Implements: [Events, Options],
	initialize: function (el, options) {
		this.image = $(el);
		this.styles = this.image.getStyles('position', 'top', 'left', 'right', 'bottom', 'z-index', 'margin');
		if (!['absolute', 'fixed', 'relative'].contains(this.styles.position)) this.styles.position = 'relative';
		this.wrapper = new Element('div', {
			'styles': $merge(this.styles, {
				'width': this.image.offsetWidth,
				'height': this.image.offsetHeight
			})
		}).inject(this.image, 'before').adopt(this.image.remove().setStyles({
			'position': 'absolute',
			'top': '0',
			'left': '0',
			'margin': '0',
			'width': '100%',
			'height': '100%',
			'zIndex': '0'
		}));
		this.fx = new Drag.Resize(this.wrapper, $merge({
			'preserveRatio': true
		}, options))
	},
	stop: function () {
		this.image.setStyles($merge(this.styles, {
			'width': this.wrapper.getStyle('width'),
			'height': this.wrapper.getStyle('height')
		})).remove().inject(this.wrapper, 'before');
		this.fx = null;
		this.wrapper.destroy()
	}
});
Fx.Overlay = new Class({
	Implements: Options,
	options: {
		'styles': {
			'position': 'absolute',
			'top': 0,
			'left': 0
		}
	},
	initialize: function (element, props, tag) {
		this.element = $(element);
		this.setOptions(props);
		if ([$(window), $(document.body)].contains(this.element)) {
			this.padding = Fx.Overlay.windowPadding;
			this.container = $(document.body);
			this.element = Window
		} else {
			this.padding = {
				x: 0,
				y: 0
			};
			this.container = this.element
		}
		this.overlay = new Element($pick(tag, 'div'), {
			'styles': {
				'display': 'none'
			}
		}).inject(this.container);
		this.update()
	},
	show: function () {
		this.overlay.setStyle('display', 'block');
		return this
	},
	update: function (props) {
		this.overlay.set($merge(this.options, {
			'styles': {
				width: this.element.getScrollSize().x - this.padding.x,
				height: this.element.getScrollSize().y - this.padding.y
			}
		}, props));
		return this
	},
	hide: function () {
		this.overlay.setStyle('display', 'none');
		return this
	},
	destroy: function () {
		this.overlay.destroy();
		return this
	}
});
Fx.Overlay.windowPadding = (Browser.Engine.trident4) ? {
	x: 21,
	y: 4
} : {
	x: 0,
	y: 0
};
Element.$overlay = function (hide, deltaZ) {
	deltaZ = $pick(deltaZ, 1);
	if (!this.fixOverlayElement) {
		this.fixOverlayElement = new Element('iframe', {
			'properties': {
				'frameborder': '0',
				'scrolling': 'no',
				'src': 'javascript:void(0);'
			},
			'styles': {
				'position': this.getStyle('position'),
				'border': 'none',
				'filter': 'progid:DXImageTransform.Microsoft.Alpha(opacity=0)'
			}
		}).inject(this, 'before');
		this.addEvent('trash', function () {
			if (this.fixOverlayElement && this.fixOverlayElement.parentNode == this) this.fixOverlayElement.destroy()
		}, this)
	}
	if (hide) return this.fixOverlayElement.setStyle('display', 'none');
	var z = this.getStyle('z-index').toInt() || 0;
	if (z < deltaZ) this.setStyle('z-index', '' + (z = deltaZ + 1));
	var pos = this.getCoordinates();
	return this.fixOverlayElement.setStyles({
		'display': '',
		'z-index': '' + (z - deltaZ),
		'left': pos.left + 'px',
		'top': pos.top + 'px',
		'width': pos.width + 'px',
		'height': pos.height + 'px'
	})
};
Element.implement({
	fixOverlay: Browser.Engine.trident4 ? Element.$overlay : function () {
		return false
	},
	remove: function () {
		if (this.fixOverlayElement) this.fixOverlayElement.remove();
		return this.parentNode.removeChild(this)
	},
	destroy: function () {
		if (this.parentNode) this.remove();
		Browser.freeMem(this.empty());
		return null
	}
});
var Windoo = new Class({
	Implements: [Options, Events],
	options: {
		type: 'dom',
		url: false,
		title: 'Windoo!',
		width: 300,
		height: 200,
		position: 'center',
		top: 0,
		left: 0,
		resizable: true,
		draggable: true,
		positionStyle: 'absolute',
		resizeLimit: {
			'x': [0],
			'y': [0]
		},
		padding: {
			'top': 0,
			'right': 0,
			'bottom': 0,
			'left': 0
		},
		ghost: {
			'resize': false,
			'move': false
		},
		snap: {
			'resize': 6,
			'move': 6
		},
		destroyOnClose: true,
		container: null,
		restrict: true,
		theme: 'alphacube',
		shadow: true,
		modal: false,
		buttons: {
			menu: false,
			close: true,
			minimize: true,
			roll: false,
			maximize: true
		},
		'class': '',
		wm: false,
		effects: {
			show: {
				options: {
					'duration': 600
				},
				styles: {
					'opacity': [0, 1]
				}
			},
			close: {
				options: {
					'duration': 600
				},
				styles: {
					'opacity': [1, 0]
				}
			},
			hide: {
				options: {
					'duration': 600
				},
				styles: {
					'opacity': [1, 0]
				}
			}
		}
	},
	makeResizable: $empty,
	makeDraggable: $empty,
	initialize: function (options) {
		var self = this;
		this.fx = {};
		this.bound = {};
		this.padding = {};
		this.panels = [];
		this.zIndex = 0;
		this.visible = false;
		this.options.id = 'windoo-' + (new Date().getTime());
		this.setOptions(options);
		options = this.options;
		var theme = this.theme = $type(options.theme) == 'string' ? Windoo.Themes[options.theme] : options.theme;
		options.container = $(options.container || document.body);
		for (var side in theme.padding) this.padding[side] = theme.padding[side] + options.padding[side];
		['x', 'y'].each(function (z) {
			var lim = options.resizeLimit;
			if ($type(lim[z][0]) == 'number') lim[z][0] = Math.max(lim[z][0], theme.resizeLimit[z][0])
		}, this);
		this.buildDOM().setSize(options.width, options.height).setTitle(options.title).fix();
		this.minimized = false;
		if (options.draggable) this.makeDraggable();
		if (options.resizable) this.makeResizable();
		if (options.position == 'center') this.positionAtCenter();
		this.wm = options.wm || Windoo.$wm;
		this.wm.register(this)
	},
	buildDOM: function () {
		var theme = this.theme,
			_p = theme.classPrefix;
		this.el = new Element('div', {
			'id': this.options.id,
			'class': theme.className,
			'styles': {
				'position': this.options.positionStyle,
				'overflow': 'hidden',
				'visibility': 'hidden',
				'top': this.options.top,
				'left': this.options.left
			},
			'events': {
				'mousedown': this.focus.bind(this)
			}
		});
		if (this.options['class']) this.el.addClass(this.options['class']);
		var $row = function (prefix, contentClass) {
			return '<div class="' + prefix + '-left ' + _p + '-drag"><div class="' + prefix + '-right"><div class="' + contentClass + '"></div></div></div>'
		};
		var iefix = Browser.Engine.trident && this.options.type != 'iframe',
			innerContent = '<div class="' + _p + '-frame">' + $row("top", "title") + $row("bot", "strut") + '</div><div class="' + _p + '-body">' + (iefix ? Windoo.ieTableCell : '') + '</div>';
		this.el.set('html', innerContent).inject(this.options.container);
		if (Browser.Engine.trident) this.el.addClass(_p + '-' + theme.name + '-ie');
		var frame = this.el.getFirst(),
			body = this.el.getLast(),
			titleBody = frame.getElement('.title'),
			titleText = new Element('div', {
				'class': 'title-text'
			}).inject(titleBody);
		this.dom = {
			frame: frame,
			body: body,
			title: titleText,
			titleBody: titleBody,
			strut: frame.getElement('.strut').set('html', '&nbsp;'),
			content: iefix ? body.getElement('td') : body
		};
		if (this.options.type == 'iframe') {
			this.dom.iframe = new Element('iframe', {
				'frameborder': '0',
				'class': _p + '-body',
				'styles': {
					'width': '100%',
					'height': '100%'
				}
			});
			this.dom.body.setStyle('overflow', 'hidden');
			this.adopt(this.dom.iframe).setURL(this.options.url)
		}
		return this.buildShadow().buildButtons()
	},
	buildButtons: function () {
		var self = this,
			buttons = this.options.buttons,
			_p = this.theme.classPrefix;
		var action = function (name, bind) {
			return function (event) {
				event.stop();
				(bind[name])()
			}
		};
		this.bound.noaction = function (event) {
			event.stop()
		};
		var makeButton = function (opt, name, title, action) {
			self.bound[name] = action;
			if (opt) {
				var klass = _p + '-button ' + _p + '-' + name + (opt == 'disabled' ? ' ' + _p + '-' + name + '-disabled' : '');
				self.dom[name] = new Element('a', {
					'class': klass,
					'href': '#',
					'title': title
				}).set('html', 'x').inject(self.el);
				self.dom[name].addEvent('click', opt == 'disabled' ? self.bound.noaction : action)
			}
		};
		makeButton(buttons.close, 'close', 'Close', action('close', this));
		makeButton(buttons.maximize, 'maximize', 'Maximize', action('maximize', this));
		if (buttons.maximize == true) this.dom.titleBody.addEvent('dblclick', this.maximize.bind(this));
		makeButton(buttons.minimize, 'minimize', 'Minimize', action(buttons.roll ? 'roll' : 'minimize', this));
		makeButton(buttons.minimize, 'restore', 'Restore', action('minimize', this));
		makeButton(buttons.menu, 'menu', 'Menu', action('openmenu', this));
		return this
	},
	buildShadow: function () {
		var theme = this.theme;
		if (this.options.modal) this.modalOverlay = new Fx.Overlay(this.el.getParent(), {
			'class': this.classPrefix('modal-overlay')
		});
		if (!theme.shadow || !this.options.shadow) return this;
		this.shadow = new Element('div', {
			'styles': {
				'position': this.options.positionStyle,
				'display': 'none'
			},
			'class': theme.classPrefix + '-shadow-' + theme.shadow
		}).inject(this.el, 'after');
		if (theme.complexShadow) {
			var $row = function (name) {
				var els = ['l', 'r', 'm'].map(function (e) {
					return new Element('div', {
						'class': e
					})
				});
				var el = new Element('div', {
					'class': name
				});
				return el.adopt.apply(el, els)
			};
			this.shadow.adopt($row('top'), this.dom.shm = $row('mid'), $row('bot'))
		} else {
			this.shadow.adopt(new Element('div', {
				'class': 'c'
			}))
		}
		return this
	},
	setHTML: function (content) {
		if (!this.dom.iframe) this.dom.content.empty().set('html', content);
		return this
	},
	adopt: function () {
		this.dom.content.empty().adopt.apply(this.dom.content, arguments);
		return this
	},
	wrap: function (el, options) {
		var styles = {
			'margin': '0',
			'position': 'static'
		};
		el = $(el);
		options = options || {};
		var size = el.getSize(),
			pos = el.getPosition(),
			coeff = options.ignorePadding ? 0 : 1,
			pad = this.padding;
		this.setSize(size.x + coeff * (pad.right + pad.left), size.y + coeff * (pad.top + pad.bottom));
		if (options.resetWidth) styles.width = 'auto';
		if (options.position) this.setPosition(pos.x - coeff * pad.left, pos.y - coeff * pad.top);
		this.dom.content.empty().adopt(el.remove().setStyles(styles));
		return this
	},
	empty: function () {
		if (this.dom.iframe) this.dom.iframe.src = 'about:blank';
		else this.dom.content.empty();
		return this
	},
	setURL: function (url) {
		if (this.dom.iframe) this.dom.iframe.src = url || 'about:blank';
		return this
	},
	getContent: function () {
		return this.dom.content
	},
	setTitle: function (title) {
		this.dom.title.set('html', title || '&nbsp;');
		return this
	},
	effect: function (name, noeffect, onComplete) {
		var fx = this.options.effects[name],
			elements = [fx.el || this.el],
			styles = {
				"0": fx.styles
			};
		if (this.shadow) {
			elements.push(this.shadow);
			styles["1"] = fx.styles
		}
		var opts = {
			onComplete: onComplete
		};
		if (noeffect) opts.duration = 0;
		new Fx.Elements(elements, $merge(fx.options, opts)).start(styles);
		return this
	},
	hide: function (noeffect) {
		if (!this.visible) return this;
		this.visible = false;
		return this.effect('hide', noeffect, function () {
			this.el.setStyle('display', 'none');
			if (this.modalOverlay) this.modalOverlay.hide();
			this.fix(true).fireEvent('onHide')
		}.bind(this))
	},
	show: function (noeffect) {
		if (this.visible) return this;
		this.visible = true;
		if (this.modalOverlay) this.modalOverlay.show();
		if (this.shadow) this.shadow.setStyle('visibility', 'hidden');
		this.el.setStyle('display', '');
		this.bringTop().fix();
		return this.effect('show', noeffect, function () {
			this.el.setStyle('visibility', 'visible');
			this.fireEvent('onShow').fix()
		}.bind(this))
	},
	fix: function (hide) {
		this.el.fixOverlay(hide || !this.visible);
		return this.fixShadow(hide)
	},
	fixShadow: function (hide) {
		if (this.shadow) {
			this.shadow[(this.maximized ? 'add' : 'remove') + 'Class']('windoo-shadow-' + this.theme.name + '-maximized');
			if (hide || !this.visible) {
				this.shadow.setStyle('display', 'none')
			} else {
				var pos = this.el.getCoordinates(),
					pad = this.theme.shadowDisplace;
				this.shadow.setStyles({
					'display': '',
					'zIndex': this.zIndex - 1,
					'left': this.el.offsetLeft + pad.left,
					'top': this.el.offsetTop + pad.top,
					'width': pos.width + pad.width,
					'height': pos.height + pad.height
				});
				if (this.dom.shm) this.dom.shm.setStyle('height', pos.height - pad.delta)
			}
		}
		return this
	},
	getState: function () {
		var outer = this.el.getCoordinates(),
			container = this.options.container,
			cont = container === $(document.body) ? {
				'top': 0,
				'left': 0
			} : container.getCoordinates();
		outer.top -= cont.top;
		outer.right -= cont.left;
		outer.bottom -= cont.top;
		outer.left -= cont.left;
		return {
			outer: outer,
			inner: this.dom.content.getSize()
		}
	},
	setSize: function (width, height) {
		var pad = this.padding;
		this.el.setStyles({
			'width': width,
			'height': height
		});
		this.dom.strut.setStyle('height', Math.max(0, height - pad.top));
		this.dom.body.setStyle('height', Math.max(0, height - pad.top - pad.bottom));
		return this.fix().fireEvent('onResizeComplete', this.fx.resize)
	},
	positionAtCenter: function (offset) {
		offset = $merge({
			'x': 0,
			'y': 0
		}, offset);
		var container = this.options.container;
		if (container === document.body) container = window;
		var s = container.getSize(),
			esize = this.el.getSize(),
			fn = function (z) {
				return Math.max(0, offset[z] + container.getScroll()[z] + (s[z] - esize[z]) / 2)
			};
		this.el.setStyles({
			'left': fn('x'),
			'top': fn('y')
		});
		return this.fix()
	},
	setPosition: function (x, y) {
		this.el.setStyles({
			'left': x,
			'top': y
		});
		return this.fix()
	},
	preventClose: function (prevent) {
		this.$preventClose = $defined(prevent) ? prevent : true;
		return this
	},
	close: function (noeffect) {
		this.$preventClose = false;
		this.fireEvent('onBeforeClose');
		if (this.$preventClose) return this;
		if (!this.visible) return this;
		this.visible = false;
		return this.effect('close', noeffect, function () {
			this.el.setStyle('display', 'none');
			if (this.modalOverlay) this.modalOverlay.hide();
			this.fix(true).fireEvent('onClose');
			if (this.options.destroyOnClose) this.destroy()
		}.bind(this))
	},
	destroy: function () {
		this.fireEvent('onDestroy');
		this.wm.unregister(this);
		if (this.modalOverlay) this.modalOverlay.destroy();
		if (this.shadow) this.shadow.destroy();
		if (this.ghost) this.ghost.destroy();
		if (this.fx.resize) this.fx.resize.stop();
		this.el.destroy();
		for (var z in this) this[z] = null;
		this.destroyed = true
	},
	classPrefix: function (klass) {
		return [this.theme.classPrefix, this.theme.name, klass + ' ' + this.theme.classPrefix, klass].join('-')
	},
	maximize: function (noeffect) {
		if (this.minimized) return this.minimize();
		if (this.rolled) this.roll(true);
		var bound = function (value, limit) {
			if (!limit) return value;
			if (value < limit[0]) return limit[0];
			if (limit.length > 1 && value > limit[1]) return limit[1];
			return value
		};
		var klass = this.classPrefix('maximized');
		this.maximized = !this.maximized;
		this.minimized = false;
		if (this.maximized) {
			this.$restoreMaxi = this.getState();
			var container = this.options.container;
			if (container === document.body) container = window;
			var s = container.getSize(),
				limit = this.options.resizeLimit;
			if (limit) for (var z in limit) s[z] = bound(s[z], limit[z]);
			this.el.addClass(klass);
			this.setSize(s.x, s.y).setPosition(container.getScroll().x, container.getScroll().y).fireEvent('onMaximize')
		} else {
			this.el.removeClass(klass);
			this.restoreState(this.$restoreMaxi).fireEvent('onRestore', 'maximize')
		}
		return this.fix()
	},
	minimize: function (noeffect) {
		var klass = this.classPrefix('minimized');
		this.minimized = !this.minimized;
		if (this.minimized) {
			this.$restoreMini = this.getState();
			var container = this.options.container;
			if (container === document.body) container = window;
			var s = container.getSize(),
				height = this.theme.padding.top + this.theme.padding.bottom;
			this.el.addClass(klass);
			this.setSize('auto', height).setPosition(container.getScroll().x + 10, container.getScroll().y + s.y - height - 10).fireEvent('onMinimize')
		} else {
			this.el.removeClass(klass);
			this.restoreState(this.$restoreMini).fireEvent('onRestore', 'minimize')
		}
		return this.fix()
	},
	restoreState: function (state) {
		state = state.outer;
		return this.setSize(state.width, state.height).setPosition(state.left, state.top)
	},
	roll: function (noeffect) {
		var klass = this.classPrefix('rolled');
		this.rolled = !this.rolled;
		if (this.rolled) {
			this.$restoreRoll = this.getState().outer;
			var pad = this.theme.padding;
			this.setSize(this.$restoreRoll.width, pad.top + pad.bottom);
			this.el.addClass(klass);
			this.fireEvent('onRoll')
		} else {
			this.el.removeClass(klass);
			var state = this.$restoreRoll;
			this.setSize(state.width, state.height).fireEvent('onRestore', 'roll')
		}
		return this.fix()
	},
	openmenu: function () {
		this.fireEvent('onMenu');
		return this
	},
	setZIndex: function (z) {
		this.zIndex = z;
		this.el.setStyle('zIndex', z);
		if (this.el.fixOverlayElement) this.el.fixOverlayElement.setStyle('zIndex', z - 1);
		if (this.shadow) this.shadow.setStyle('zIndex', z - 1);
		if (this.fx.resize) this.fx.resize.options.zIndex = z + 1;
		if (this.modalOverlay) this.modalOverlay.overlay.setStyle('zIndex', z - 2);
		return this
	},
	focus: function () {
		this.el.removeClass(this.theme.classPrefix + '-blur');
		this.wm.focus(this);
		return this
	},
	blur: function () {
		this.el.addClass(this.theme.classPrefix + '-blur');
		if (this.wm.blur(this)) this.fireEvent('onBlur');
		return this
	},
	bringTop: function () {
		return this.setZIndex(this.wm.maxZIndex())
	}
});
Windoo.ieTableCell = '<table style="position:absolute;top:0;left:0;border:none;border-collapse:collapse;padding:0;"><tr><td style="border:none;overflow:auto;position:relative;padding:0;width:100%;height:100%;"></td></tr></table>';
Windoo.Themes = {
	cssFirefoxMac: '.windoo-blur * {overflow: hidden !important;}',
	alphacube: {
		'name': 'alphacube',
		'padding': {
			'top': 22,
			'right': 10,
			'bottom': 15,
			'left': 10
		},
		'resizeLimit': {
			'x': [275],
			'y': [37]
		},
		'className': 'windoo windoo-alphacube',
		'sizerClass': 'sizer',
		'classPrefix': 'windoo',
		'ghostClass': 'windoo-ghost windoo-alphacube-ghost windoo-hover',
		'hoverClass': 'windoo-hover',
		'shadow': 'simple window-shadow-alphacube-simple',
		'shadeBackground': 'transparent url(windoo/s.gif)',
		'shadowDisplace': {
			'left': 3,
			'top': 3,
			'width': 0,
			'height': 0
		}
	}
};
if (Browser.Engine.gecko && navigator.appVersion.indexOf('acintosh') >= 0) window.addEvent('domready', function () {
	new Element('style', {
		'type': 'text/css',
		'media': 'all'
	}).inject(document.head).appendText(Windoo.Themes.cssFirefoxMac)
});
Windoo.Manager = new Class({
	Implements: [Events, Options],
	focused: false,
	options: {
		zIndex: 100
	},
	initialize: function (options) {
		this.hash = [];
		this.setOptions(options)
	},
	maxZIndex: function () {
		var windows = this.hash;
		if (!windows.length) return this.options.zIndex;
		var zindex = [];
		windows.each(function (item) {
			this.push(item.zIndex)
		}, zindex);
		zindex.sort(function (a, b) {
			return a - b
		});
		return zindex.getLast() + 3
	},
	register: function (win) {
		win.setZIndex(this.maxZIndex());
		this.hash.push(win);
		return this.fireEvent('onRegister', win)
	},
	unregister: function (win) {
		this.hash.erase(win);
		if (this.focused === win) this.focused = false;
		return this.fireEvent('onUnregister', win)
	},
	focus: function (win) {
		if (win === this.focused) return this;
		if (this.focused) this.focused.blur();
		this.focused = win;
		win.bringTop(this.maxZIndex());
		return this.fireEvent('onFocus', win)
	},
	blur: function (win) {
		if (this.focused === win) {
			this.focused = false;
			this.fireEvent('onBlur', win);
			return true
		}
		return false
	}
});
Windoo.$wm = new Windoo.Manager();
Windoo.implement({
	addPanel: function (element, position) {
		position = $pick(position, 'bottom');
		var dim, ndim, size = this.el.getSize(),
			styles = {
				'position': 'absolute'
			}, panel = {
				'element': $(element),
				'position': position,
				'fx': []
			};
		switch (position) {
		case 'top':
		case 'bottom':
			dim = 'x';
			ndim = 'y';
			break;
		case 'left':
		case 'right':
			dim = 'y';
			ndim = 'x';
			break;
		default:
			return this
		}
		var options = Windoo.panelOptions[dim];
		styles[position] = this.padding[position];
		styles[options.deltaP] = this.padding[options.deltaP];
		element = panel.element.addClass(this.classPrefix('pane')).setStyles(styles).inject(this.el);
		panel.padding = element.getSize()[ndim];
		this.padding[position] += panel.padding;
		if (this.options.resizable && !this.options.ghost.resize) {
			this.fx.resize.add(function (dir, binds) {
				if (binds.resize[dim]) {
					var fx = this.fx[dir],
						mod = {};
					mod[dim] = $merge(binds.resize[dim]);
					mod[dim].limit = null;
					panel.fx.push({
						'fx': fx,
						'bind': fx.add(panel.element, mod, binds.resize)
					})
				}
			})
		}
		this.addEvent('onResizeComplete', function () {
			panel.element.setStyle(options.style, this.el.getSize()[dim] - this.padding[options.deltaM] - this.padding[options.deltaP] - 1)
		});
		this.panels.push(panel);
		return this.setSize(size.x, size.y)
	},
	removePanel: function (element) {
		var panel, size;
		element = $(element);
		for (var i = 0, len = this.panels.length; i < len; i++) {
			panel = this.panels[i];
			if (panel.element === element) {
				this.padding[panel.position] -= panel.padding;
				panel.element.destroy();
				panel.fx.each(function (pfx) {
					pfx.fx.detach(pfx.bind)
				}, this);
				this.panels.splice(i, 1);
				size = this.el.getSize();
				this.setSize(size.x, size.y);
				break
			}
		}
		return this
	}
});
Windoo.panelOptions = {
	'x': {
		'style': 'width',
		'deltaP': 'left',
		'deltaM': 'right'
	},
	'y': {
		'style': 'height',
		'deltaP': 'top',
		'deltaM': 'bottom'
	}
};
Windoo.Ajax = new Class({
	Extends: Request,
	onComplete: function () {
		if (this.options.window) this.options.window.set('html', this.response.text);
		this.parent()
	}
});
Windoo.Dialog = new Class({
	Extends: Windoo,
	initialize: function (message, options) {
		var self = this,
			dialog = this.dialog = {
				dom: {},
				buttons: {},
				options: $merge(Windoo.Dialog.options, options),
				message: message
			};
		this.parent($merge({
			'onShow': function () {
				if (dialog.buttons.ok) dialog.buttons.ok.focus()
			}
		}, dialog.options.window));
		dialog.bound = function (event) {
			if (['enter', 'esc'].contains(event.key)) {
				dialog.result = (event.key == 'enter') ? !dialog.cancelFocused : false;
				self.close();
				event.stop()
			}
		};
		document.addEvent('keydown', dialog.bound);
		this.addEvent('onClose', function () {
			document.removeEvent('keydown', dialog.bound);
			dialog.options[(dialog.result) ? 'onConfirm' : 'onCancel'].call(this)
		})
	},
	buildDialog: function (klass, buttons) {
		var self = this,
			dialog = this.dialog;
		if ('ok' in buttons) dialog.buttons.ok = new Element('input', $merge({
			'events': {
				'click': function () {
					dialog.result = true;
					self.close()
				}
			}
		}, dialog.options.buttons.ok.properties));
		if ('cancel' in buttons) dialog.buttons.cancel = new Element('input', $merge({
			'events': {
				'click': function () {
					dialog.result = false;
					self.close()
				}
			}
		}, dialog.options.buttons.cancel.properties)).addEvents({
			'focus': function () {
				dialog.cancelFocused = true
			},
			'blur': function () {
				dialog.cancelFocused = false
			}
		});
		dialog.dom.panel = new Element('div', $merge({
			'class': this.classPrefix(klass + '-pane')
		}, dialog.options.panel));
		for (var btn in buttons) if (buttons[btn]) dialog.dom.panel.adopt(dialog.buttons[btn]);
		dialog.dom.message = new Element('div', $merge({
			'class': this.classPrefix(klass + '-message')
		}, dialog.options.message));
		return this.addPanel(dialog.dom.panel).adopt(dialog.dom.message.set('html', dialog.message))
	}
});
Windoo.Dialog.options = {
	'window': {
		'modal': true,
		'resizable': false,
		'buttons': {
			'minimize': false,
			'maximize': false
		}
	},
	'buttons': {
		'ok': {
			'properties': {
				'type': 'button',
				'value': 'OK'
			}
		},
		'cancel': {
			'properties': {
				'type': 'button',
				'value': 'Cancel'
			}
		}
	},
	'panel': null,
	'message': null,
	'onConfirm': $empty,
	'onCancel': $empty
};
Windoo.Alert = new Class({
	Extends: Windoo.Dialog,
	initialize: function (message, options) {
		this.parent(message, options);
		this.buildDialog('alert', {
			'ok': true
		}).show()
	}
});
Windoo.Confirm = new Class({
	Extends: Windoo.Dialog,
	initialize: function (message, options) {
		this.parent(message, options);
		this.buildDialog('confirm', {
			'ok': true,
			'cancel': true
		}).show()
	}
});
Windoo.implement({
	makeResizable: function () {
		var self = this,
			theme = this.theme,
			opt = this.options,
			inbody = opt.container === $(document.body);
		this.fx.resize = this.el.makeResizable({
			ghostClass: theme.ghostClass,
			hoverClass: theme.hoverClass,
			classPrefix: theme.classPrefix + '-sizer ' + theme.classPrefix + '-',
			shadeBackground: theme.shadeBackground,
			container: (opt.restrict && !inbody) ? opt.container : false,
			resizeLimit: opt.resizeLimit,
			ghost: opt.ghost.resize,
			snap: opt.snap.resize,
			onBeforeStart: function () {
				self.fireEvent('onBeforeResize', this).focus()
			},
			onStart: function (fx) {
				if (self.maximized) {
					fx.stop()
				} else {
					if (!this.ghost && Browser.Engine.gecko) Element.$overlay.call(fx.shade.overlay);
					self.fireEvent('onStartResize', this)
				}
			},
			onResize: function () {
				self.fireEvent('onResize', this)
			},
			onComplete: function () {
				if (this.ghost) {
					var size = self.getState().outer;
					self.setSize(size.width, size.height)
				} else {
					self.fix().fireEvent('onResizeComplete', this)
				}
			},
			onBuild: function (dir, binds) {
				if (!this.ghost) {
					var fx = this.fx[dir],
						nolimit = {
							'x': {
								'limit': false
							},
							'y': {
								'limit': false
							}
						};
					if (binds.resize.y)['strut', 'body', 'shm'].each(function (name) {
						if (this[name]) fx.add(this[name], {
							'y': {
								direction: binds.resize.y.direction,
								style: 'height'
							}
						}, binds.resize)
					}, self.dom);
					[self.shadow, self.el.fixOverlayElement].each(function (el) {
						if (el) {
							fx.add(el, $merge(binds.resize, nolimit), binds.resize);
							if (binds.move) fx.add(el, $merge(binds.move, nolimit), binds.move)
						}
					}, self)
				}
			}
		})
	},
	makeDraggable: function () {
		var self = this,
			fx = this.fx.drag = [],
			inbody = this.options.container === $(document.body);
		var xLimit = function () {
			return 2 - self.el.offsetWidth
		};
		var opts = {
			container: (this.options.restrict && !inbody ? this.options.container : null),
			limit: (inbody ? {
				'x': [xLimit],
				'y': [0]
			} : {}),
			snap: this.options.snap.move,
			onBeforeStart: function () {
				self.focus();
				this.shade = new Fx.Overlay(window, {
					'styles': {
						'cursor': this.options.handle.getStyle('cursor'),
						'background': self.theme.shadeBackground,
						'zIndex': self.zIndex + 3
					}
				}).show();
				if (self.ghost) {
					var ce = self.el.getSize();
					this.element.setStyles({
						'zIndex': self.zIndex + 3,
						'left': self.el.getStyle('left'),
						'top': self.el.getStyle('top'),
						'width': ce.x,
						'height': ce.y
					})
				} else if (Browser.Engine.gecko) {
					Element.$overlay.call(this.shade.overlay, false, 2)
				}
				self.fireEvent('onBeforeDrag', this)
			},
			onStart: function () {
				if (self.maximized && !self.minimized) this.stop();
				else self.fireEvent('onStartDrag', this)
			},
			onSnap: function () {
				if (self.ghost) this.element.setStyle('display', 'block')
			},
			onDrag: function () {
				self.fix().fireEvent('onDrag', this)
			},
			onComplete: function () {
				this.shade.destroy();
				if (self.ghost) {
					for (var z in this.options.modifiers) {
						var style = this.options.modifiers[z];
						self.el.setStyle(style, this.element.getStyle(style))
					}
					this.element.setStyle('display', 'none')
				}
				self.fix().fireEvent('onDragComplete', this)
			}
		};
		if (this.options.ghost.move) this.ghost = new Element('div', {
			'class': this.theme.ghostClass,
			'styles': {
				'display': 'none'
			}
		}).inject(this.el, 'after');
		this.el.getElements('.' + this.theme.classPrefix + '-drag').each(function (d) {
			opts.handle = d;
			d.setStyle('cursor', 'move');
			fx.push((this.ghost || this.el).makeDraggable(opts))
		}, this)
	}
});
Windoo.Themes.aero = {
	'name': 'aero',
	'padding': {
		'top': 28,
		'right': 10,
		'bottom': 15,
		'left': 10
	},
	'resizeLimit': {
		'x': [175],
		'y': [58]
	},
	'className': 'windoo windoo-aero',
	'sizerClass': 'sizer',
	'classPrefix': 'windoo',
	'ghostClass': 'windoo-ghost windoo-aero-ghost windoo-hover',
	'hoverClass': 'windoo-hover',
	'shadow': 'simple window-shadow-aero-simple',
	'shadeBackground': 'transparent url(windoo/s.gif)',
	'shadowDisplace': {
		'left': 3,
		'top': 3,
		'width': 0,
		'height': 0
	}
};
Windoo.Themes.aqua = {
	'name': 'aqua',
	'padding': {
		'top': 23,
		'right': 0,
		'bottom': 15,
		'left': 0
	},
	'resizeLimit': {
		'x': [275],
		'y': [37]
	},
	'className': 'windoo windoo-aqua',
	'sizerClass': 'sizer',
	'classPrefix': 'windoo',
	'ghostClass': 'windoo-ghost windoo-aqua-ghost windoo-hover',
	'hoverClass': 'windoo-hover',
	'shadeBackground': 'transparent url(themes/windoo/s.gif)',
	'shadow': 'aqua',
	'complexShadow': true,
	'shadowDisplace': {
		'left': -13,
		'top': -8,
		'width': 26,
		'height': 31,
		'delta': 23
	}
};