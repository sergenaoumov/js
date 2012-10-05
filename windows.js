var dWindowZIndex = 100;

var dWindow = new Class({
	options: {
		minWidth : 150,
		minHeight : 150,
		width : 200,
		height : 200,
		top : 0,
		left : 0,
		resizable : true,
		statusBar : true,
		content : '',
		id : ''
	},
	
	handle : null,
	
	drag : null,
	
	dragParams : {},

	// аКаОаНббббаКбаОб аКаЛаАббаА
	initialize: function(options){
		this.setOptions(options);
	},
	
	
	_create : function(id){
		var target = $(id);
		if (!target)
			return;
		
		this.handle = new Element('div', {
								'class':'dWindow',
								'id' : this.options.id,
								styles : {
									'width':this.options.width + 2,
									'left':this.options.left,
									'top':this.options.top,
									'z-index':dWindowZIndex
								}
							});
		dWindowZIndex++;
		this.handle.addEvent('mousedown', this.up.bind(this));
		
		var bar = new Element('div', {'class':'topBar'});
		var closeBtn = new Element('div', {'class':'closeBtn'});
		closeBtn.addEvent('click', this.close.bind(this));
		closeBtn.injectInside(bar);

		var table = new Element('table',{
			'class':'dContainer',
			'cellpadding':0,
			'cellspacing':0,
			'border':0
		});

		var tbody = new Element('tbody');

		// аПаЕбаВбаЙ ббаД
		var row = new Element('tr');
		var leftBorder = new Element('td', {'rowspan':2,'class':'leftBorder'});
		var rightBorder = new Element('td', {'rowspan':2,'class':'rightBorder'});
		var center = new Element('td');
		var content = new Element('div',{'class':'centralArea', styles : {'width':this.options.width, 'height':this.options.height}});
		content.set('html',this.options.content);
		center.adopt(content);
		
		row.adopt([leftBorder, center, rightBorder]);

		var row2 = new Element('tr');
		var statusBar = new Element('td',{'class':'statusBar'});
		var brResize = new Element('div', {'class':'resize'});
		brResize.injectInside(statusBar);
		statusBar.injectInside(row2);
		
		var row3 = new Element('tr');
		var bottomBorder = new Element('td', {'colspan':3,'class':'bottomBorder'});
		bottomBorder.injectInside(row3);
		
		row.injectInside(tbody);
		row2.injectInside(tbody);
		row3.injectInside(tbody);
		
		tbody.injectInside(table);
		
		this.handle.adopt([bar, table]);

		
		this.handle.injectInside(target);
		
		this.drag = new Drag.Move(this.handle, {
		    snap: 0,
		    handle: bar,
			container: target,
		    onSnap: function(el){
		        el.addClass('dragging');
		    },
		    onComplete: function(el){
		        el.removeClass('dragging');
		    }
		});
		
		var that = this;
		this.rbDrag = new Drag(rightBorder, {
			onSnap : function(elem){
				that.dragParams.w = content.getSize().x;
				that.dragParams.W = that.handle.getSize().x;
				that.dragParams.target = content;
			},
			
			onDrag : function(elem){
				var delta = this.mouse.now.x - this.mouse.start.x;
				var w = that.dragParams.w + delta;
				var targetPos = that.dragParams.target.getPosition();
				
				if (w < that.options.minWidth || (W + targetPos.x) > (window.getScrollLeft() + window.getWidth())) {
					return;
				}
				
				var W = that.dragParams.W + delta;
				that.dragParams.target.setStyle('width', w);
				that.handle.setStyle('width', W)
			}
		});
		
		this.lbDrag = new Drag(leftBorder, {
			onSnap : function(elem){
				that.dragParams.w = content.getSize().x;
				that.dragParams.W = that.handle.getSize().x;
				that.dragParams.pos = content.getPosition();
				that.dragParams.target = content;
			},
			
			onDrag : function(elem){
				var delta = this.mouse.now.x - this.mouse.start.x;
				var w = that.dragParams.w - delta;
				var W = that.dragParams.W - delta;
				var L = this.mouse.start.x + delta;
				if (w < that.options.minWidth || L < target.getPosition().x) {
					return;
				}
				that.dragParams.target.setStyle('width', w);
				that.handle.setStyle('width', W);
				that.handle.setStyle('left', L);
			}
		});
		
		this.bDrag = new Drag(bottomBorder, {
			onSnap : function(elem){
				that.dragParams.h = content.getSize().y;
				that.dragParams.H = that.handle.getSize().y;
				that.dragParams.target = content;
			},
			
			onDrag : function(elem){
				var delta = this.mouse.now.y - this.mouse.start.y;
				var h = that.dragParams.h + delta;
				var H = that.dragParams.H + delta;
				var targetPos = that.dragParams.target.getPosition();

				if (h < that.options.minHeight || (H + targetPos.y) > (window.getScrollTop() + window.getHeight())) {
					return;
				}
				that.dragParams.target.setStyle('height', h);
				that.handle.setStyle('height', H);
			}
		});
		
		
		this.resizeDrag = new Drag(brResize, {
			preventDefault: true,
			style: false,
			onSnap : function(elem){
				that.dragParams.h = content.getSize().y;
				that.dragParams.H = that.handle.getSize().y;
				that.dragParams.w = content.getSize().x;
				that.dragParams.W = that.handle.getSize().x;
				that.dragParams.target = content;
			},
			
			onDrag : function(){
				var deltay = this.mouse.now.y - this.mouse.start.y;
				var deltax = this.mouse.now.x - this.mouse.start.x;
				var h = that.dragParams.h + deltay;
				var H = that.dragParams.H + deltay;
				var w = that.dragParams.w + deltax;
				var W = that.dragParams.W + deltax;
				var targetPos = that.dragParams.target.getPosition();
				
				if (h < that.options.minHeight || (H + targetPos.y) > (window.getScrollTop() + window.getHeight())
					|| w < that.options.minWidth || (W + targetPos.x) > (window.getScrollLeft() + window.getWidth())) {
					return;
				}

				that.dragParams.target.setStyle('height', h);
				that.handle.setStyle('height', H);
				that.dragParams.target.setStyle('width', w);
				that.handle.setStyle('width', W);
			}
		});
	},
	
	_destroy : function(){
		if ($type(this.handle) == 'element'){
			this.handle.destroy();
		}
		this.handle = null;
	},
	
	open : function(elem){
		if (!this.handle)
			this._create(elem);
	},
	
	close : function(){
		this._destroy();
	},

	up : function(){
		this.handle.setStyle('z-index', ++dWindowZIndex);
	},
	
	// аЗаАаИаМббаВбаЕаМ аМаЕбаОаДб аКаЛаАббаОаВ Options аИ Events
	Implements : [Options, Events]
});