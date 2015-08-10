var $ = require('jquery');

var S = function( $el, config ) {
	this.$el = $el;

	this._events = this._prepareEvents(
		["swipe", "move", "start", "end", "touchend", "touchmove"]
	);

	this._config = config;

	// Allowed touches count. When swiping we need only one touch
	this._touchesCount = 1;
	// Slope factor to distinguise vertical swipe from horizontal
	this._slopeFactor = 1;
	// Duration for valid swipe
	this._swipeDuration = 100;
	// First touch when touch start occures
	this._startTouch = false;
	// Current touch, when swipe is in process
	this._currentTouch = undefined;

	// Swipe width
	this.width;
	// Swipe height
	this.height;
	// Swipe duration
	this.duration;

	/**
	 * Is touch events supported
	 * This will be determined when first touchstart event fires
	 */
	this.isTouchEvents = false;

	this._setEvents();

	return this;
}

S.prototype = {
	_prepareEvents: function( eventNames ) {
		var r = {};
		for ( var i in eventNames )
			r[eventNames[i]] = [];
		return r;
	},

	_setEvents: function() {
		var mthis = this;

		var start = function(ev) {
			mthis._start(ev);
		}
		
		var end = function(ev) {
			mthis._end(ev);
		}

		var move = function(ev) {
			mthis._move(ev);
		}

		
		// Ja izpildīsies touchstart, tad mouse eventus vairāk neklausāmies
		var touchStart = function(ev) {
			mthis.isTouchEvents = true;
			start(ev);
		}

		var touchEnd = function(ev) {
			end(ev);
		}

		var touchMove = function(ev) {
			move(ev)
		}


		// Ja ir toucheventi, tad mouse eventus neizpildām
		var mouseStart = function(ev) {
			if (!mthis.isTouchEvents) {
				start(ev)	
			}
		}

		var mouseEnd = function(ev) {
			if (!mthis.isTouchEvents) {
				end(ev)	
			}
		}

		var mouseMove = function(ev) {
			if (!mthis.isTouchEvents) {
				move(ev)
			}
		}

		
		this.$el.on( 'touchstart', touchStart );
	  	this.$el.on( 'touchmove', touchMove );
	  	this.$el.on( 'touchend', touchEnd );
	
		this.$el.on( 'mousedown', mouseStart );
		this.$el.on( 'mousemove', mouseMove );
		this.$el.on( 'mouseup', mouseEnd );
	},

	/**
	 * Touch start. When touch starts or when mouse down
	 */
	_start: function( ev ) {
		this._startTouch = this._getTouch( ev );
		this._firstMove = true;
		this._validMove = false;

		this._fire( "start", [ this._startTouch ] );

		

		/// Log
		//Log2.start( this._startTouch );
	},

	/**
	 * Touch ends
	 */
	_end: function( ev ) {
		this._currentTouch = this._getTouch( ev );

		this._trackMovment();

		this._startTouch = false;

		if ( this._validMove )
		 	this._fire( "end", [ this._formatSwipe() ] );

		// Vienmēr izpildām touchend eventu
		this._fire( "touchend", [ this._formatSwipe() ] );				

		/// Log
		//Log2.end( this._formatSwipe() );
	},

	/**
	 * Touch is moving. Moving when mouse down
	 */
	_move: function( ev ) {
		// Check for _startTouch when fired mousemove event
		if ( this._startTouch ) {

			this._currentTouch = this._getTouch( ev );

			this._trackMovment();

			// Always retranslate touchmove if there was move
			this._fireTouchMove();

			if ( this._isValidMove() ) {
				ev.preventDefault();
				this._validMove = true;

				console.log('validmove');
			}

			// if ( this._firstMove ) {
			// 	this._validMove = true;
			// }

			if ( this._firstMove ) {
				this._firstMove = false;
			}
			
			if ( this._validMove ) {
				this._fire( "move", [ this._formatSwipe() ] )
			}
			

			/// Log
			//Log2.move( this._formatSwipe() );
		}
	},

	_formatSwipe: function() {
		return {
			dir: this.direction,
			offset: this.offset,
			duration: this.duration,
			width: this.width,
			height: this.height,
			x: this._currentTouch.x,
			y: this._currentTouch.y,


			isswipe: this.duration >= this._swipeDuration,
			speed: this.width / this.duration
		}
	},

	/** 
	 * There we can filter if current move is valid
	 * For, example, if we track only horizontal move, then ignore
	 * vertical move.
	 * There also can be checked, if user is scrolling page
	 */
	_isValidMove: function () {
		if ( this._config && this._config.dir ) {
			if ( this._config.dir == "horizontal" ) {
				if (this.direction == "left" || this.direction == "right") {
					// Pārbaudām vai ir minWidth
					if (typeof this._config.minWidth != 'undefined') {
						console.log('_isValidMove', this.width, this._config.minWidth);
						if (this.width < this._config.minWidth) {
							return false;
						}
					}

					return true;
				}

				return false;
			}
			else if ( this._config.dir == "vertical" ) {
				if (this.direction == "up" || this.direction == "down") {
					// Pārbaudām vai ir minHeight
					if (typeof this._config.minHeight != 'undefined') {
						if (this.height < this._config.minHeight) {
							return false;
						}
					}

					return true;
				}

				return false;
			}
		}
		else {
			return true;
		}
	},

	/**
	 * Track swipe progress. Calculates swipe width, height and duration
	 */
	_trackMovment: function() {
		this.offset = {
			x: this._currentTouch.x - this._startTouch.x,
			y: this._currentTouch.y - this._startTouch.y
		};
		this.width = Math.abs( this.offset.x );
		this.height = Math.abs( this.offset.y );
		this.duration = this._currentTouch.t - this._startTouch.t;
		this.direction = this._getDirection()
	},

	/**
	 * Get swipe direction
	 */
	_getDirection: function() {
		/**
		 * Horizontal swipe elevation
		 * When swiping left right there van be slight elveation, but this
		 * does not mean user is swiping up or down
		 */
		var e = this.offset.y / this.offset.x;

		if ( e > this._slopeFactor )
			return "up";
		else if ( e < -this._slopeFactor )
			return "down";
		else if ( this._currentTouch.x >= this._startTouch.x )
			return "right";
		else if ( this._currentTouch.x < this._startTouch.x )
			return "left";
	},

	/**
	 * Get touch object from event
	 * We nned only x, y coordinates and time of touch
	 */
	_getTouch: function ( ev ) {
		if ( ev.originalEvent )
  			ev = ev.originalEvent;

  		var t = false;
  		var changedTouches = ev.changedTouches;

  		if ( changedTouches ) {
  			// Allow only defined number of touches
  			if ( changedTouches.length == this._touchesCount )
  				t = changedTouches[0];
  		}
  		else {
  			t = ev;
  		}
  		
	  	return t ? this._formatTouch( t ) : false;
	},

	_formatTouch: function(ev) {
		return { 
			x: ev.pageX,
			y: ev.pageY,
			t: new Date().getTime()
		}
	},

	/**
	 * Fire events attached callbacks
	 */
	_fire: function( eventName, args ) {
		for ( var i in this._events[eventName] )
			this._events[eventName][i].apply( this, args );
	},

	/**
	 * Always retranslate touch move event
	 * Check if swipe width or height is greater then 0
	 */
	_fireTouchMove: function() {
		var t = this._formatSwipe();
		if (t.width > 0 || t.height > 0) {
			this._fire( "touchmove", [t] );	
		}
	},

	/**
	 * Add event listener
	 */
	on: function( eventName, cb ) {
		if ( typeof this._events[eventName] == "object" )
			this._events[eventName].push( cb );

		return this;
	},

	data: function( d ) {
		if ( typeof d == "undefined" )
			return this._data;
		else
			this._data = d;
	}
}

module.exports = S;