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

    var List = function(items) {
        this.items = items;
    }
    List.prototype = {
        first: function() {
            if (this.items.length > 0) {
                return this.items[0];
            }
            return false;
        },
        second: function() {
            if (this.items.length > 1) {
                return this.items[1];
            }
            return false;
        }
    }

    var Swipe = function(el, config) {
        this.instanceId = instances++;
        // Pazīme vai ir uzlikts move requestAnimationFrame
        this.raf = undefined;


        // Touch/mouse events will be attaches to body
        this.swipeEl = document.getElementsByTagName('body')[0];

        this.el = el;

        this.events = this.prepareEvents([
            'swipe', 'move', 'start', 'end', 
            'pinchstart', 'pinchend', 'pinchmove', 
            'touchend', 'touchmove',
            'tap', 'doubletap'
        ]);

        // Apply configuration
        this.config(config);

        this.setTouchAction(this._config.direction);

        // Visi reģistrētie touchi, pēc to identifikatoriem
        this.touches = {};
        // Piereģistrēto touch skaits
        this.touchesCount = 0;
        // Slope factor to distinguise vertical swipe from horizontal
        this.slopeFactor = 1;
        // First touch when touch start occures
        this.startTouches = false;
        // First touch when first move event triggered
        this.firstMoveTouches = false;
        // Current touch, when swipe is in process
        this.currentTouches = false;

        // Move x, y offset values
        this.offset;
        // Swipe width
        this.width;
        // Swipe height
        this.height;
        // Swipe duration
        this.duration;
        // In case of directional swipe, this will be initial swipe direction (horizontal or vertical)
        this.moveDirection = null;

        // Cik pēdējās swipe kustības uzkrāt, lai noteiktu vai ir bijis swipe
        this.swipeLogStackMaxLength = 4;

        this.swipeLog = {
            stack: [],
            duration: 0,
            width: 0,
            height: 0
        };

        /**
         * Taps logs. Katram touch eventam piereģistrējam sākuma un beigu laiku
         * Pēc tam analizējam taps ilgumu un meklējam starp tiem tap vai double Tap
         * 
         * Reģistrējot pārbaudam vai events ar norādīt id ir reģistrēts. Ja nav tad liekam iekšā
         * un piereģistrējam ienākšanas laiku
         * 
         * Atreģistrējot meklējam eventu, kuram nav endTime
         */
        this.tapsLog = {};
        this.waitForDoubleTap = false;
        this.tapsLogExecuteTimeout = 0;

        /**
         * Is touch events supported
         * This will be determined when first touchstart event fires
         */
        this.isTouchEvents = false;

        /**
         * Is touch started on this.el
         */
        this.isTouchedValidElement = false;

        // Mouse down event
        this.isMouseDown = undefined;

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
                // Reģistrēti tiek tikai tie touchi, kuri nāk no iekonfigurētā elementa
                mthis.registerTouches(ev, true);

                mthis.isTouchedValidElement = mthis.touchesCount > 0;
                if (mthis.isTouchedValidElement) {
                    mthis._start(ev);
                }
            }
            
            var end = function(ev) {
                if (mthis.isTouchedValidElement) {
                    mthis._end(ev);
                    mthis.isTouchedValidElement = false;
                }

                mthis.unregisterTouches(ev);

                // Pārbaudām vai var palaist tap vai double tap eventus
                mthis.maybeFireTapping();
            }

            /**
             * @param touchedElement is used only on case of mouse
             * it provides custom element, not the one from current touch
             */
            var move = function(ev) {
                mthis.registerTouches(ev);

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
            var _mouseMove;

            var isMouseMove = function(startEv, moveEv) {
                if (startEv.x != moveEv.x) {
                    return true;
                }

                if (startEv.y != moveEv.y) {
                    return true;
                }

                return false;
            }

            var mouseStart = function(ev) {
                /**
                 * Right mouse button causes to fire mouseStart but no 
                 * mouseEnd because of context menu which is fired on
                 * right mouse click and mouseEnd event is not catched
                 * So only react to left mouse click
                 */
                if (!mthis.isMainMouseButton(ev)) {
                    return;
                }

                mthis.isMouseDown = mthis.formatTouch(ev);

                if (!mthis.isTouchEvents) {
                    start(ev)   
                }
            }

            var mouseEnd = function(ev) {
                if (!mthis.isTouchEvents) {
                    end(ev) 
                }
                mthis.isMouseDown = undefined;
            }

            var mouseMove = function(ev) {
                if (!mthis.isTouchEvents) {
                    if (mthis.isMouseDown) {
                        if (isMouseMove(mthis.isMouseDown, mthis.formatTouch(ev))) {
                            move(ev)
                        }
                    }
                }
            }

            var eventMethod = method == 'add' ? 'addEvent' : 'removeEvent';

            this[eventMethod](this.swipeEl, 'touchstart', touchStart);
            this[eventMethod](this.swipeEl, 'touchmove', touchMove, {passive: false});
            this[eventMethod](this.swipeEl, 'touchend', touchEnd);
        
            this[eventMethod](this.swipeEl, 'mousedown', mouseStart);
            this[eventMethod](this.swipeEl, 'mousemove', mouseMove);
            this[eventMethod](this.swipeEl, 'mouseup', mouseEnd);
        },

        /**
         * Touch start. When touch starts or when mouse down
         */
        _start: function(ev) {

            if (this._config.alwaysPreventTouchStart) {
                this.preventEvent(ev);
            }

            // Touch stāvoklis pašā sākumā
            this.startTouches = this.getTouches();

            // Touch stāvoklis, kad notika pirmais touchMove
            this.firstMoveTouches = false;

            this.validMove = false;
            this.moveDirection = null;
            this.swipeLog.stack = [];

            this.fire('start', [this.startTouches.first()]);

            // retranslate pinch
            this.maybeFirePinchStart();
        },

        /**
         * Touch ends
         */
        _end: function(ev) {
            this.currentTouches = this.getTouches();

            this.trackDuration();
            this.trackSwipe();

            var movement = this.formatMovement();

            // Liekam swipe statusu
            movement._swipeLog = {
                duration: this.swipeLog.duration,
                width: this.swipeLog.width,
                height: this.swipeLog.height,
                stackLength: this.swipeLog.stack.lenght,
                isSwipe: false
            };
            
            /**
             * Šeit pēc duration, width un height nosakām vai tā varēja
             * būt swipe kustība. Varbūt atkarībā no iekārtas varētu šo 
             * parametrus piekoriģēt???
             */
            if (this.swipeLog.duration < 80) {
                if (this.swipeLog.width > 7 || this.swipeLog.height > 7) {
                    movement._swipeLog.isSwipe = true;
                }
            }

            // Pazīme, vai bija swipe kustība
            movement.isSwipe = movement._swipeLog.isSwipe;


            this.startTouches = false;
            this.firstMoveTouches = false;

            this.currentTouches = false;

            // Notīrām move vērtības
            this.duration = undefined;
            this.offset = undefined;
            this.width = undefined;
            this.height = undefined;

            if (this.validMove) {
                this.fire("end", [movement]);
             }

            // Vienmēr izpildām touchend eventu
            this.fire("touchend", [movement]);

            // retranslate pinch
            this.maybeFirePinchEnd();
        },

        /**
         * Touch is moving. Moving when mouse down
         */
        _move: function(ev) {

            var mthis = this;

            if (this.startTouches) {

                // If configured to disable pinch to zoom
                this.maybePreventPinch(ev);

                if (!this.firstMoveTouches) {
                    this.firstMoveTouches = this.getTouches();
                }

                this.currentTouches = this.getTouches();

                this.clearTapLog();
                this.trackDuration();
                this.trackSwipe();
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
                    /**
                     * Vajag iespēju palaist move caur requestAnimationFrame
                     * Ja pa tiešo pie move ir pieslēgts vizuālā elementa pārvietošana,
                     * tad pārzimēt elementu uz katru move ir par daudz
                     */
                    if (this._config.fireMoveOnRequestAnimationFrame) {
                        if (!this.raf) {
                            this.raf = window.requestAnimationFrame(function(r){

                                // Pārbaudām vai vēl esam move stāvoklī. Iespējams, ka mirklī
                                // kad izpildās cb vairs nav touch events
                                if (mthis.startTouches) {
                                    mthis.fire('move', [mthis.formatMovement()])
                                }

                                mthis.raf = undefined;
                            })
                        }
                    }
                    else {
                        this.fire('move', [this.formatMovement()])
                    }
                }

                // retranslate pinch
                this.maybeFirePinchMove();
            }
        },

        /**
         * Pārbaudām vai var palaist tap vai doubletap eventus
         */
        maybeFireTapping: function() {
            clearTimeout(this.tapsLogExecuteTimeout);

            if (this.isEventsRegistered('doubletap')) {
                this.maybeFireDoubleTap(this.getValidTapRegistered());
            }
            else {
                this.maybeFireSingleTap(this.getValidTapRegistered());
            }

            this.clearTapLog();            
        },

        maybeFireDoubleTap: function(tap) {
            if (!tap) {
                return;
            }

            var mthis = this;

            if (this.waitForDoubleTap) {
                this.fire('doubletap', [tap.touch])
                this.waitForDoubleTap = false;
            }
            else {
                // Gaidām nākošo tap
                this.waitForDoubleTap = true;
                this.tapsLogExecuteTimeout = setTimeout((function(touch){
                    
                    return function() {
                        mthis.waitForDoubleTap = false;

                        mthis.fire('tap', [touch])
                    }

                })(tap.touch), this._config.doubletapWaitTimeout)


                /**
                 * @todo Te vajadzētu kaut kādu pseido little bit before tap, jo
                 * uz ios doubletapWaitTimeout ir tāds pats kā šeit iekonfigurēts
                 * bet single tap tomēr izpildās drusku ātrāk. Tas tāpēc, lai interfeiss
                 * justos atsaucīgāks. Savukārt ļoti īsu doubletapWaitTimeout nevar taisīt,
                 * jo kādam, kuram nav veikli pirksti būs grūti uztaisīt doubleTap
                 */
            }
        },

        maybeFireSingleTap: function(tap) {
            if (!tap) {
                return;
            }

            this.fire('tap', [tap.touch])
        },

        maybePreventPinch: function(ev) {
            if (this._config.disablePinch && this.touchesCount >= 2) {
                ev.preventDefault();
            }
        },

        maybeFirePinchStart: function() {
            if (this.touchesCount < 2) {
                return;
            }

            this.fire('pinchstart', [this.formatPinch(
                this.startTouches.first().x,
                this.startTouches.second().x,
                this.startTouches.first().y,
                this.startTouches.second().y
            )]);
        },

        maybeFirePinchEnd: function() {
            if (this.touchesCount < 2) {
                this.fire('pinchend', []);
            }
        },

        maybeFirePinchMove: function() {
            if (this.touchesCount < 2) {
                return;
            }

            // Pinch gadījumā interesē tikai 2 currentTouches
            this.fire('pinchmove', [{
                first: this.formatPinch(
                    this.firstMoveTouches.first().x,
                    this.firstMoveTouches.second().x,
                    this.firstMoveTouches.first().y,
                    this.firstMoveTouches.second().y
                ),
                current: this.formatPinch(
                    this.currentTouches.first().x,
                    this.currentTouches.second().x,
                    this.currentTouches.first().y,
                    this.currentTouches.second().y
                )
            }])
        },

        formatPinch: function(x1, x2, y1, y2) {
            return {
                // Pirmais touch punkts
                x1: x1,
                y1: y1,

                // Otrais touch punkts
                x2: x2,
                y2: y2,

                width: Math.abs(x1-x2),
                height: Math.abs(y1-y2),

                // Atālums starp touchiem. Hipotenūza, kur width un height ir taisnleņķa katetes
                // Aprēķinām pēc pitagora teorēmas distance = sqrt(pow(width, 2) + pow(height, 2))
                distance: Math.sqrt(Math.pow(Math.abs(x1-x2), 2) + Math.pow(Math.abs(y1-y2), 2)),

                // Pinch centrs
                center: {
                    x: this.calcMid(x1, x2),
                    y: this.calcMid(y1, y2)
                }
            }
        },

        calcMid: function(p1, p2) {
            return p1 < p2 ? (p2-p1)/2+p1 : (p1-p2)/2+p2;
        },

        formatMovement: function() {
            return {
                // Padodam konfigurācijai atbilstošu direction. Ja ir iekonfigurēts horizontal, tad padodam left or right
                direction: this.getFormattedDirection(),
                offset: this.offset,
                duration: this.duration,
                width: this.width,
                height: this.height,
                x: this.currentTouches.first().x,
                y: this.currentTouches.first().y,
                touchedElement: this.currentTouches.first().touchedElement,

                speed: isNaN(this.width / this.duration) ? 0 : this.width / this.duration,
                realDirection: this.direction
            }
        },

        getFormattedDirection: function() {
            if (this.isDirection(this._config.direction, 'horizontal') || this.isDirection(this._config.direction, 'vertical')) {
                return this.getDirection();
            }
            else if (this.isDirection(this._config.direction, 'horizontal')) {
                return this.getHorizontalDirection();
            }
            else if (this.isDirection(this._config.direction, 'vertical')) {
                return this.getHorizontalDirection();
            }
        },

        /** 
         * There we can filter if current move is valid
         * For, example, if we track only horizontal move, then ignore
         * vertical move.
         * There also can be checked, if user is scrolling page
         */
        isValidMove: function() {
            // Ja swipeLog nav pilns, tad nevaram vēl validēt move un uzskatām, ka tas ir valid
            if (this.swipeLog.stack.length < 2) {
                return false;
            }

            /**
             * Ja ir directional swipe, tad ja ir nodetektēts direction
             * atbilstošs swipe, vairāk to nepārtraucam. Jo swipe laikā
             * var mainīties direction, no left kļūt par top
             */
            
            // Swipe direction
            if (this._config.direction.length > 0) {
                
                // Uzstādām pirmo detektēto swipe virzienu
                if (!this.moveDirection) {
                    this.moveDirection = this.getMoveDirection();
                }

                if (!this.isDirection(this._config.direction, this.moveDirection)) {
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

        /**
         * Track swipe progress. Calculates swipe width, height and duration
         */
        trackMovment: function() {
            this.offset = {
                x: this.currentTouches.first().x - this.firstMoveTouches.first().x,
                y: this.currentTouches.first().y - this.firstMoveTouches.first().y
            };
            this.width = Math.abs(this.offset.x);
            this.height = Math.abs(this.offset.y);
            
            this.direction = this.getDirection();
        },

        trackDuration: function() {
            this.duration = this.currentTouches.first().t - this.startTouches.first().t;
        },

        trackSwipe: function() {
            // Uzkrājam pēdējās this.swipeLogStackMaxLength move kustības. No tām tiks noteikts vai ir bijis swipe
            this.swipeLog.stack.push({
                x: this.currentTouches.first().x,
                y: this.currentTouches.first().y,
                duration: this.duration
            });

            if (this.swipeLog.stack.length > this.swipeLogStackMaxLength) {
                this.swipeLog.stack.shift();
            }

            // Time between first and last logged movement
            this.swipeLog.duration = this.swipeLog.stack[this.swipeLog.stack.length-1].duration - this.swipeLog.stack[0].duration;
            this.swipeLog.width = Math.abs(this.swipeLog.stack[this.swipeLog.stack.length-1].x - this.swipeLog.stack[0].x);
            this.swipeLog.height = Math.abs(this.swipeLog.stack[this.swipeLog.stack.length-1].y - this.swipeLog.stack[0].y);
        },

        /**
         * Atgriežam virzienu vienalga kādā virzienā. Vai horizontal vai vertical.
         * Pirmo pārbaudām vertikālo virzienu. Ja tā nav, tad horizontālo
         */
        getDirection: function() {
            if (this.getVerticalDirection()) {
                return this.getVerticalDirection();
            }
            else if (this.getHorizontalDirection()) {
                return this.getHorizontalDirection();
            }
        },

        /**
         * Atgriežam tikai horizontālo virzienu: left or right
         */
        getHorizontalDirection: function() {
            if (this.currentTouches.first().x > this.startTouches.first().x) {
                return "right";
            }
            else if (this.currentTouches.first().x < this.startTouches.first().x) {
                return "left";
            }

            return false;
        },

        /**
         * Atgriežam tikai vertikālo virzienu: up or down
         */
        getVerticalDirection: function() {
            /**
             * Horizontal swipe elevation
             * When swiping left right there van be slight elveation, but this
             * does not mean user is swiping up or down
             */
            if (this.offset) {
                var e = this.offset.y / this.offset.x;

                if (e > this.slopeFactor) {
                    return "up";
                }
                else if (e < -this.slopeFactor) {
                    return "down";
                }
            }

            return false;
        },

        getMoveDirection: function() {
            if (this.isHorizontalDirection()) {
                return 'horizontal';
            }
            
            if (this.isVerticalDirection()) {
                return 'vertical';
            }

            return '';
        },

        isHorizontalDirection: function() {
            return (this.direction == "left" || this.direction == "right");
        },

        isVerticalDirection: function() {
            return (this.direction == "up" || this.direction == "down");
        },

        /**
         * Apstrādājam touch registered notikumu
         */
        handleTouchRegistered: function(touch) {
            this.touchesCount++;

            // Ja ir viens touch, tad reģistrējam kā tap
            if (this.touchesCount == 1) {
                // Reģistrējam tap
                this.registerTapLog(this.touches[touch.identifier]);
            }
        },

        handleTouchUnregistered: function(identifier) {
            this.touchesCount--;

            // Atreģistrējam tap
            this.unregisterTapLog(identifier);
        },

        /**
         * @param validateTouchedElement Reģistrējam tikai tos touch, kuri nāk no iekonfigurētā elementa
         * Tas ir vajadzīgs, lai swipe sāktos tikai uz iekofigurēto elementu
         * Pēc tam, kad notiek move, tad neskatamies uz touched elementu
         *
         * changedTouches nesatur to elementu uz kura tagad touch atrodas
         * elements vienmēr būs tas no kura sākās touch events
         * Elements, kurš pašlaik ir zem touch jānosaka ar pageX pageY vai kaut kā savādāk
         */
        registerTouches: function(ev, validateTouchedElement) {
            if (ev.changedTouches) {
                for (var i = 0; i < ev.changedTouches.length; i++) {
                    this.registerTouch(this.formatTouch(ev.changedTouches[i]), this.eventTarget(ev.changedTouches[i]), validateTouchedElement);
                }
            }
            else {
                this.registerTouch(this.formatTouch(ev), this.eventTarget(ev), validateTouchedElement);
            }
        },

        unregisterTouches: function(ev) {
            if (ev.changedTouches) {
                for (var i = 0; i < ev.changedTouches.length; i++) {
                    this.unregisterTouch(ev.changedTouches[i].identifier)
                }
            }
            else {
                this.unregisterTouch('_faketouch')
            }
        },

        registerTouch: function(touch, touchedElement, validateTouchedElement) {

            if (validateTouchedElement) {
                if (!this.isTheElement(touchedElement)) {
                    return false;
                }
            }
            
            // Update
            if (this.isTouchRegistered(touch)) {
                this.touches[touch.identifier] = touch;
                this.touches[touch.identifier].touchedElement = touchedElement;

                return false;
            }

            // Insert new
            this.touches[touch.identifier] = touch;
            this.touches[touch.identifier].touchedElement = touchedElement;

            // Touch ir piereģistrēts
            this.handleTouchRegistered(this.touches[touch.identifier]);
        },

        unregisterTouch: function(identifier) {

            if (typeof this.touches[identifier] != 'undefined') {
                delete this.touches[identifier];

                // Paziņojam, ka touch ir atreģistrēts
                this.handleTouchUnregistered(identifier);
            }
        },

        isTouchRegistered: function(touch) {
            return (typeof this.touches[touch.identifier] != 'undefined');
        },

        /**
         * Get touch object from event
         * We need only x, y coordinates and time of touch
         */
        // getTouch: function(ev) {
        //     var t = false;
        //     var changedTouches = ev.changedTouches;
            
        //     if (changedTouches) {
        //         t = changedTouches[0];
        //     }
        //     else {
        //         t = ev;
        //     }
            
        //     t = t ? this.formatTouch(t) : false;

        //     if (t) {
        //         // Pieglabājam elementu, uz kura notika touch
        //         t.touchedElement = this.eventTarget(ev);
        //     }

        //     return t;
        // },

        /**
         * Atgriežam touches kopiju uz doto mirkli
         */
        getTouches: function() {
            var mthis = this;
            return new List(this.map(this.touches, function(touch){
                return mthis.clone(touch);
            }))
        },

        formatTouch: function(ev) {
            return {
                identifier: (typeof ev.identifier == 'undefined' ? '_faketouch' : ev.identifier),
                x: typeof ev.pageX == 'undefined' ? ev.x : ev.pageX,
                y: typeof ev.pageY == 'undefined' ? ev.y : ev.pageY,
                t: new Date().getTime()
            }
        },

        /**
         * Reģistrējam tap logu. Piereģistrējam touch pēc tā id un piereģistrējam tā sākuma laiku
         * @param string Touch identifikators
         */
        registerTapLog: function(touch) {
            this.tapsLog[touch.identifier] = {
                touch: this.clone(touch),
                startTime: new Date().getTime(),
                endTime: undefined,
                duration: undefined,
                executed: false
            };
        },

        /**
         * Atgreģistrējam tap. Uzliekam tap end laiku pēc touch id
         * Tā lai varam pēc tam izrēķināt cik ilgs ir bijis touch
         */
        unregisterTapLog: function(identifier) {
            if (typeof this.tapsLog[identifier] != 'undefined') {
                this.registerTapEnd(this.tapsLog[identifier])
            }
        },

        clearTapLog: function() {
            this.tapsLog = {}
        },

        registerTapEnd: function(tap) {
            if (!tap.endTime) {
                tap.endTime = new Date().getTime();
                    
                // Tap ilgums
                tap.duration = tap.endTime - tap.startTime;
            }
        },

        /**
         * Atgriež pēdējo valīdo tap no tapLog
         */
        getValidTapRegistered: function() {
            var validTap = false, mthis = this;

            this.each(this.tapsLog, function(tap){
                
                if (mthis.validateTap(tap)) {
                    validTap = tap;
                }

            })

            return validTap;
        },

        validateTap: function(tap) {
            if (tap.duration > this._config.tapMinDuration && tap.duration < this._config.tapMaxDuration) {
                if (this.isTheElement(tap.touch.touchedElement)) {
                    return true;
                }
            }
            return false;
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
            var t = this.formatMovement();
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

        addEvent: function(obj, type, fn, params) {
            params = (typeof params == 'undefined' ? false : params);
            if ( obj.attachEvent ) {
                obj['e'+type+fn] = fn;
                obj[type+fn] = function(){obj['e'+type+fn](window.event)}
                obj.attachEvent('on'+type, obj[type+fn]);
            }
            else {
                obj.addEventListener(type, fn, params);
            }
        },

        removeEvent: function(obj, type, fn, params) {
            params = (typeof params == 'undefined' ? false : params);
            if ( obj.detachEvent ) {
                obj.detachEvent( 'on'+type, obj[type+fn] );
                obj[type+fn] = null;
            }
            else {
                obj.removeEventListener(type, fn, params);
            }
        },

        isEventCancelable: function(ev) {
            if (typeof ev.cancelable != 'undefined') {
                return ev.cancelable;
            }

            return true;
        },

        preventEvent: function(ev) {
            if (this.isEventCancelable(ev)) {
                if (ev.preventDefault) {
                    ev.preventDefault();
                }
                else {
                    ev.returnValue = false;
                }
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
            if (typeof this.events[eventName] != 'undefined') {
                this.events[eventName].push(cb);
            }

            return this;
        },

        isEventsRegistered: function(eventName) {
            return (typeof this.events[eventName] != 'undefined' && this.events[eventName].length > 0);
        },

        /**
         * Set configuration parameters
         */
        config: function(config) {
            if (typeof config == 'undefined') {
                config = {};
            }

            function formatByType(value, type) {
                switch (type) {
                    case 'int': return parseInt(value, 10);
                    case 'boolean': return (value ? true : false);
                    default: return value
                }
            }
            
            function formatValue(value, config) {
                if (typeof config.multiple == 'undefined') {
                    config.multiple = false;
                }

                if (config.multiple) {
                    value = value.split(' ');
                    for (var i = 0; i < value.length; i++) {
                        value[i] = formatByType(value[i], config.type);
                    }
                }
                else {
                    value = formatByType(value, config.type)
                }

                return value;
            }

            var defConfig = {
                // Directions var būt vairāki (vertical horizontal)
                direction:  {value: ['horizontal', 'vertical'], type: 'string', multiple: true},

                minWidth: {value: false, type: 'int'},
                minHeight: {value: false, type: 'int'},
                minDuration: {value: false, type: 'int'},

                maxWidth: {value: false, type: 'int'},
                maxHeight: {value: false, type: 'int'},
                maxDuration: {value: false, type: 'int'},

                disablePinch: {value: false, type: 'boolean'},

                /**
                 * Prevent any movement. Šis notiek touchstart eventā
                 * Šis palīdz iOS gadījumā, kad neskatoties uz prevent move
                 * lapa tā pat dabū skrolēties ar elastic
                 */
                alwaysPreventTouchStart: {value: false, type: 'boolean'},

                /**
                 * Move events tiek izpildīts caur requestAnimationFrame nevis uz katru move
                 */
                fireMoveOnRequestAnimationFrame: {value: false, type: 'boolean'},

                doubletapWaitTimeout: {value: 530, type: 'int'},
                tapMaxDuration: {value: 600, type: 'int'},
                tapMinDuration: {value: 5, type: 'int'}
            }

            // Init empty config
            this._config = {};

            // Append defaults
            for (var p in defConfig) {
                this._config[p] = typeof config[p] == 'undefined' ? defConfig[p].value : formatValue(config[p], defConfig[p]);
            }
        },

        setTouchAction: function(direction) {
            var c = [];

            if (this.isDirection(direction, 'vertical')) {
                c.push('pan-x');
            }

            if (this.isDirection(direction, 'horizontal')) {
                c.push('pan-y');
            }
            
            // Pievienojam touch-action
            if (c.length > 0) {
                this.el.style.touchAction = c.join(' ');    
            }
            else {
                this.el.style.touchAction = 'none';
            }
        },

        isDirection: function(directionsArray, direction) {
            for (var i = 0; i < directionsArray.length; i++) {
                if (directionsArray[i] == direction) {
                    return true
                }
            }
            return false;
        },

        /**
         * Detect if main (left) button is pressed
         */
        isMainMouseButton: function(ev) {
            if (typeof ev['which'] != 'undefined') {
                return ev.which == 1; 
            }
            else if (typeof ec['button'] != 'undefined') {
                return ev.button == 0;
            }
            else {
                return true;
            }
        },

        /**
         * Destroy swipe monitoring
         */
        destroy: function() {
            // Remove all event listeners
            this.handleEvents('remove');
            this.events = [];
        },

        objProps: function(obj) {
            var r = [];
            for (var name in obj) {
                if (obj.hasOwnProperty(name)) {
                    r.push(name);
                }
            }
            return r;
        },

        map: function(obj, cb) {
            var r = [];
            for (var name in obj) {
                if (obj.hasOwnProperty(name)) {
                    r.push(cb(obj[name], obj));
                }
            }
            return r;
        },

        each: function(obj, cb) {
            for (var name in obj) {
                if (obj.hasOwnProperty(name)) {
                    cb(obj[name], name);
                }
            }
        },

        clone: function(obj) {
            var r = {};
            for (var name in obj) {
                if (obj.hasOwnProperty(name)) {
                    r[name] = obj[name];
                }
            }
            return r;
        }
    }

    return Swipe;
});
