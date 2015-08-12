(function(root, factory){

    if (typeof exports === 'object') {
        module.exports = factory();
    }
    else {
        if (typeof root.webit == 'undefined') {
            root.webit = {}
        }
        root.webit.swipe = factory();
    }

})(this, function(){
    var Swipe = function(el, config) {
        this.window = window;

        this.el = el;

        this._events = this._prepareEvents(
            ["swipe", "move", "start", "end", "touchend", "touchmove"]
        );

        // Apply configuration
        this.config(config);

        // Allowed touches count. When swiping we need only one touch
        this._touchesCount = 1;
        // Slope factor to distinguise vertical swipe from horizontal
        this._slopeFactor = 1;
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

        /**
         * Is touch started on this.el
         */
        this.isTouchedValidElement = false;

        this._handleEvents('add');

        return this;
    }

    Swipe.prototype = {
        _prepareEvents: function(eventNames) {
            var r = {};
            for ( var i in eventNames ) {
                r[eventNames[i]] = [];
            }
            return r;
        },

        _handleEvents: function(method) {
            var mthis = this;

            var start = function(ev) {
                if (mthis._isTheElement(ev.target)) {
                    this.isTouchedValidElement = true;

                    mthis._start(ev);
                }
                else {
                    this.isTouchedValidElement = false;
                }
            }
            
            var end = function(ev) {
                if (this.isTouchedValidElement) {
                    mthis._end(ev);

                    this.isTouchedValidElement = false;
                }
            }

            var move = function(ev) {
                if (this.isTouchedValidElement) {
                    mthis._move(ev);
                }
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

            var eventMethod = method == 'add' ? 'addEvent' : 'removeEvent';

            this[eventMethod](this.window, 'touchstart', touchStart);
            this[eventMethod](this.window, 'touchmove', touchMove);
            this[eventMethod](this.window, 'touchend', touchEnd);
        
            this[eventMethod](this.window, 'mousedown', mouseStart);
            this[eventMethod](this.window, 'mousemove', mouseMove);
            this[eventMethod](this.window, 'mouseup', mouseEnd);
        },

        /**
         * Touch start. When touch starts or when mouse down
         */
        _start: function(ev) {
            this._startTouch = this._getTouch(ev);
            this._firstMove = true;
            this._validMove = false;

            this._fire("start", [this._startTouch]);
        },

        /**
         * Touch ends
         */
        _end: function(ev) {
            this._currentTouch = this._getTouch(ev);

            this._trackMovment();

            this._startTouch = false;

            if (this._validMove) {
                this._fire("end", [this._formatSwipe()]);
             }

            // Vienmēr izpildām touchend eventu
            this._fire("touchend", [this._formatSwipe()]);
        },

        /**
         * Touch is moving. Moving when mouse down
         */
        _move: function(ev) {
            // Check for _startTouch when fired mousemove event
            if ( this._startTouch ) {

                this._currentTouch = this._getTouch(ev);

                this._trackMovment();

                // Always retranslate touchmove if there was move
                this._fireTouchMove();

                if (this._isValidMove()) {
                    ev.preventDefault();
                    this._validMove = true;
                }
                else {
                    this._validMove = false;   
                }

                if (this._firstMove) {
                    this._firstMove = false;
                }
                
                if (this._validMove) {
                    this._fire("move", [this._formatSwipe()])
                }
            }
        },

        _formatSwipe: function() {
            return {
                direction: this.direction,
                offset: this.offset,
                duration: this.duration,
                width: this.width,
                height: this.height,
                x: this._currentTouch.x,
                y: this._currentTouch.y,

                speed: this.width / this.duration
            }
        },

        /** 
         * There we can filter if current move is valid
         * For, example, if we track only horizontal move, then ignore
         * vertical move.
         * There also can be checked, if user is scrolling page
         */
        _isValidMove: function() {
            var valid = true;
            
            // Swipe direction
            if (this._config.direction) {
                if (this._config.direction == 'horizontal' && !this._isHorizontal()) {
                    return false;
                }
                else if (this._config.direction == 'vertical' && !this._isVertical()) {
                    return false;
                }
            }

            var minMaping = {minWidth: 'width', minHeight: 'height', minDuration: 'duration'};
            var maxMaping = {maxWidth: 'width', maxHeight: 'height', maxDuration: 'duration'};

            for (var p in minMaping) {
                if (this._config[p]) {
                    if (this[minMaping[p]] < this._config[p]) {
                        return false;
                    }    
                }
                
            }

            for (var p in maxMaping) {
                if (this._config[p]) {
                    if (this[maxMaping[p]] > this._config[p]) {
                        return false;
                    }
                }
            }

            return true;
        },

        _isHorizontal: function() {
            return (this.direction == "left" || this.direction == "right");
        },

        _isVertical: function() {
            return (this.direction == "up" || this.direction == "down");
        },

        /**
         * Track swipe progress. Calculates swipe width, height and duration
         */
        _trackMovment: function() {
            this.offset = {
                x: this._currentTouch.x - this._startTouch.x,
                y: this._currentTouch.y - this._startTouch.y
            };
            this.width = Math.abs(this.offset.x);
            this.height = Math.abs(this.offset.y);
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

            if (e > this._slopeFactor) {
                return "up";
            }
            else if (e < -this._slopeFactor) {
                return "down";
            }
            else if (this._currentTouch.x >= this._startTouch.x) {
                return "right";
            }
            else if (this._currentTouch.x < this._startTouch.x) {
                return "left";
            }
        },

        /**
         * Get touch object from event
         * We nned only x, y coordinates and time of touch
         */
        _getTouch: function(ev) {
            if ( ev.originalEvent ) {
                ev = ev.originalEvent;
            }

            var t = false;
            var changedTouches = ev.changedTouches;

            if ( changedTouches ) {
                // Allow only defined number of touches
                if (changedTouches.length == this._touchesCount) {
                    t = changedTouches[0];
                }
            }
            else {
                t = ev;
            }
            
            return t ? this._formatTouch(t) : false;
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
        _fire: function(eventName, args) {
            for ( var i in this._events[eventName] ) {
                this._events[eventName][i].apply(this, args);
            }
        },

        /**
         * Always retranslate touch move event
         * Check if swipe width or height is greater then 0
         */
        _fireTouchMove: function() {
            var t = this._formatSwipe();
            if (t.width > 0 || t.height > 0) {
                this._fire("touchmove", [t]);
            }
        },

        /**
         * Check if target is same as this.el or target is child of this.el
         */
        _isTheElement: function(target) {
            return (target == this.el || this._isChild(target, this.el));
        },

        _isChild: function(target, element) {
            var n = target.parentNode;
            while (n) {
                if (n == element) {
                    return true;
                }
                n = n.parentNode;
            }
            return false;
        },

        addEvent: function(obj, type, fn) {
            if ( obj.attachEvent ) {
                obj['e'+type+fn] = fn;
                obj[type+fn] = function(){obj['e'+type+fn](window.event)}
                obj.attachEvent('on'+type, obj[type+fn]);
            }
            else {
                obj.addEventListener(type, fn, false);
            }
        },

        removeEvent: function(obj, type, fn) {
            if ( obj.detachEvent ) {
                obj.detachEvent( 'on'+type, obj[type+fn] );
                obj[type+fn] = null;
            } else {
                obj.removeEventListener(type, fn, false);
            }
        },

        /**
         * Add event listener
         */
        on: function(eventName, cb) {
            if ( typeof this._events[eventName] == "object" ) {
                this._events[eventName].push( cb );
            }

            return this;
        },

        /**
         * Set configuration parameters
         */
        config: function(config) {
            function formatValue(value, type) {
                switch (type) {
                    case 'int': return parseInt(value, 10);
                    default: return value
                }
            }

            var defConfig = {
                direction:  {value: false, type: 'string'},

                minWidth: {value: false, type: 'int'},
                minHeight: {value: false, type: 'int'},
                minDuration: {value: false, type: 'int'},

                maxWidth: {value: false, type: 'int'},
                maxHeight: {value: false, type: 'int'},
                maxDuration: {value: false, type: 'int'}
            }

            // Init empty config
            this._config = {};

            // Append defaults
            for (var p in defConfig) {
                this._config[p] = typeof config[p] == 'undefined' ? defConfig[p].value : formatValue(config[p], defConfig[p].type);
            }
        },

        /**
         * Destroy swipe monitoring
         */
        destroy: function() {
            // Remove all event listeners
            this._handleEvents('remove');
            this.events = [];
        }
    }

    return Swipe;
});