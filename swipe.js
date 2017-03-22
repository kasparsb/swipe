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

    var instances = 0;

    var Swipe = function(el, config) {
        this.instanceId = instances++;


        // Touch/mouse events will be attaches to body
        this.swipeEl = document.getElementsByTagName('body')[0];

        this.el = el;

        this.events = this.prepareEvents(
            ["swipe", "move", "start", "end", "touchend", "touchmove"]
        );

        // Apply configuration
        this.config(config);

        // Allowed touches count. When swiping we need only one touch
        this.touchesCount = 1;
        // Slope factor to distinguise vertical swipe from horizontal
        this.slopeFactor = 1;
        // First touch when touch start occures
        this.startTouch = false;
        // First touch when first move event triggered
        this.firstMoveTouch = false;
        // Current touch, when swipe is in process
        this.currentTouch = undefined;

        // Swipe width
        this.width;
        // Swipe height
        this.height;
        // Swipe duration
        this.duration;
        // In case of directional swipe, this will be initial swipe direction (horizontal or vertical)
        this.moveDirection = null;

        /**
         * Is touch events supported
         * This will be determined when first touchstart event fires
         */
        this.isTouchEvents = false;

        /**
         * Is touch started on this.el
         */
        this.isTouchedValidElement = false;

        this.handleEvents('add');

        return this;
    }

    Swipe.prototype = {
        prepareEvents: function(eventNames) {
            var r = {};
            for ( var i in eventNames ) {
                r[eventNames[i]] = [];
            }
            return r;
        },

        handleEvents: function(method) {
            var mthis = this;

            var start = function(ev) {
                mthis.isTouchedValidElement = false;
                if (mthis.isTheElement(mthis.eventTarget(ev))) {
                    mthis.isTouchedValidElement = true;
                    mthis._start(ev);
                }
            }
            
            var end = function(ev) {
                if (mthis.isTouchedValidElement) {
                    mthis._end(ev);
                    mthis.isTouchedValidElement = false;
                }
            }

            var move = function(ev) {
                if (mthis.isTouchedValidElement) {
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

            this[eventMethod](this.swipeEl, 'touchstart', touchStart);
            this[eventMethod](this.swipeEl, 'touchmove', touchMove);
            this[eventMethod](this.swipeEl, 'touchend', touchEnd);
        
            this[eventMethod](this.swipeEl, 'mousedown', mouseStart);
            this[eventMethod](this.swipeEl, 'mousemove', mouseMove);
            this[eventMethod](this.swipeEl, 'mouseup', mouseEnd);
        },

        /**
         * Touch start. When touch starts or when mouse down
         */
        _start: function(ev) {
            this.startTouch = this.getTouch(ev);
            this.firstMoveTouch = false;
            this.validMove = false;
            this.moveDirection = null;

            this.fire("start", [this.startTouch]);
        },

        /**
         * Touch ends
         */
        _end: function(ev) {
            this.currentTouch = this.getTouch(ev);

            // Šajā mirklī tas ir lieki
            //this.trackMovment();

            this.startTouch = false;
            this.firstMoveTouch = false;

            if (this.validMove) {
                this.fire("end", [this.formatSwipe()]);
             }

            // Vienmēr izpildām touchend eventu
            this.fire("touchend", [this.formatSwipe()]);
        },

        /**
         * Touch is moving. Moving when mouse down
         */
        _move: function(ev) {
            // Check for startTouch when fired mousemove event
            if (this.startTouch) {

                if (!this.firstMoveTouch) {
                    this.firstMoveTouch = this.getTouch(ev);
                }

                this.currentTouch = this.getTouch(ev);

                this.trackMovment();

                // Always retranslate touchmove if there was move
                this.fireTouchMove();

                if (this.isValidMove()) {
                    this.preventEvent(ev);
                    this.validMove = true;
                }
                else {
                    this.validMove = false;   
                }
                
                if (this.validMove) {
                    this.fire("move", [this.formatSwipe()])
                }
            }
        },

        formatSwipe: function() {
            return {
                direction: this.direction,
                offset: this.offset,
                duration: this.duration,
                width: this.width,
                height: this.height,
                x: this.currentTouch.x,
                y: this.currentTouch.y,
                touchedElement: this.currentTouch.touchedElement,

                speed: this.width / this.duration
            }
        },

        /** 
         * There we can filter if current move is valid
         * For, example, if we track only horizontal move, then ignore
         * vertical move.
         * There also can be checked, if user is scrolling page
         */
        isValidMove: function() {
            var valid = true;

            /**
             * Ja ir directional swipe, tad ja ir nodetektēts direction
             * atbilstošs swipe, vairāk to nepārtraucam. Jo swipe laikā
             * var mainīties direction, no left kļūt par top
             */
            
            // Swipe direction
            if (this._config.direction) {
                
                // Uzstādām pirmo dektēto swipe virzienu
                if (!this.moveDirection) {
                    if (this.isHorizontal()) {
                        this.moveDirection = 'horizontal';
                    }
                    else if (this.isVertical()) {
                        this.moveDirection = 'vertical';
                    }
                }

                if (this.moveDirection != this._config.direction) {
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

        isHorizontal: function() {
            return (this.direction == "left" || this.direction == "right");
        },

        isVertical: function() {
            return (this.direction == "up" || this.direction == "down");
        },

        /**
         * Track swipe progress. Calculates swipe width, height and duration
         */
        trackMovment: function() {
            this.offset = {
                x: this.currentTouch.x - this.firstMoveTouch.x,
                y: this.currentTouch.y - this.firstMoveTouch.y
            };
            this.width = Math.abs(this.offset.x);
            this.height = Math.abs(this.offset.y);
            this.duration = this.currentTouch.t - this.startTouch.t;
            this.direction = this.getDirection()
        },

        /**
         * Get swipe direction
         */
        getDirection: function() {
            /**
             * Horizontal swipe elevation
             * When swiping left right there van be slight elveation, but this
             * does not mean user is swiping up or down
             */
            var e = this.offset.y / this.offset.x;

            if (e > this.slopeFactor) {
                return "up";
            }
            else if (e < -this.slopeFactor) {
                return "down";
            }
            else if (this.currentTouch.x > this.startTouch.x) {
                return "right";
            }
            else if (this.currentTouch.x < this.startTouch.x) {
                return "left";
            }
        },

        /**
         * Get touch object from event
         * We nned only x, y coordinates and time of touch
         */
        getTouch: function(ev) {
            var t = false;
            var changedTouches = ev.changedTouches;
            
            if (changedTouches) {
                // Allow only defined number of touches
                if (changedTouches.length == this.touchesCount) {
                    t = changedTouches[0];
                }
            }
            else {
                t = ev;
            }
            
            t = t ? this.formatTouch(t) : false;

            if (t) {
                // Pieglabājam elementu, uz kura notika touch
                t.touchedElement = this.eventTarget(ev);
            }

            return t;
        },

        formatTouch: function(ev) {
            var x = typeof ev.pageX == 'undefined' ? ev.x : ev.pageX;
            var y = typeof ev.pageY == 'undefined' ? ev.y : ev.pageY;

            return { 
                x: x,
                y: y,
                t: new Date().getTime()
            }
        },

        /**
         * Fire events attached callbacks
         */
        fire: function(eventName, args) {
            for (var i in this.events[eventName]) {
                this.events[eventName][i].apply(this, args);
            }
        },

        /**
         * Always retranslate touch move event
         * Check if swipe width or height is greater then 0
         */
        fireTouchMove: function() {
            var t = this.formatSwipe();
            if (t.width > 0 || t.height > 0) {
                this.fire("touchmove", [t]);
            }
        },

        /**
         * Check if target is same as this.el or target is child of this.el
         */
        isTheElement: function(target) {
            return (target == this.el || this.isChild(target, this.el));
        },

        isChild: function(target, element) {
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
            }
            else {
                obj.removeEventListener(type, fn, false);
            }
        },

        preventEvent: function(ev) {
            if (ev.preventDefault) {
                ev.preventDefault();
            }
            else {
                ev.returnValue = false;
            }
        },

        /**
         * Normalize event.target
         */
        eventTarget: function(ev) {
            var el;

            if (ev.target) {
                el = ev.target;
            }
            else if (ev.srcElement) {
                el = ev.srcElement
            }
            
            // Safari bug. Selected text returns text
            if (el.nodeType == 3) {
                el = el.parentNode
            }

            return el;
        },

        /**
         * Add event listener
         */
        on: function(eventName, cb) {
            if (typeof this.events[eventName] == "object") {
                this.events[eventName].push( cb );
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
            this.handleEvents('remove');
            this.events = [];
        }
    }

    return Swipe;
});