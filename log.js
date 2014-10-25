var Log2;
jQuery(function(){
	Log2 = {
		init: function() {
			this.$el = $("<div />").append(
				$("<div />"),
				$("<div />"),
				$("<div />")
			).css({
				position: "absolute",
				width: 180,
				top: 0,
				right: 0,
				background: "white",
				padding: 4
			}).appendTo( $("body") );
		},

		_w: function(i, v) {
			$(this.$el.find("div").get(i)).html(v);
		},

		start: function(touch) {
			this._w( 0, "start: "+touch.x+" "+touch.y);
		},
		move: function(touch) {
			this._w( 1,
				"width: "+touch.width+"<br />"+
				"height: "+touch.height+"<br />"+
				"dir: "+touch.dir
			);
		},
		end: function(touch) {
			this.startTouch = undefined;
			this._w( 2, 
				"end: "+touch.x+" "+touch.y+"<br />"+
				"dur: "+touch.duration+"<br />"+
				"width: "+touch.width+"<br />"+
				"height: "+touch.height
			);
		}
	};

	Log2.init();
});